import 'server-only';
import { createHash } from 'node:crypto';
import { env } from './env';
import { from, must } from './db';
import { sha256, signToken } from './crypto';
import { HttpError } from './http';
import { stt, wordFeatures } from './elevenlabs';
import {
  accuse, accusationText, claimFor, countFillers, DEFAULT_WEIGHTS, lieBudget, outcome, parseAnswer, reasonText, truthOf,
  type AnswerType, type Features, type ItemResult, type Weights,
} from './game';
import { notifyResult } from './messaging';

type Item = {
  id: string; section: 'calibration' | 'game'; position: number; kind: string; prompt: string;
  screen_text: string | null; answer_type: AnswerType; follow_up: string | null; subthesis_id: string | null;
  follow_up_when: 'always' | 'yes' | 'no'; claim_yes: string | null; claim_no: string | null;
  option_a: string | null; option_b: string | null;
};
type Definition = {
  pitch: string[];
  rules: { lies: number; win_max_caught: number };
  rewards: { per_answer: number; max: number; win_bonus: number };
  voice: { voice_id: string; fallback_voice_id?: string; model?: string };
  lines: Record<string, string | string[]>;
  weights?: Partial<Weights>;
};
type Experiment = { id: string; slug: string; name: string; status: string; content_version: number; study_id: string | null; definition: Definition };

export async function loadExperiment(by: { slug?: string; id?: string }) {
  let q = from('pressure', 'experiments').select('id, slug, name, status, content_version, study_id, definition');
  q = by.id ? q.eq('id', by.id) : q.eq('slug', by.slug!);
  const exp = await must(q.maybeSingle(), 'experimento') as Experiment | null;
  if (!exp) throw new HttpError(404, 'experiment_not_found');
  const items = await must(from('pressure', 'items')
    .select('id, section, position, kind, prompt, screen_text, answer_type, follow_up, follow_up_when, claim_yes, claim_no, option_a, option_b, subthesis_id')
    .eq('experiment_id', exp.id).eq('enabled', true).order('section').order('position'), 'preguntas') as Item[];
  const calibration = items.filter((i) => i.section === 'calibration').sort((a, b) => a.position - b.position);
  const game = items.filter((i) => i.section === 'game').sort((a, b) => a.position - b.position);
  return { exp, calibration, game };
}

async function addEvent(sessionId: string, startedAt: string, type: string, payload: Record<string, unknown>, idempotencyKey?: string) {
  let seq = Math.max(0, Date.now() - Date.parse(startedAt));
  for (let i = 0; i < 4; i++) {
    const { error } = await from('pressure', 'events').insert({ session_id: sessionId, seq, type, payload, idempotency_key: idempotencyKey ?? null });
    if (!error) return;
    if (error.message.includes('idempotency_key')) return; // ya estaba
    if (!error.message.includes('duplicate')) throw new Error(`evento: ${error.message}`);
    seq++;
  }
}

const DEFAULT_SCREENS = {
  entry_note: 'Es anónimo. No te vamos a pedir tu nombre.',
  consent: '*Es con voz.* La máquina pregunta en voz alta y vos contestás hablando. Ponete auriculares o andá a un lugar tranquilo.\n\nLo que decís se pasa a texto para el juego y para investigación anónima. El audio no lo guardamos.\n\nLlegar al final: hasta *{max} Golden Tickets*. Ganarle a la máquina: *+{bonus}*.',
  consent_note: 'Dura unos 3 minutos.',
};
export type Screens = typeof DEFAULT_SCREENS;
export const screensOf = (d: { screens?: Partial<Screens> }) => ({ ...DEFAULT_SCREENS, ...(d.screens ?? {}) });

/** Textos de las pantallas de entrada. Valida el link sin gastarlo. */
export async function introFromCode(code: string) {
  if (!/^[a-z2-9]{16,40}$/.test(code)) throw new HttpError(400, 'invalid_link', 'El link no es válido.');
  const link = await must(from('core', 'access_links').select('target_id, uses, max_uses, expires_at, revoked_at')
    .eq('code_hash', await sha256(code)).eq('app_slug', 'pressure').maybeSingle(), 'link') as any;
  if (!link || link.revoked_at) throw new HttpError(404, 'invalid_link', 'El link no es válido. Pedí uno nuevo por WhatsApp.');
  if (Date.parse(link.expires_at) < Date.now()) throw new HttpError(410, 'expired_link', 'El link venció. Mandá cualquier mensaje por WhatsApp y te llega otro.');
  if (link.uses >= link.max_uses) throw new HttpError(410, 'used_link', 'Este link ya se usó. Pedí otro por WhatsApp.');
  const exp = await must(from('pressure', 'experiments').select('definition, status').eq('slug', link.target_id).single(), 'experimento') as any;
  if (!['testing', 'live'].includes(exp.status)) throw new HttpError(409, 'not_open', 'La máquina está apagada por ahora.');
  return { pitch: exp.definition.pitch ?? [], screens: screensOf(exp.definition), rewards: exp.definition.rewards };
}

/** Abre una partida desde el link personal. */
export async function startFromCode(code: string, device: Record<string, unknown>) {
  if (!/^[a-z2-9]{16,40}$/.test(code)) throw new HttpError(400, 'invalid_link', 'El link no es válido.');
  const link = await must(from('core', 'access_links')
    .select('id, node_id, target_id, uses, max_uses, expires_at, revoked_at, first_opened_at')
    .eq('code_hash', await sha256(code)).eq('app_slug', 'pressure').maybeSingle(), 'link') as any;
  if (!link || link.revoked_at) throw new HttpError(404, 'invalid_link', 'El link no es válido. Pedí uno nuevo por WhatsApp.');
  if (Date.parse(link.expires_at) < Date.now()) throw new HttpError(410, 'expired_link', 'El link venció. Mandá cualquier mensaje por WhatsApp y te llega otro.');
  if (link.uses >= link.max_uses) throw new HttpError(410, 'used_link', 'Este link ya se usó. Pedí otro por WhatsApp.');

  const node = await must(from('core', 'nodes').select('id, status').eq('id', link.node_id).maybeSingle(), 'nodo') as any;
  if (!node || ['blocked', 'archived'].includes(node.status)) throw new HttpError(403, 'not_allowed');
  const ps = await must(from('core', 'node_pseudonyms').select('pseudonym_id').eq('node_id', node.id).single(), 'seudónimo') as any;

  const { exp, calibration, game } = await loadExperiment({ slug: link.target_id });
  if (!['testing', 'live'].includes(exp.status)) throw new HttpError(409, 'not_open', 'La máquina está apagada por ahora.');
  if (game.length < exp.definition.rules.lies + 1) throw new HttpError(409, 'not_ready', 'El juego no está listo.');

  // ¿Ya cobró? Entonces es revancha. ¿Tenía una a medias? Esa deja de contar.
  const prior = await must(from('pressure', 'sessions').select('id, status, replay')
    .eq('pseudonym_id', ps.pseudonym_id).eq('experiment_id', exp.id), 'partidas previas') as any[];
  const paidDone = prior.some((s) => !s.replay && s.status === 'completed');
  const unfinished = prior.filter((s) => !s.replay && s.status !== 'completed');
  for (const s of unfinished) {
    await from('pressure', 'sessions').update({ replay: true, status: s.status === 'started' ? 'interrupted' : s.status, ended_at: new Date().toISOString() }).eq('id', s.id);
  }

  const session = await must(from('pressure', 'sessions').insert({
    pseudonym_id: ps.pseudonym_id, experiment_id: exp.id, access_link_id: link.id,
    content_version: exp.content_version, replay: paidDone, outcome: { device },
  }).select('id, started_at').single(), 'crear partida') as any;

  const now = new Date().toISOString();
  await from('core', 'access_links').update({ uses: link.uses + 1, last_opened_at: now, ...(link.first_opened_at ? {} : { first_opened_at: now }) }).eq('id', link.id);
  await from('core', 'nodes').update({ last_active_at: now }).eq('id', node.id);
  await addEvent(session.id, session.started_at, 'started', { replay: paidDone, content_version: exp.content_version, device });

  const d = exp.definition;
  return {
    token: await signToken(env.sessionSecret, session.id),
    session_id: session.id,
    alias: publicAlias(ps.pseudonym_id),
    replay: paidDone,
    game: {
      name: exp.name, pitch: d.pitch, screens: screensOf(d as any), rules: d.rules, rewards: d.rewards, lines: d.lines,
      calibration: calibration.map(publicItem),
      items: game.map(publicItem),
    },
  };
}

const publicItem = (i: Item) => ({
  id: i.id, position: i.position, kind: i.kind === 'signal' ? 'question' : i.kind === 'fun' ? 'question' : i.kind,
  prompt: i.prompt, screen_text: i.screen_text ?? i.prompt, answer_type: i.answer_type, follow_up: i.follow_up, follow_up_when: i.follow_up_when,
  options: i.answer_type === 'choice' ? [i.option_a, i.option_b] : null,
});

async function loadSession(sessionId: string) {
  const s = await must(from('pressure', 'sessions')
    .select('id, pseudonym_id, experiment_id, status, replay, started_at, content_version, outcome')
    .eq('id', sessionId).maybeSingle(), 'partida') as any;
  if (!s) throw new HttpError(404, 'session_not_found');
  return s as { id: string; pseudonym_id: string; experiment_id: string; status: string; replay: boolean; started_at: string; content_version: number; outcome: Record<string, unknown> | null };
}

async function sessionEvents(sessionId: string) {
  return must(from('pressure', 'events').select('type, payload, seq').eq('session_id', sessionId).order('seq'), 'eventos') as Promise<{ type: string; payload: any; seq: number }[]>;
}

export type AnswerInput = {
  item_id: string;
  stage: 'main' | 'follow';
  attempt: number;
  committed?: 'truth' | 'lie';
  features: Features;
  audio: Blob | null;
  mime: string;
};

/** Una respuesta hablada. Se transcribe, se interpreta y queda como observación. */
export async function recordAnswer(sessionId: string, input: AnswerInput) {
  const s = await loadSession(sessionId);
  if (s.status !== 'started') throw new HttpError(409, 'session_closed', 'Esta partida ya terminó.');
  const { exp, calibration, game } = await loadExperiment({ id: s.experiment_id });
  const item = [...calibration, ...game].find((i) => i.id === input.item_id);
  if (!item) throw new HttpError(400, 'unknown_item');
  if (!(input.attempt >= 1 && input.attempt <= 3)) throw new HttpError(400, 'bad_attempt');

  const events = await sessionEvents(s.id);
  const commits = events.filter((e) => e.type === 'commit');
  let committed: 'truth' | 'lie' = 'truth';

  if (item.section === 'game') {
    const prior = commits.find((e) => e.payload.item_id === item.id);
    if (prior) {
      committed = prior.payload.committed;
    } else {
      if (input.stage !== 'main') throw new HttpError(400, 'commit_first');
      if (input.committed !== 'truth' && input.committed !== 'lie') throw new HttpError(400, 'commit_required');
      const budget = lieBudget(game.length, exp.definition.rules.lies, commits.map((c) => ({ committed: c.payload.committed })));
      if (input.committed === 'lie' && budget.mustTell) throw new HttpError(409, 'no_lies_left', 'Ya usaste tus mentiras.');
      if (input.committed === 'truth' && budget.mustLie) throw new HttpError(409, 'must_lie', 'Te quedan mentiras: esta tiene que ser mentira.');
      committed = input.committed;
      // El compromiso queda guardado antes de transcribir: no se puede cambiar después.
      await addEvent(s.id, s.started_at, 'commit', { item_id: item.id, position: item.position, committed }, `commit:${s.id}:${item.id}`);
    }
  } else if (item.kind === 'obvious_lie') {
    committed = 'lie';
  }

  let transcript = '';
  let words: Awaited<ReturnType<typeof stt>>['words'] = [];
  let sttError: string | null = null;
  if (input.audio && input.audio.size > 800) {
    try {
      const ext = input.mime.includes('mp4') ? 'm4a' : input.mime.includes('ogg') ? 'ogg' : 'webm';
      ({ text: transcript, words } = await stt(input.audio, `answer.${ext}`));
    } catch (e) {
      sttError = e instanceof Error ? e.message : 'stt';
    }
  }
  const wf = wordFeatures(words);
  const type: AnswerType = input.stage === 'follow' ? 'open' : item.answer_type;
  const parsed = parseAnswer(type, transcript, item.option_a && item.option_b ? { a: item.option_a, b: item.option_b } : undefined);
  const features: Features & Record<string, unknown> = {
    ...sanitize(input.features),
    fillers: countFillers(transcript),
    pauses: input.features.pauses ?? wf.internal_pauses,
    words: wf.words,
    first_word_ms: wf.first_word_ms,
  };

  await addEvent(s.id, s.started_at, 'answer', {
    item_id: item.id, position: item.position, section: item.section, stage: input.stage, attempt: input.attempt,
    committed, transcript, parsed: parsed.kind, value: 'value' in parsed ? parsed.value : null, features, stt_error: sttError,
  }, `answer:${s.id}:${item.id}:${input.stage}:${input.attempt}`);

  // Observación: lo dicho, si era verdad o mentira, y la verdad que se deduce.
  const truth = item.section === 'game' && input.stage === 'main' ? truthOf(parsed.kind, committed) : null;
  const isCalibration = item.section === 'calibration' && item.kind === 'calibration';
  await from('signal', 'observations').insert({
    pseudonym_id: s.pseudonym_id, app_slug: 'pressure', instrument_type: 'pressure_detector',
    instrument_id: exp.slug, instrument_version: String(s.content_version),
    stimulus_id: input.stage === 'follow' ? `${item.id}:follow` : item.id,
    stimulus: { prompt: input.stage === 'follow' ? item.follow_up : item.prompt, kind: item.kind, answer_type: type, section: item.section },
    kind: isCalibration ? 'declared' : input.stage === 'follow' || type === 'open' ? 'voice' : 'choice',
    value: { stated: parsed.kind, committed, truth, transcript, number: 'value' in parsed ? parsed.value : null, attempt: input.attempt },
    value_text: truth ?? (transcript || null),
    value_number: 'value' in parsed ? parsed.value : null,
    latency_ms: typeof features.onset_ms === 'number' ? Math.round(features.onset_ms) : null,
    observed_at: new Date().toISOString(), session_id: s.id, position: item.position,
    study_id: item.subthesis_id ? exp.study_id : null, subthesis_id: item.subthesis_id,
    context: { features, replay: s.replay, stage: input.stage },
    quality: committed === 'lie' && !isCalibration ? 'declared_lie' : 'valid',
    quality_note: committed === 'lie' ? 'Mentira declarada por el jugador antes de responder' : null,
    idempotency_key: `pressure:${s.id}:${item.id}:${input.stage}:${input.attempt}`,
  });

  return { transcript, parsed: parsed.kind, committed, stt_ok: !sttError };
}

function sanitize(f: Features): Features {
  const n = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null);
  return {
    decision_ms: n(f.decision_ms, 120_000), onset_ms: n(f.onset_ms, 60_000), speech_ms: n(f.speech_ms, 120_000),
    pauses: n(f.pauses, 100), pitch_mean: n(f.pitch_mean, 1000),
  };
}

/** Cierra la partida: la máquina acusa, se calcula el resultado, se pagan los tickets y se avisa por WhatsApp. */
export async function finish(sessionId: string) {
  const s = await loadSession(sessionId);
  const { exp, calibration, game } = await loadExperiment({ id: s.experiment_id });
  const events = await sessionEvents(s.id);

  if (s.status === 'completed') {
    const done = events.find((e) => e.type === 'finished');
    if (done) return done.payload;
  }
  if (s.status !== 'started') throw new HttpError(409, 'session_closed');

  const answers = events.filter((e) => e.type === 'answer');
  const last = (itemId: string, stage = 'main') => answers.filter((a) => a.payload.item_id === itemId && a.payload.stage === stage).at(-1)?.payload;
  const commitOf = (itemId: string) => events.find((e) => e.type === 'commit' && e.payload.item_id === itemId)?.payload.committed as 'truth' | 'lie' | undefined;

  const missing = game.filter((i) => !commitOf(i.id) || !last(i.id));
  if (missing.length > 0) throw new HttpError(409, 'incomplete', `Faltan ${missing.length} respuestas.`);

  // Rasgos por pregunta: la respuesta principal, y si hubo repregunta, se promedia lo que delata.
  const results: ItemResult[] = game.map((i) => {
    const main = last(i.id)!.features as Features;
    const follow = last(i.id, 'follow')?.features as Features | undefined;
    const merged: Features = { ...main };
    if (follow) {
      merged.pauses = (main.pauses ?? 0) + (follow.pauses ?? 0);
      merged.fillers = (main.fillers ?? 0) + (follow.fillers ?? 0);
    }
    return { id: i.id, position: i.position, committed: commitOf(i.id)!, features: merged };
  });
  const calTruth = calibration.filter((c) => c.kind === 'calibration').map((c) => last(c.id)?.features).filter(Boolean) as Features[];
  const calLie = calibration.filter((c) => c.kind === 'obvious_lie').map((c) => last(c.id)?.features).find(Boolean) as Features | undefined;

  const d = exp.definition;
  const weights = { ...DEFAULT_WEIGHTS, ...(d.weights ?? {}) };
  const picks = accuse(results, d.rules.lies, { truth: calTruth, lie: calLie ?? null }, weights, s.id);
  const paid = !s.replay;
  const o = outcome(results, picks, d.rules, d.rewards, game.length, paid);

  // Tickets: dos asientos, idempotentes. Si el nodo ya cobró por otra vía, la base lo rechaza.
  const node = await must(from('core', 'node_pseudonyms').select('node_id').eq('pseudonym_id', s.pseudonym_id).single(), 'nodo') as any;
  const season = await must(from('economy', 'seasons').select('id').eq('status', 'active').maybeSingle(), 'temporada') as any;
  const entries = [
    o.tickets.progress > 0 && { amount: o.tickets.progress, activity: 'pressure_detector_complete' },
    o.tickets.win > 0 && { amount: o.tickets.win, activity: 'pressure_detector_win' },
  ].filter(Boolean) as { amount: number; activity: string }[];
  for (const e of entries) {
    const { error } = await from('economy', 'ledger').insert({
      node_id: node.node_id, season_id: season?.id ?? null, currency: 'tickets', amount: e.amount, app_slug: 'pressure',
      activity: e.activity, source_type: 'pressure_session', source_id: s.id, idempotency_key: `${e.activity}:${s.id}`,
    });
    if (error && !error.message.includes('idempotency_key')) throw new Error(`tickets: ${error.message}`);
  }

  const endedAt = new Date().toISOString();
  const { error: upErr } = await from('pressure', 'sessions').update({
    status: 'completed', ended_at: endedAt, duration_s: Math.round((Date.parse(endedAt) - Date.parse(s.started_at)) / 1000),
    lies: o.lies, caught: o.caught, verdict: o.verdict, tickets: o.tickets.total,
    outcome: { ...(s.outcome ?? {}), picks: picks.map((p) => ({ item_id: p.id, position: p.position, score: Number(p.score.toFixed(3)), reason: p.reason })), tickets: o.tickets, weights },
  }).eq('id', s.id).eq('status', 'started');
  if (upErr) throw new Error(`cerrar partida: ${upErr.message}`);

  // Calibración: lo que declaró enriquece al nodo (provincia) si no la teníamos.
  const prov = calibration.find((c) => c.kind === 'calibration' && /provincia/i.test(c.prompt));
  const provText = prov ? String(last(prov.id)?.transcript ?? '').replace(/[.¿?¡!]/g, '').trim() : '';
  if (provText && provText.length <= 40) {
    await from('core', 'nodes').update({ province: provText }).eq('id', node.node_id).is('province', null);
  }

  let position: number | null = null;
  let players: number | null = null;
  if (season) {
    const me = await must(from('economy', 'season_ranking').select('position, players').eq('season_id', season.id).eq('node_id', node.node_id).maybeSingle(), 'ranking') as any;
    position = me?.position ?? null;
    players = me?.players ?? null;
  }

  const lines = d.lines as Record<string, string>;
  const claimed = picks.map((p) => {
    const item = game.find((g) => g.id === p.id)!;
    return { ...p, claim: claimFor(last(p.id)?.parsed, item) };
  });
  const accusationLine = accusationText(String(lines.accusation ?? 'Mentiste cuando dijiste {claims}.'), claimed);
  const escaped = o.verdict === 'escaped';

  const payload = {
    verdict: o.verdict,
    caught: o.caught,
    lies: o.lies,
    picks: claimed.map((p) => ({ item_id: p.id, position: p.position, claim: p.claim, reason: reasonText(p) })),
    your_lies: results.filter((r) => r.committed === 'lie').map((r) => r.position),
    tickets: o.tickets,
    replay: s.replay,
    ranking: { position, players },
    lines: {
      accusation: accusationLine,
      verdict: escaped ? lines.win : lines.lose,
      title: escaped ? (lines.result_escaped ?? 'SOS UN GRAN MENTIROSO') : (lines.result_caught ?? 'NO TE DA PARA MENTIRLE A UNA IA'),
    },
  };
  await addEvent(s.id, s.started_at, 'finished', payload, `finished:${s.id}`);

  try {
    await notifyResult(node.node_id, {
      verdict: o.verdict === 'escaped' ? 'ZAFASTE. La máquina no te agarró ninguna.' : `TE AGARRÓ. Te encontró ${o.caught} de ${o.lies} mentiras.`,
      tickets: o.tickets.total,
      position: position ?? '—',
      players: players ?? '—',
    });
  } catch (e) {
    console.error('aviso por WhatsApp', e);
  }
  return payload;
}

/** Si cierra la pestaña a mitad, la partida queda cortada (sin premio, puede volver a empezar). */
export async function abandon(sessionId: string, reason: string) {
  const s = await loadSession(sessionId);
  if (s.status !== 'started') return;
  await from('pressure', 'sessions').update({ status: 'interrupted', ended_at: new Date().toISOString() }).eq('id', s.id).eq('status', 'started');
  await addEvent(s.id, s.started_at, 'interrupted', { reason: reason.slice(0, 80) });
}


// Mismo alias que core.public_alias en la base.
export const publicAlias = (pseudonymId: string) => `NODO-${createHash('md5').update(pseudonymId).digest('hex').slice(0, 4).toUpperCase()}`;

/** Lo único que la máquina puede decir: sus frases, las preguntas y, al final, la acusación. */
export async function allowedSpeech(sessionId: string) {
  const s = await loadSession(sessionId);
  const { exp, calibration, game } = await loadExperiment({ id: s.experiment_id });
  const allowed = new Set<string>();
  for (const v of Object.values(exp.definition.lines ?? {})) {
    if (Array.isArray(v)) v.forEach((x) => allowed.add(String(x)));
    else if (typeof v === 'string' && !v.includes('{')) allowed.add(v);
  }
  for (const i of [...calibration, ...game]) {
    allowed.add(i.prompt);
    if (i.follow_up) allowed.add(i.follow_up);
  }
  game.forEach((i) => allowed.add(`Pregunta ${i.position}.`));
  const done = (await sessionEvents(s.id)).find((e) => e.type === 'finished')?.payload;
  if (done) {
    allowed.add(done.lines.accusation);
    allowed.add(done.lines.verdict);
    done.picks.forEach((p: { reason: string }) => allowed.add(p.reason));
  }
  return { allowed, voice: exp.definition.voice };
}
