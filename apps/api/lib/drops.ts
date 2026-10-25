import 'server-only';
import { env } from './env';
import { from, must } from './db';
import { newCode, sha256, signToken, verifyToken } from './crypto';
import { HttpError } from './http';
import {
  birthDateFromAge, computeClaim, consistencyOf, displayReward, multiplierFor, normalizeWallet, observationOf, parseLocation, POLICY, resolveReward,
  type AnswerBody,
} from './drops-game';

// API del reproductor de Drops (traído del sandbox). Mismo contrato que el servidor viejo,
// sobre la base nueva: nodos en core, señal en signal.observations, tickets y plata en economy.ledger.

// ---------- Acceso: links personales por WhatsApp ----------
// El link es drops.brutal.lat/a/<código>. El reproductor lo canjea por un token firmado (id del link + vencimiento).
// Cada pedido vuelve a mirar el link: si se revoca, deja de servir en el momento.

export type Access = { linkId: string; nodeId: string; purpose: 'onboarding' | 'drop'; destination: 'onboarding' | 'drop' | 'profile'; dropSlug: string | null; expiresAt: string; test: boolean };

const CODE_RE = /^[a-z2-9]{16,40}$/;

/** Crea un link personal. purpose onboarding = completar el perfil; drop = jugar (o ver el perfil). */
export async function createDropsLink(nodeId: string, opts: { purpose: 'onboarding' | 'drop'; destination?: 'drop' | 'profile'; dropSlug?: string | null; hours?: number; test?: boolean }) {
  const code = newCode();
  const hours = Math.min(168, Math.max(1, opts.hours ?? 48));
  const destination = opts.purpose === 'onboarding' ? 'onboarding' : opts.destination ?? 'drop';
  await must(from('core', 'access_links').insert({
    code_hash: await sha256(code), app_slug: 'drops', purpose: opts.test ? 'test' : opts.purpose === 'onboarding' ? 'onboarding' : 'activity',
    node_id: nodeId, target_type: destination, target_id: opts.dropSlug ?? null, max_uses: 50,
    expires_at: new Date(Date.now() + hours * 3600_000).toISOString(),
  }), 'crear link de Drops');
  return { url: `${env.dropsOrigin}/a/${code}`, code };
}

function accessOf(link: any): Access {
  const destination = (['onboarding', 'drop', 'profile'].includes(link.target_type) ? link.target_type : link.purpose === 'onboarding' ? 'onboarding' : 'drop') as Access['destination'];
  return {
    linkId: link.id, nodeId: link.node_id, purpose: destination === 'onboarding' ? 'onboarding' : 'drop', destination,
    dropSlug: link.target_type === 'drop' ? link.target_id ?? null : null, expiresAt: link.expires_at, test: link.purpose === 'test',
  };
}

async function linkById(id: string) {
  const link = await must(from('core', 'access_links').select('id, node_id, app_slug, purpose, target_type, target_id, uses, max_uses, expires_at, revoked_at, first_opened_at')
    .eq('id', id).maybeSingle(), 'link') as any;
  if (!link || link.app_slug !== 'drops' || link.revoked_at || Date.parse(link.expires_at) < Date.now() || !link.node_id) return null;
  return link;
}

/** Canjea el código del link de WhatsApp por el token de la sesión. */
export async function exchangeCode(code: string) {
  if (!CODE_RE.test(code)) throw new HttpError(404, 'invalid_link', 'El link no es válido.');
  const link = await must(from('core', 'access_links').select('id, node_id, app_slug, purpose, target_type, target_id, uses, max_uses, expires_at, revoked_at, first_opened_at')
    .eq('code_hash', await sha256(code)).eq('app_slug', 'drops').maybeSingle(), 'link') as any;
  if (!link || link.revoked_at || !link.node_id) throw new HttpError(404, 'invalid_link', 'El link no es válido. Pedí uno nuevo por WhatsApp.');
  if (Date.parse(link.expires_at) < Date.now()) throw new HttpError(410, 'expired_link', 'El link venció. Escribí por WhatsApp y te llega otro.');
  if (link.uses >= link.max_uses) throw new HttpError(410, 'used_link', 'Este link ya se usó demasiadas veces. Pedí otro por WhatsApp.');
  const now = new Date().toISOString();
  await from('core', 'access_links').update({ uses: link.uses + 1, last_opened_at: now, ...(link.first_opened_at ? {} : { first_opened_at: now }) }).eq('id', link.id);
  const hours = Math.max(0.1, (Date.parse(link.expires_at) - Date.now()) / 3600_000);
  const a = accessOf(link);
  return { token: await signToken(env.sessionSecret, link.id, hours), purpose: a.purpose, destination: a.destination, expiresAt: link.expires_at };
}

export async function accessFrom(req: Request, purpose?: 'onboarding' | 'drop'): Promise<Access> {
  const v = await verifyToken(env.sessionSecret, req.headers.get('x-brutal-access-token'));
  const link = v ? await linkById(v.sessionId) : null;
  if (!link) throw new HttpError(401, 'invalid_access', 'Missing or invalid access link');
  const a = accessOf(link);
  if (purpose && a.purpose !== purpose) throw new HttpError(403, 'wrong_purpose', 'This link is for a different part of BRUTAL');
  return a;
}

// ---------- Nodo ----------
type Node = { id: string; status: string; nickname: string | null; age: number | null; is_minor: boolean; province: string | null; birth_date: string | null; pseudonym_id: string };

async function nodeOf(nodeId: string): Promise<Node> {
  const n = await must(from('core', 'nodes').select('id, status, nickname, birth_date, province').eq('id', nodeId).maybeSingle(), 'nodo') as any;
  if (!n) throw new HttpError(404, 'node_not_found', 'Node not found');
  const f = await must(from('core', 'node_facts').select('age, is_minor').eq('id', nodeId).maybeSingle(), 'datos del nodo') as any;
  const ps = await must(from('core', 'node_pseudonyms').select('pseudonym_id').eq('node_id', nodeId).single(), 'seudónimo') as any;
  return { ...n, age: f?.age ?? null, is_minor: Boolean(f?.is_minor), pseudonym_id: ps.pseudonym_id };
}

const playable = (n: Node, test: boolean) => test || ['active', 'pending'].includes(n.status);
const onboarded = (n: Node) => Boolean(n.nickname && n.birth_date && n.province);

export async function accessContext(a: Access) {
  const n = await nodeOf(a.nodeId);
  if (a.purpose === 'onboarding') return { ok: true, purpose: 'onboarding', expiresAt: a.expiresAt, phoneLast4: null, isTest: a.test };
  return { ok: true, purpose: 'drop', expiresAt: a.expiresAt, nodeId: n.id, nickname: n.nickname, dropId: a.dropSlug, isMinor: n.is_minor, isTest: a.test };
}

// ---------- Drop activo ----------
type Q = { id: string; format: string; label: string; content: Record<string, any>; card_type: string; signal_pair_id: string | null; timer_s: number | null;
  reward_cash_usd: number; reward_tickets: number; reward_minor_tickets: number | null; min_latency_ms: number };
type DQ = { question_id: string; position: number; enabled: boolean; reward_cash_usd: number | null; reward_tickets: number | null; reward_minor_tickets: number | null; questions: Q };
type DropRow = { id: string; slug: string; name: string; status: string; config: any; version: number; study_id: string | null; season_id: string | null; published_at: string | null };

async function dropFor(a: Access): Promise<DropRow | null> {
  let q = from('drops', 'drops').select('id, slug, name, status, config, version, study_id, season_id, published_at');
  if (a.dropSlug) q = q.eq('slug', a.dropSlug);
  if (!(a.test && a.dropSlug)) q = q.eq('status', 'live');
  const rows = await must(q.order('published_at', { ascending: false, nullsFirst: false }).limit(1), 'drop') as DropRow[];
  return rows[0] ?? null;
}

async function cardsOf(dropId: string): Promise<DQ[]> {
  const rows = await must(from('drops', 'drop_questions')
    .select('question_id, position, enabled, reward_cash_usd, reward_tickets, reward_minor_tickets, questions(id, format, label, content, card_type, signal_pair_id, timer_s, reward_cash_usd, reward_tickets, reward_minor_tickets, min_latency_ms)')
    .eq('drop_id', dropId).eq('enabled', true).order('position'), 'cartas') as any[];
  return rows.filter((r) => r.questions) as DQ[];
}

const rewardOf = (c: DQ) => ({
  cash: Number(c.reward_cash_usd ?? c.questions.reward_cash_usd ?? 0),
  tickets: Number(c.reward_tickets ?? c.questions.reward_tickets ?? 0),
  minor: c.reward_minor_tickets ?? c.questions.reward_minor_tickets ?? null,
});

/** El Drop tal como lo espera el reproductor (dbToPlayableDrop del sandbox). */
function playableDrop(d: DropRow, cards: DQ[], node: Node) {
  const cfg = d.config ?? {};
  return {
    id: d.slug,
    name: d.name,
    version: d.version,
    timeoutMessage: cfg.timeoutMessage ?? 'Brutal eligió por vos.',
    multiplierCheckpoints: cfg.multiplierCheckpoints ?? {},
    reveal: cfg.reveal ?? { title: '', description: '', archetypes: [] },
    ...(cfg.splash ? { splash: cfg.splash } : {}),
    questions: cards.map((c) => {
      const q = c.questions;
      const { profileEnrichment: _p, minorReward: _m, reward: _r, ...content } = q.content ?? {};
      const reward = displayReward(resolveReward(rewardOf(c), node.is_minor));
      return {
        questionId: q.id,
        type: q.format,
        ...content,
        timer: q.format === 'dead_drop' ? 0 : content.timer ?? q.timer_s ?? 15,
        ...(reward ? { reward } : {}),
        ...(q.signal_pair_id ? { signalPairId: q.signal_pair_id } : {}),
        cardType: content.cardType ?? q.card_type,
      };
    }),
  };
}

export async function activeDrop(a: Access) {
  const node = await nodeOf(a.nodeId);
  if (!playable(node, a.test)) throw new HttpError(403, 'not_authorized', 'Not authorized');
  const d = await dropFor(a);
  if (!d) throw new HttpError(404, 'no_active_drop', 'No active drop');
  const cards = await cardsOf(d.id);
  if (!cards.length) throw new HttpError(404, 'no_questions', 'Active drop has no questions for this user');
  return playableDrop(d, cards, node);
}

async function sessionOf(pseudonymId: string, dropId: string) {
  return must(from('drops', 'sessions').select('id, status, position, multiplier, claimed_at, started_at').eq('pseudonym_id', pseudonymId).eq('drop_id', dropId).maybeSingle(), 'sesión') as Promise<any>;
}

/** Puerta de entrada: si puede jugar, si ya terminó, si está en espera. */
export async function gate(a: Access) {
  let node: Node;
  try { node = await nodeOf(a.nodeId); } catch { return { status: 'unregistered' }; }
  if (!a.test && ['blocked', 'archived'].includes(node.status)) return { status: 'denied', reason: 'blocked' };
  if (!a.test && node.status === 'waitlisted') return { status: 'denied', reason: 'pending' };
  const d = await dropFor(a);
  if (d && !a.test) {
    const s = await sessionOf(node.pseudonym_id, d.id);
    if (s?.claimed_at) return { status: 'completed' };
  }
  return { status: 'granted', node_id: node.id, nickname: node.nickname, isMinor: node.is_minor, isTest: a.test };
}

// ---------- Partida ----------
export async function startSession(a: Access, body: { drop_id?: string; device?: unknown }) {
  if (!body.drop_id) throw new HttpError(400, 'drop_id_required', 'drop_id required');
  if (a.dropSlug && a.dropSlug !== body.drop_id) throw new HttpError(403, 'wrong_drop', 'Access link is for a different drop');
  const node = await nodeOf(a.nodeId);
  if (!playable(node, a.test)) throw new HttpError(403, 'not_authorized', 'Not authorized');
  const d = await dropFor({ ...a, dropSlug: body.drop_id });
  if (!d) throw new HttpError(404, 'drop_not_active', 'Drop is not active');
  const cards = await cardsOf(d.id);
  if (!cards.length) throw new HttpError(404, 'no_questions', 'Drop has no questions for this node');
  await from('core', 'nodes').update({ last_active_at: new Date().toISOString() }).eq('id', node.id);
  const existing = await sessionOf(node.pseudonym_id, d.id);
  if (existing) {
    if (existing.status === 'completed' || existing.claimed_at) throw new HttpError(409, 'already_completed', 'Already completed');
    return { session_id: existing.id, resumed: true, current_index: existing.position };
  }
  const { data, error } = await from('drops', 'sessions').insert({
    pseudonym_id: node.pseudonym_id, drop_id: d.id, drop_version: d.version, status: 'started', position: 0, multiplier: 1,
    device: typeof body.device === 'object' && body.device ? body.device : {},
  }).select('id').single();
  if (error) {
    // Dos pestañas a la vez: la otra ya la creó.
    const again = await sessionOf(node.pseudonym_id, d.id);
    if (again) return { session_id: again.id, resumed: true, current_index: again.position };
    throw new Error(`sesión: ${error.message}`);
  }
  return { session_id: (data as any).id, resumed: false, current_index: 0 };
}

async function ownedSession(a: Access, sessionId: unknown) {
  if (typeof sessionId !== 'string' || !/^[0-9a-f-]{36}$/.test(sessionId)) throw new HttpError(400, 'session_required', 'session_id required');
  const node = await nodeOf(a.nodeId);
  const s = await must(from('drops', 'sessions').select('id, pseudonym_id, drop_id, drop_version, status, position, multiplier, claimed_at, started_at').eq('id', sessionId).maybeSingle(), 'sesión') as any;
  if (!s || s.pseudonym_id !== node.pseudonym_id) throw new HttpError(409, 'session_not_active', 'Session is not active');
  const d = await must(from('drops', 'drops').select('id, slug, name, status, config, version, study_id, season_id, published_at').eq('id', s.drop_id).single(), 'drop') as DropRow;
  return { node, s, d };
}

export async function recordResponse(a: Access, body: AnswerBody & { session_id?: string; drop_id?: string; question_id?: string; position_in_drop?: number; latency_ms?: number | null; multiplier_at_position?: number }) {
  if (!body.session_id || !body.question_id) throw new HttpError(400, 'bad_request', 'session_id and question_id required');
  const { node, s, d } = await ownedSession(a, body.session_id);
  if (!playable(node, a.test)) throw new HttpError(403, 'not_authorized', 'Not authorized');
  if (s.status !== 'started') throw new HttpError(409, 'session_not_active', 'Session is not active');
  if (body.drop_id && body.drop_id !== d.slug) throw new HttpError(400, 'drop_mismatch', 'Drop does not match session');
  const position = body.position_in_drop;
  if (!Number.isInteger(position) || position! < 0) throw new HttpError(400, 'position_required', 'Response position is required');

  const prior = await must(from('drops', 'answers').select('id, question_id, reward_currency, reward_value, reward_granted').eq('session_id', s.id).eq('position', position!).maybeSingle(), 'respuesta previa') as any;
  if (prior) {
    if (prior.question_id !== body.question_id) throw new HttpError(409, 'position_taken', 'Position already belongs to another question');
    if (s.position === position) await from('drops', 'sessions').update({ position: position! + 1 }).eq('id', s.id).eq('position', position!);
    return { response_id: prior.id, question_id: prior.question_id, reward_granted: prior.reward_granted, reward_type: prior.reward_currency === 'cash_usd' ? 'cash' : prior.reward_currency ? 'golden_ticket' : null, reward_value: Number(prior.reward_value), alreadyRecorded: true };
  }
  if (position !== s.position) throw new HttpError(409, 'out_of_order', 'Response position is out of order');
  const cards = await cardsOf(d.id);
  const card = cards[position!];
  if (!card || card.question_id !== body.question_id) throw new HttpError(400, 'wrong_question', 'Question is not part of this personalized drop position');
  const q = card.questions;

  const latency = typeof body.latency_ms === 'number' && Number.isFinite(body.latency_ms) && body.latency_ms >= 0 ? Math.round(body.latency_ms) : 0;
  const below = latency < (q.min_latency_ms ?? 400);
  const isTrap = q.format === 'trap' || q.format === 'trap_silent';
  const trapCorrect = isTrap ? Number(body.choice_index) === Number(q.content?.correctIndex) : null;
  const r = resolveReward(rewardOf(card), node.is_minor);
  const currency = r.cash > 0 ? 'cash_usd' : r.tickets > 0 ? 'tickets' : null;
  const value = r.cash > 0 ? r.cash : r.tickets;
  const granted = !below && trapCorrect !== false && currency !== null;

  const obs = observationOf(q.format, q.content ?? {}, body);
  const { data: ob, error: obErr } = await from('signal', 'observations').insert({
    pseudonym_id: node.pseudonym_id, app_slug: 'drops', instrument_type: 'drop', instrument_id: d.slug, instrument_version: String(s.drop_version),
    stimulus_id: q.id, stimulus: { format: q.format, label: q.label, text: q.content?.text ?? q.content?.prompt ?? null, card_type: q.card_type, signal_pair_id: q.signal_pair_id },
    kind: obs.kind, value: obs.value, value_text: obs.text, value_number: obs.number, latency_ms: latency || null,
    observed_at: new Date().toISOString(), session_id: s.id, position, study_id: d.study_id,
    context: { multiplier: Number(body.multiplier_at_position) || 1, test: a.test, below_threshold: below },
    quality: trapCorrect === false ? 'trap_failed' : below ? 'automatic' : 'valid',
    quality_note: trapCorrect === false ? 'Falló la trampa' : below ? 'Contestó más rápido de lo que se puede leer' : null,
    idempotency_key: `drops:${s.id}:${position}`,
  }).select('id').single();
  if (obErr && !obErr.message.includes('idempotency_key')) throw new Error(`observación: ${obErr.message}`);

  const { data: ans, error } = await from('drops', 'answers').insert({
    session_id: s.id, position, question_id: q.id, observation_id: (ob as any)?.id ?? null, latency_ms: latency || null,
    reward_currency: currency, reward_value: value, reward_granted: granted, trap_correct: trapCorrect, multiplier_at: Number(body.multiplier_at_position) || 1,
  }).select('id').single();
  if (error) {
    if (error.message.includes('duplicate')) return recordResponse(a, body); // otra pestaña la grabó recién
    throw new Error(`respuesta: ${error.message}`);
  }
  await from('drops', 'sessions').update({ position: position! + 1 }).eq('id', s.id).eq('position', position!);
  return { response_id: (ans as any).id, below_threshold: below, reward_granted: granted, reward_type: currency === 'cash_usd' ? 'cash' : currency ? 'golden_ticket' : null, reward_value: value };
}

export async function completeSession(a: Access, body: { session_id?: string; archetype_result?: unknown; bic_scores?: unknown }) {
  const { s, d } = await ownedSession(a, body.session_id);
  if (s.status === 'completed') return { ok: true, alreadyCompleted: true };
  if (s.status !== 'started') throw new HttpError(409, 'session_not_active', 'Session is not active');
  const cards = await cardsOf(d.id);
  const answers = await must(from('drops', 'answers').select('position, latency_ms, trap_correct, created_at').eq('session_id', s.id).order('position'), 'respuestas') as any[];
  if (answers.length < cards.length) throw new HttpError(409, 'unanswered', 'Session still has unanswered questions');
  const traps = answers.filter((x) => x.trap_correct !== null);
  const passed = traps.filter((x) => x.trap_correct).length;
  const lat = answers.map((x) => x.latency_ms).filter((x) => typeof x === 'number');
  const now = new Date();
  await must(from('drops', 'sessions').update({
    status: 'completed', completed_at: now.toISOString(), total_ms: Math.max(0, now.getTime() - Date.parse(s.started_at)),
    multiplier: multiplierFor(d.config?.multiplierCheckpoints, answers.length),
    traps_passed: passed, traps_failed: traps.length - passed,
    avg_latency_ms: lat.length ? Math.round(lat.reduce((p, c) => p + c, 0) / lat.length) : null,
    consistency: consistencyOf(answers), archetype: body.archetype_result ?? null, bic_scores: body.bic_scores ?? null,
  }).eq('id', s.id).eq('status', 'started'), 'cerrar sesión');
  return { ok: true, trap_score: `${passed}/${traps.length}` };
}

/** Acredita lo ganado en el Drop. Idempotente: dos veces no paga dos veces. */
export async function claimDrop(a: Access, body: { dropId?: string; drop_id?: string }) {
  const slug = body.dropId ?? body.drop_id;
  if (!slug) throw new HttpError(400, 'drop_required', 'Retiros de plata: todavía se piden por WhatsApp.');
  const node = await nodeOf(a.nodeId);
  const d = await must(from('drops', 'drops').select('id, slug, season_id, config').eq('slug', slug).maybeSingle(), 'drop') as any;
  if (!d) throw new HttpError(404, 'session_not_found', 'Session not found');
  const s = await sessionOf(node.pseudonym_id, d.id);
  if (!s) throw new HttpError(404, 'session_not_found', 'Session not found');
  if (s.claimed_at) return { ok: true, alreadyClaimed: true };
  if (s.status !== 'completed') throw new HttpError(409, 'not_completed', 'Session is not completed');
  const answers = await must(from('drops', 'answers').select('position, reward_currency, reward_value, reward_granted, trap_correct, questions(content)').eq('session_id', s.id), 'respuestas') as any[];
  const total = computeClaim(answers.map((x) => ({ ...x, reward_value: Number(x.reward_value), penalty: Number(x.questions?.content?.penalty) || 0 })), Number(s.multiplier) || 1);
  const season = d.season_id ?? (await must(from('economy', 'seasons').select('id').eq('status', 'active').maybeSingle(), 'temporada') as any)?.id ?? null;
  const entries = [
    total.usd > 0 && !node.is_minor && { currency: 'cash_usd', amount: total.usd, key: `drop_cash:${s.id}` },
    total.tickets > 0 && { currency: 'tickets', amount: total.tickets, key: `drop_tickets:${s.id}` },
  ].filter(Boolean) as { currency: string; amount: number; key: string }[];
  for (const e of entries) {
    const { error } = await from('economy', 'ledger').insert({
      node_id: node.id, season_id: season, currency: e.currency, amount: e.amount, app_slug: 'drops', activity: 'drop_complete',
      source_type: 'drop_session', source_id: s.id, idempotency_key: e.key,
    });
    if (error && !error.message.includes('idempotency_key')) throw new HttpError(409, 'claim_failed', error.message);
  }
  await from('drops', 'sessions').update({ claimed_at: new Date().toISOString() }).eq('id', s.id).is('claimed_at', null);
  const usd = node.is_minor ? 0 : total.usd;
  return { ok: true, alreadyClaimed: false, credited: { usd, coins: usd, tickets: total.tickets } };
}

// ---------- Perfil, billetera, ranking ----------
export async function userProfile(a: Access) {
  const node = await nodeOf(a.nodeId);
  const n = await must(from('core', 'nodes').select('created_at, last_active_at').eq('id', node.id).single(), 'nodo') as any;
  const bal = await must(from('economy', 'balances').select('cash_usd, tickets, tickets_lifetime').eq('node_id', node.id).maybeSingle(), 'saldo') as any;
  const season = await must(from('economy', 'seasons').select('id').eq('status', 'active').maybeSingle(), 'temporada') as any;
  const st = season ? await must(from('economy', 'season_tickets').select('tickets').eq('season_id', season.id).eq('node_id', node.id).maybeSingle(), 'tickets temporada') as any : null;
  const wallet = await must(from('economy', 'wallets').select('alias').eq('node_id', node.id).maybeSingle(), 'billetera') as any;
  const { count } = await from('drops', 'sessions').select('id', { count: 'exact', head: true }).eq('pseudonym_id', node.pseudonym_id).eq('status', 'completed');
  const tx = await must(from('economy', 'ledger').select('id, currency, amount, app_slug, activity, source_id, created_at').eq('node_id', node.id).order('created_at', { ascending: false }).limit(20), 'movimientos') as any[];
  return {
    profile: {
      nodeId: node.id, username: node.nickname, firstName: node.nickname, lastName: '', walletAlias: wallet?.alias ?? null,
      totalCoins: Number(bal?.cash_usd ?? 0), seasonTickets: Number(st?.tickets ?? 0), lifetimeTickets: Number(bal?.tickets_lifetime ?? 0),
      dropsCompleted: count ?? 0, botQuestionsAnswered: 0, firstSeen: n.created_at, lastActiveAt: n.last_active_at ?? n.created_at,
    },
    transactions: tx.map((t) => ({
      txId: String(t.id), nodeId: node.id, rewardType: t.currency === 'cash_usd' ? 'coins' : 'tickets', rewardValue: Number(t.amount),
      source: t.app_slug === 'drops' ? 'drop' : t.app_slug ?? t.activity, sourceId: t.source_id, createdAt: t.created_at,
    })),
  };
}

export async function setWallet(a: Access, body: { walletAlias?: string; wallet_alias?: string }) {
  const node = await nodeOf(a.nodeId);
  if (node.is_minor) throw new HttpError(403, 'minor', 'Los menores de 18 no usan billetera de cobro');
  const alias = normalizeWallet(body.walletAlias ?? body.wallet_alias);
  if (!alias) throw new HttpError(400, 'bad_wallet', 'Alias de billetera inválido');
  await must(from('economy', 'wallets').upsert({ node_id: node.id, alias, updated_at: new Date().toISOString() }), 'billetera');
  return { ok: true };
}

export async function economyPolicy(a: Access) {
  const node = await nodeOf(a.nodeId);
  return { ...POLICY, isMinor: node.is_minor };
}

export async function leaderboard(limit = 20) {
  const season = await must(from('economy', 'seasons').select('id, slug, name, starts_at, ends_at, status, prizes, created_at').eq('status', 'active').maybeSingle(), 'temporada') as any;
  if (!season) return { season: null, leaderboard: [], totalUsers: 0 };
  const rows = await must(from('economy', 'season_ranking').select('node_id, alias, tickets, position, players').eq('season_id', season.id).order('position').limit(Math.min(100, Math.max(1, limit))), 'ranking') as any[];
  const names = rows.length ? await must(from('core', 'nodes').select('id, nickname').in('id', rows.map((r) => r.node_id)), 'apodos') as any[] : [];
  const nick = new Map(names.map((x) => [x.id, x.nickname]));
  const prizes = Array.isArray(season.prizes) ? season.prizes : Object.entries(season.prizes ?? {}).map(([position, v]: [string, any]) => ({ position: Number(position), ...(typeof v === 'object' ? v : { description: String(v) }) }));
  return {
    season: { seasonId: season.id, name: season.name, startDate: season.starts_at ?? season.created_at, endDate: season.ends_at ?? null, prizes, prizeImageUrl: null, active: true, createdAt: season.created_at },
    leaderboard: rows.map((r) => ({
      position: Number(r.position), nodeId: r.node_id, username: nick.get(r.node_id) || r.alias, firstName: nick.get(r.node_id) || r.alias,
      seasonTickets: Number(r.tickets), lifetimeTickets: Number(r.tickets), dropsCompleted: 0, botQuestionsAnswered: 0,
    })),
    totalUsers: Number(rows[0]?.players ?? 0),
  };
}

// ---------- Onboarding ----------
async function nextAfterOnboarding(node: Node) {
  const d = await dropFor({ linkId: '', nodeId: node.id, purpose: 'drop', destination: 'drop', dropSlug: null, expiresAt: '', test: false });
  if (!d) return { nextAction: 'waitlist', dropUrl: null, dropId: null, dropName: null };
  const s = await sessionOf(node.pseudonym_id, d.id);
  if (s?.claimed_at) return { nextAction: 'waitlist', dropUrl: null, dropId: null, dropName: null };
  const link = await createDropsLink(node.id, { purpose: 'drop', dropSlug: d.slug, hours: 48 });
  return { nextAction: 'drop', dropUrl: link.url, dropId: d.slug, dropName: d.name };
}

export async function applyInit(a: Access) {
  const node = await nodeOf(a.nodeId);
  const base = { ok: true, nodeId: node.id, status: node.status, onboardingStep: onboarded(node) ? 100 : 0, referralCode: null };
  if (onboarded(node) && playable(node, a.test)) return { ...base, ...(await nextAfterOnboarding(node)) };
  return { ...base, nextAction: 'onboarding', dropUrl: null, dropId: null, dropName: null };
}

export async function apply(a: Access, b: Record<string, any>) {
  const node = await nodeOf(a.nodeId);
  const nickname = String(b.nickname ?? '').trim().slice(0, 40);
  const age = Number.parseInt(String(b.age ?? ''), 10);
  const gender = String(b.gender ?? '').trim().slice(0, 40) || null;
  const loc = b.location_province ? { province: String(b.location_province).slice(0, 80), city: b.location_city ? String(b.location_city).slice(0, 80) : null } : parseLocation(b.location);
  const platforms = Array.isArray(b.platforms) ? [...new Set(b.platforms.map((p: unknown) => String(p).slice(0, 40)))].slice(0, 12) : [];
  if (!nickname || !(age >= 15 && age <= 35) || !gender || !loc.province || platforms.length === 0) {
    throw new HttpError(400, 'incomplete_profile', 'Incomplete or invalid onboarding profile');
  }
  const now = new Date().toISOString();
  await must(from('core', 'nodes').update({
    nickname, birth_date: birthDateFromAge(age), gender, province: loc.province, city: loc.city,
    ...(['pending', 'waitlisted'].includes(node.status) ? { status: 'active' } : {}), last_active_at: now,
  }).eq('id', node.id), 'guardar perfil');
  // Lo que declaró queda como señal del nodo (las plataformas no tienen columna propia).
  await from('signal', 'observations').insert({
    pseudonym_id: node.pseudonym_id, app_slug: 'drops', instrument_type: 'onboarding', instrument_id: 'onboarding', instrument_version: '1',
    stimulus_id: 'platforms', stimulus: { prompt: '¿Qué redes usás?' }, kind: 'declared', value: { platforms }, value_text: platforms.join(', '),
    observed_at: now, idempotency_key: `onboarding:platforms:${node.id}:${now.slice(0, 10)}`,
  });
  const fresh = await nodeOf(node.id);
  const next = await nextAfterOnboarding(fresh);
  return { ok: true, applicationId: node.id, referralCode: null, queuePosition: 0, whatsappNoticeStatus: null, ...next, dropAccessExpiresAt: null };
}
