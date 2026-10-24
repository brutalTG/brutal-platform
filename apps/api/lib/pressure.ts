import 'server-only';
import { createHash } from 'node:crypto';
import { env } from './env';
import { db, from, must } from './db';
import { sha256, signToken } from './crypto';
import { HttpError } from './http';
import { stt, wordFeatures } from './elevenlabs';
import {
  accuse, accusationText, applyMultiplier, DEFAULT_LADDER, drawCard, hiloOk, claimFor, countFillers, DEFAULT_WEIGHTS, lieBudget, outcome, parseAnswer, reasonText, truthOf,
  type AnswerType, type Features, type ItemResult, type Weights,
} from './game';
import { notifyResult } from './messaging';

type Item = {
  id: string; section: 'calibration' | 'game' | 'rafaga'; position: number; kind: string; prompt: string;
  screen_text: string | null; answer_type: AnswerType; follow_up: string | null; subthesis_id: string | null;
  follow_up_when: 'always' | 'yes' | 'no'; claim_yes: string | null; claim_no: string | null;
  option_a: string | null; option_b: string | null;
  media_url: string | null; emoji_a: string | null; emoji_b: string | null; echo: boolean; correct: 'a' | 'b' | null;
};
type Definition = {
  pitch: string[];
  rules: { lies: number; win_max_caught: number };
  rewards: { per_answer: number; max: number; win_bonus: number };
  voice: { voice_id: string; fallback_voice_id?: string; model?: string };
  lines: Record<string, string | string[]>;
  weights?: Partial<Weights>;
  stages?: { rafaga?: boolean; hilo?: boolean; vuelta?: boolean };
  rafaga?: { seconds?: number };
  hilo?: { multipliers?: number[] };
};
type Experiment = { id: string; slug: string; name: string; status: string; content_version: number; study_id: string | null; definition: Definition };

export async function loadExperiment(by: { slug?: string; id?: string }) {
  let q = from('pressure', 'experiments').select('id, slug, name, status, content_version, study_id, definition');
  q = by.id ? q.eq('id', by.id) : q.eq('slug', by.slug!);
  const exp = await must(q.maybeSingle(), 'experimento') as Experiment | null;
  if (!exp) throw new HttpError(404, 'experiment_not_found');
  const items = await must(from('pressure', 'items')
    .select('id, section, position, kind, prompt, screen_text, answer_type, follow_up, follow_up_when, claim_yes, claim_no, option_a, option_b, subthesis_id, media_url, emoji_a, emoji_b, echo, correct')
    .eq('experiment_id', exp.id).eq('enabled', true).order('section').order('position'), 'preguntas') as Item[];
  const calibration = items.filter((i) => i.section === 'calibration').sort((a, b) => a.position - b.position);
  const game = items.filter((i) => i.section === 'game').sort((a, b) => a.position - b.position);
  const st = stagesOf(exp.definition);
  const rafaga = st.rafaga ? items.filter((i) => i.section === 'rafaga').sort((a, b) => a.position - b.position) : [];
  // Las que vuelven por voz al final. Se puede mentir en ellas igual que en las del juego.
  const vuelta = st.vuelta ? rafaga.filter((i) => i.echo) : [];
  return { exp, calibration, game, rafaga, vuelta, voiced: [...game, ...vuelta] };
}

export const stagesOf = (d: Definition) => ({ rafaga: d.stages?.rafaga ?? false, hilo: d.stages?.hilo ?? false, vuelta: d.stages?.vuelta ?? false });
export const ladderOf = (d: Definition) => (d.hilo?.multipliers?.length ? d.hilo.multipliers : DEFAULT_LADDER);
// Número que se muestra y se usa en la acusación: las de la vuelta van después de las del juego.
const shownPosition = (i: Item, game: Item[]) => (i.section === 'rafaga' ? game.length + i.position : i.position);

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
  entry_note: 'Es anónimo: no te vamos a pedir ningún dato personal. Tus respuestas quedan grabadas.',
  consent: '*Es con voz.* La máquina pregunta en voz alta y vos contestás hablando. Ponete auriculares o andá a un lugar tranquilo.\n\nTus respuestas quedan grabadas, sin tu nombre.\n\nLlegar al final: hasta *{max} Golden Tickets*. Ganarle a la máquina: *+{bonus}*.',
  consent_note: '3 minutos. Al entrar se activa el micrófono.',
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
  const exp = await must(from('pressure', 'experiments').select('id, definition, status').eq('slug', link.target_id).single(), 'experimento') as any;
  if (!['testing', 'live'].includes(exp.status)) throw new HttpError(409, 'not_open', 'La máquina está apagada por ahora.');
  return { pitch: exp.definition.pitch ?? [], screens: screensOf(exp.definition), rewards: exp.definition.rewards, playing: await playingNow(exp.id) };
}

/** Cuántos están jugando ahora: partidas abiertas en los últimos 15 minutos. Número real, nunca inventado. */
async function playingNow(experimentId: string) {
  const { count } = await from('pressure', 'sessions').select('id', { count: 'exact', head: true })
    .eq('experiment_id', experimentId).eq('status', 'started').gte('started_at', new Date(Date.now() - 15 * 60_000).toISOString());
  return count ?? 0;
}

// ---------- Audios ----------
const AUDIO_BUCKET = 'pressure-audio';
let audioBucketReady = false;

/** Guarda una respuesta hablada en el depósito privado. Devuelve la ruta, o null si no pudo. */
async function saveAudio(sessionId: string, name: string, audio: Blob, mime: string) {
  try {
    const st = db().storage;
    if (!audioBucketReady) {
      const { data } = await st.getBucket(AUDIO_BUCKET);
      if (!data) await st.createBucket(AUDIO_BUCKET, { public: false, fileSizeLimit: 8_000_000 });
      audioBucketReady = true;
    }
    const path = `${sessionId}/${name}`;
    const { error } = await st.from(AUDIO_BUCKET).upload(path, audio, { contentType: mime || 'audio/webm', upsert: true });
    if (error) { console.error('audio', error.message); return null; }
    // Una fila por partida: dónde están sus audios y hasta cuándo se guardan (12 meses).
    await from('pressure', 'recordings').upsert({ session_id: sessionId, audio_path: `${AUDIO_BUCKET}/${sessionId}/` }, { onConflict: 'session_id', ignoreDuplicates: true });
    return path;
  } catch (e) {
    console.error('audio', e);
    return null;
  }
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

  const { exp, calibration, game, rafaga, vuelta, voiced } = await loadExperiment({ slug: link.target_id });
  if (!['testing', 'live'].includes(exp.status)) throw new HttpError(409, 'not_open', 'La máquina está apagada por ahora.');
  if (voiced.length < exp.definition.rules.lies + 1) throw new HttpError(409, 'not_ready', 'El juego no está listo.');

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
      stages: stagesOf(d),
      rafaga: rafaga.map((i) => ({ id: i.id, position: i.position, kind: i.kind === 'trap' ? 'trap' : 'flash', screen_text: i.screen_text ?? i.prompt, media_url: i.media_url, emoji_a: i.emoji_a, emoji_b: i.emoji_b })),
      rafaga_seconds: d.rafaga?.seconds ?? 3,
      vuelta: vuelta.map((i) => ({ ...publicItem(i), position: shownPosition(i, game), media_url: i.media_url, emoji_a: i.emoji_a, emoji_b: i.emoji_b })),
      hilo: { ladder: ladderOf(d) },
      // En test se puede mostrar un número fijo (Ajustes → "Jugando"); si no, el real.
      playing: typeof (d as any).playing_display === 'number' ? (d as any).playing_display : Math.max(1, await playingNow(exp.id)),
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
  const { exp, calibration, game, voiced } = await loadExperiment({ id: s.experiment_id });
  const item = [...calibration, ...voiced].find((i) => i.id === input.item_id);
  if (!item) throw new HttpError(400, 'unknown_item');
  if (!(input.attempt >= 1 && input.attempt <= 3)) throw new HttpError(400, 'bad_attempt');

  const events = await sessionEvents(s.id);
  const commits = events.filter((e) => e.type === 'commit');
  let committed: 'truth' | 'lie' = 'truth';

  const isPlay = item.section !== 'calibration';
  if (isPlay) {
    const prior = commits.find((e) => e.payload.item_id === item.id);
    if (prior) {
      committed = prior.payload.committed;
    } else {
      if (input.stage !== 'main') throw new HttpError(400, 'commit_first');
      if (input.committed !== 'truth' && input.committed !== 'lie') throw new HttpError(400, 'commit_required');
      const budget = lieBudget(voiced.length, exp.definition.rules.lies, commits.map((c) => ({ committed: c.payload.committed })));
      if (input.committed === 'lie' && budget.mustTell) throw new HttpError(409, 'no_lies_left', 'Ya usaste tus mentiras.');
      if (input.committed === 'truth' && budget.mustLie) throw new HttpError(409, 'must_lie', 'Te quedan mentiras: esta tiene que ser mentira.');
      committed = input.committed;
      // El compromiso queda guardado antes de transcribir: no se puede cambiar después.
      await addEvent(s.id, s.started_at, 'commit', { item_id: item.id, position: shownPosition(item, game), committed }, `commit:${s.id}:${item.id}`);
    }
  } else if (item.kind === 'obvious_lie') {
    committed = 'lie';
  }

  let transcript = '';
  let words: Awaited<ReturnType<typeof stt>>['words'] = [];
  let sttError: string | null = null;
  let audioPath: string | null = null;
  if (input.audio && input.audio.size > 800) {
    const ext = input.mime.includes('mp4') ? 'm4a' : input.mime.includes('ogg') ? 'ogg' : 'webm';
    // El audio se guarda en paralelo a la transcripción: si guardar falla, el juego sigue.
    const saving = saveAudio(s.id, `${item.section}-${item.position}-${input.stage}-${input.attempt}.${ext}`, input.audio, input.mime);
    try {
      ({ text: transcript, words } = await stt(input.audio, `answer.${ext}`));
    } catch (e) {
      sttError = e instanceof Error ? e.message : 'stt';
    }
    audioPath = await saving;
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
    committed, transcript, parsed: parsed.kind, value: 'value' in parsed ? parsed.value : null, features, stt_error: sttError, audio_path: audioPath,
  }, `answer:${s.id}:${item.id}:${input.stage}:${input.attempt}`);

  // Observación: lo dicho, si era verdad o mentira, y la verdad que se deduce.
  const truth = isPlay && input.stage === 'main' ? truthOf(parsed.kind, committed) : null;
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
    context: { features, replay: s.replay, stage: input.stage, audio_path: audioPath },
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
    pauses: n(f.pauses, 100), pitch_mean: n(f.pitch_mean, 1000), lie_press_ms: n(f.lie_press_ms, 120_000),
  };
}

/** Cierra la partida: la máquina acusa, se calcula el resultado, se pagan los tickets y se avisa por WhatsApp. */
export async function finish(sessionId: string) {
  const s = await loadSession(sessionId);
  const { exp, calibration, game, voiced } = await loadExperiment({ id: s.experiment_id });
  const events = await sessionEvents(s.id);

  if (s.status === 'completed') {
    const done = events.find((e) => e.type === 'finished');
    if (done) return done.payload;
  }
  if (s.status !== 'started') throw new HttpError(409, 'session_closed');

  const answers = events.filter((e) => e.type === 'answer');
  const last = (itemId: string, stage = 'main') => answers.filter((a) => a.payload.item_id === itemId && a.payload.stage === stage).at(-1)?.payload;
  const commitOf = (itemId: string) => events.find((e) => e.type === 'commit' && e.payload.item_id === itemId)?.payload.committed as 'truth' | 'lie' | undefined;

  const missing = voiced.filter((i) => !commitOf(i.id) || !last(i.id));
  if (missing.length > 0) throw new HttpError(409, 'incomplete', `Faltan ${missing.length} respuestas.`);

  // Rasgos por pregunta: la respuesta principal, y si hubo repregunta, se promedia lo que delata.
  const results: ItemResult[] = voiced.map((i) => {
    const main = last(i.id)!.features as Features;
    const follow = last(i.id, 'follow')?.features as Features | undefined;
    const merged: Features = { ...main };
    if (follow) {
      merged.pauses = (main.pauses ?? 0) + (follow.pauses ?? 0);
      merged.fillers = (main.fillers ?? 0) + (follow.fillers ?? 0);
    }
    return { id: i.id, position: shownPosition(i, game), committed: commitOf(i.id)!, features: merged };
  });
  const calTruth = calibration.filter((c) => c.kind === 'calibration').map((c) => last(c.id)?.features).filter(Boolean) as Features[];
  const calLie = calibration.filter((c) => c.kind === 'obvious_lie').map((c) => last(c.id)?.features).find(Boolean) as Features | undefined;

  const d = exp.definition;
  const weights = { ...DEFAULT_WEIGHTS, ...(d.weights ?? {}) };
  const picks = accuse(results, d.rules.lies, { truth: calTruth, lie: calLie ?? null }, weights, s.id);
  const paid = !s.replay;
  const o = outcome(results, picks, d.rules, d.rewards, voiced.length, paid);
  // Mayor o menor: el multiplicador que se llevó (si no jugó o perdió, x1).
  const hiloDone = events.find((e) => e.type === 'hilo_done')?.payload;
  const multiplier = stagesOf(d).hilo && hiloDone ? Number(hiloDone.multiplier) || 1 : 1;
  o.tickets = applyMultiplier(o.tickets, multiplier);

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
    const item = voiced.find((g) => g.id === p.id)!;
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
    lies_detail: results.filter((r) => r.committed === 'lie').map((r) => {
      const it = voiced.find((v) => v.id === r.id)!;
      return { item_id: r.id, text: it.screen_text ?? it.prompt, got: picks.some((p) => p.id === r.id) };
    }),
    multiplier,
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
  const { exp, calibration, game, voiced } = await loadExperiment({ id: s.experiment_id });
  const allowed = new Set<string>();
  for (const v of Object.values(exp.definition.lines ?? {})) {
    if (Array.isArray(v)) v.forEach((x) => allowed.add(String(x)));
    else if (typeof v === 'string' && !v.includes('{')) allowed.add(v);
  }
  for (const i of [...calibration, ...voiced]) {
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


// ---------- Ráfaga al tacto ----------
export type TapInput = { item_id: string; choice: 'a' | 'b' | null; latency_ms: number | null };

/** Los toques de la ráfaga, todos juntos al terminarla. Cada uno queda como observación con su latencia. */
export async function recordTaps(sessionId: string, taps: TapInput[]) {
  const s = await loadSession(sessionId);
  if (s.status !== 'started') throw new HttpError(409, 'session_closed', 'Esta partida ya terminó.');
  const { exp, rafaga } = await loadExperiment({ id: s.experiment_id });
  let trapsFailed = 0;
  for (const t of taps.slice(0, 40)) {
    const item = rafaga.find((i) => i.id === t.item_id);
    if (!item) continue;
    const choice = t.choice === 'a' || t.choice === 'b' ? t.choice : null;
    const latency = typeof t.latency_ms === 'number' && t.latency_ms >= 0 && t.latency_ms < 60_000 ? Math.round(t.latency_ms) : null;
    const trapFailed = item.kind === 'trap' && choice !== item.correct;
    if (trapFailed) trapsFailed++;
    await addEvent(s.id, s.started_at, 'tap', { item_id: item.id, position: item.position, choice, latency_ms: latency, trap_failed: trapFailed || undefined }, `tap:${s.id}:${item.id}`);
    await from('signal', 'observations').insert({
      pseudonym_id: s.pseudonym_id, app_slug: 'pressure', instrument_type: 'pressure_detector',
      instrument_id: exp.slug, instrument_version: String(s.content_version),
      stimulus_id: `${item.id}:tap`,
      stimulus: { prompt: item.screen_text ?? item.prompt, kind: item.kind, section: 'rafaga', emoji_a: item.emoji_a, emoji_b: item.emoji_b, media_url: item.media_url },
      kind: 'choice',
      value: { choice, emoji: choice === 'a' ? item.emoji_a : choice === 'b' ? item.emoji_b : null, timed_out: choice === null },
      value_text: choice === 'a' ? item.emoji_a : choice === 'b' ? item.emoji_b : null,
      latency_ms: latency,
      observed_at: new Date().toISOString(), session_id: s.id, position: item.position,
      study_id: item.subthesis_id ? exp.study_id : null, subthesis_id: item.subthesis_id,
      context: { replay: s.replay, stage: 'tap', echo: item.echo },
      quality: trapFailed ? 'trap_failed' : choice === null ? 'automatic' : 'valid',
      quality_note: trapFailed ? 'Falló la trampa de atención' : choice === null ? 'No tocó a tiempo' : null,
      idempotency_key: `pressure:${s.id}:${item.id}:tap`,
    });
  }
  return { ok: true, traps_failed: trapsFailed };
}

// ---------- Mayor o menor ----------
type HiloView = { card: number; next?: number; ok?: boolean; step: number; multiplier: number; ladder: number[]; done: boolean; busted?: boolean };

/** El mazo lo maneja la API: el navegador no sabe qué carta viene. */
export async function hilo(sessionId: string, action: 'start' | 'higher' | 'lower' | 'stand', atStep?: number): Promise<HiloView> {
  const s = await loadSession(sessionId);
  const { exp } = await loadExperiment({ id: s.experiment_id });
  if (!stagesOf(exp.definition).hilo) throw new HttpError(409, 'hilo_off');
  const ladder = ladderOf(exp.definition);
  const events = await sessionEvents(s.id);
  const guessesSoFar = events.filter((e) => e.type === 'hilo_guess').map((e) => e.payload);
  // Reintento de una apuesta que ya se procesó (se cortó la red): devuelve lo mismo, no saca otra carta.
  if ((action === 'higher' || action === 'lower') && typeof atStep === 'number' && atStep < guessesSoFar.length) {
    const g = guessesSoFar[atStep];
    const finished = !g.ok || atStep + 1 >= ladder.length;
    return { card: g.ok ? g.next : g.card, next: g.next, ok: g.ok, step: g.ok ? atStep + 1 : atStep, multiplier: g.ok ? ladder[atStep] : 1, ladder, done: finished, busted: !g.ok };
  }
  const done = events.find((e) => e.type === 'hilo_done')?.payload;
  if (done) return { card: done.last_card, step: done.steps, multiplier: done.multiplier, ladder, done: true, busted: done.busted };
  if (s.status !== 'started') throw new HttpError(409, 'session_closed');

  const cards = events.filter((e) => e.type === 'hilo_card').map((e) => e.payload.card as number);
  const guesses = events.filter((e) => e.type === 'hilo_guess').map((e) => e.payload);
  const step = guesses.length;
  const multiplier = step === 0 ? 1 : ladder[step - 1];

  if (cards.length === 0) {
    const card = drawCard();
    await addEvent(s.id, s.started_at, 'hilo_card', { index: 0, card }, `hilo_card:${s.id}:0`);
    return { card, step: 0, multiplier: 1, ladder, done: false };
  }
  const current = cards.at(-1)!;
  if (action === 'start') return { card: current, step, multiplier, ladder, done: false };

  // steps = aciertos. decisions = cada apuesta con la carta que tenía enfrente.
  const close = async (mult: number, busted: boolean, lastCard: number, stood: boolean, steps: number, latest?: Record<string, unknown>) => {
    const decisions = [...guesses, ...(latest ? [latest] : [])];
    await addEvent(s.id, s.started_at, 'hilo_done', { multiplier: mult, steps, busted, stood, last_card: lastCard }, `hilo_done:${s.id}`);
    await from('signal', 'observations').insert({
      pseudonym_id: s.pseudonym_id, app_slug: 'pressure', instrument_type: 'pressure_detector',
      instrument_id: exp.slug, instrument_version: String(s.content_version),
      stimulus_id: 'hilo', stimulus: { prompt: 'Mayor o menor', ladder },
      kind: 'game_move',
      value: { stood, busted, steps, multiplier: mult, card_when_stood: stood ? lastCard : null, decisions },
      value_text: stood ? `se plantó en x${mult}` : busted ? `perdió después de ${steps} aciertos` : `llegó al tope x${mult}`,
      value_number: mult,
      observed_at: new Date().toISOString(), session_id: s.id, position: null,
      context: { replay: s.replay },
      quality: 'valid',
      idempotency_key: `pressure:${s.id}:hilo`,
    });
  };

  if (action === 'stand') {
    await close(multiplier, false, current, true, step);
    return { card: current, step, multiplier, ladder, done: true, busted: false };
  }
  const next = drawCard();
  const ok = hiloOk(current, next, action);
  const guess = { step, card: current, guess: action, next, ok };
  await addEvent(s.id, s.started_at, 'hilo_guess', guess, `hilo_guess:${s.id}:${step}`);
  await addEvent(s.id, s.started_at, 'hilo_card', { index: cards.length, card: next }, `hilo_card:${s.id}:${cards.length}`);
  if (!ok) {
    await close(1, true, next, false, step, guess);
    return { card: current, next, ok, step, multiplier: 1, ladder, done: true, busted: true };
  }
  const reached = ladder[step];
  if (step + 1 >= ladder.length) {
    await close(reached, false, next, false, step + 1, guess);
    return { card: next, next, ok, step: step + 1, multiplier: reached, ladder, done: true, busted: false };
  }
  return { card: next, next, ok, step: step + 1, multiplier: reached, ladder, done: false };
}
