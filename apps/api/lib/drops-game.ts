// Reglas de Drops sin base de datos (se prueban solas). Mismas reglas que el sandbox (server/node-domain.ts).

export const POLICY = {
  currency: 'USD',
  withdrawalMinimum: 10,
  minorAgeMinimum: 15,
  minorAgeMaximumExclusive: 18,
  minorCashEnabled: false, // nunca: un menor no cobra efectivo
  minorTicketsPerCashReward: 1,
} as const;

export type Reward = { cash: number; tickets: number; minor: number | null };

/** Lo que cobra un nodo por una carta. Menor: nunca plata; tickets explícitos o 1 por cada premio en plata. */
export function resolveReward(r: Reward, isMinor: boolean): { cash: number; tickets: number } {
  const cash = Math.max(0, Number(r.cash) || 0), tickets = Math.max(0, Math.floor(Number(r.tickets) || 0));
  if (!isMinor) return { cash, tickets };
  if (r.minor !== null && r.minor !== undefined) return { cash: 0, tickets: Math.max(0, Math.floor(r.minor)) };
  return { cash: 0, tickets: tickets > 0 ? tickets : cash > 0 ? POLICY.minorTicketsPerCashReward : 0 };
}

/** Premio que ve el jugador en la carta: plata si hay, si no tickets. */
export function displayReward(r: { cash: number; tickets: number }) {
  if (r.cash > 0) return { type: 'coins' as const, value: r.cash };
  if (r.tickets > 0) return { type: 'tickets' as const, value: r.tickets };
  return undefined;
}

/** El multiplicador más alto que alcanzó: los checkpoints con índice menor a las cartas contestadas. */
export function multiplierFor(checkpoints: Record<string, { multiplier?: number }> | undefined, answered: number) {
  let m = 1;
  for (const [k, v] of Object.entries(checkpoints ?? {})) {
    const idx = Number(k), mult = Number(v?.multiplier);
    if (Number.isFinite(idx) && idx < answered && Number.isFinite(mult) && mult > m) m = mult;
  }
  return m;
}

export type AnswerRow = { position: number; reward_currency: 'cash_usd' | 'tickets' | null; reward_value: number; reward_granted: boolean; trap_correct: boolean | null; penalty: number };

/** Lo que se acredita al reclamar. Una trampa fallada resta tickets acumulados (nunca plata). El multiplicador solo multiplica tickets. */
export function computeClaim(answers: AnswerRow[], multiplier: number) {
  let usd = 0, tickets = 0;
  for (const a of [...answers].sort((x, y) => x.position - y.position)) {
    if (a.trap_correct === false) { tickets = Math.max(0, tickets - (Number(a.penalty) || 0)); continue; }
    if (!a.reward_granted) continue;
    if (a.reward_currency === 'cash_usd') usd = Math.round((usd + Number(a.reward_value)) * 100) / 100;
    else if (a.reward_currency === 'tickets') tickets += Number(a.reward_value);
  }
  return { usd, tickets: Math.floor(tickets * Math.max(1, Number(multiplier) || 1)) };
}

export type VoiceAnswer = {
  transcript: string; stated: string | null; number: number | null; audio_path: string | null; speech_ms: number | null; words: number; first_word_ms: number | null;
  /** Carta de la máquina: qué marcó en secreto y cuánto tardó en decidirlo. */
  committed?: 'truth' | 'lie'; decision_ms?: number | null;
};
export type HiloResult = { status: string; multiplier: number; steps: number; cards: number[]; decisions: string[] };

export type AnswerBody = {
  choice_index?: number | null; slider_value?: number | null; ranking_result?: unknown[] | null;
  rafaga_choices?: unknown[] | null; text_response?: string | null; choice?: string | null;
  voice?: VoiceAnswer | null; hilo?: HiloResult | null;
  /** Detalle fino que manda el reproductor: latencia por ítem, toques, correcciones, apuesta, salidas de la app. */
  meta?: unknown;
};

/** El detalle fino, saneado: solo un objeto chico (hasta 4 KB), sin funciones ni anidamiento raro. Si no sirve, null. */
export function cleanMeta(raw: unknown): Record<string, unknown> | null {
  let v = raw;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return null; } }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const s = JSON.stringify(v);
  if (!s || s.length > 4096 || s === '{}') return null;
  return JSON.parse(s) as Record<string, unknown>;
}

/** Cómo queda la respuesta en signal.observations (con el detalle fino en value.meta). */
export function observationOf(format: string, content: Record<string, any>, b: AnswerBody) {
  const o = observationCore(format, content, b);
  const meta = cleanMeta(b.meta);
  return meta ? { ...o, value: { ...(o.value as Record<string, unknown>), meta } } : o;
}

function observationCore(format: string, content: Record<string, any>, b: AnswerBody) {
  const options: unknown[] = Array.isArray(content.options) ? content.options : [];
  if (format === 'voice') {
    const v = b.voice;
    if (!v) return { kind: 'voice', value: { silent: true }, text: null, number: null };
    const word = v.stated === 'a' ? content.optionA ?? 'A' : v.stated === 'b' ? content.optionB ?? 'B' : v.stated;
    return { kind: 'voice', value: { ...v }, text: word && !['open', 'unclear'].includes(word) ? String(word) : v.transcript || null, number: v.number };
  }
  if (format === 'mayor_menor') {
    const h = b.hilo;
    if (!h) return { kind: 'game_move', value: { status: 'timeout', multiplier: 1, steps: 0 }, text: 'no jugó', number: 1 };
    const text = h.status === 'busted' ? `perdió después de ${h.steps} aciertos` : h.status === 'timeout' ? 'no terminó' : `se plantó en x${h.multiplier}`;
    return { kind: 'game_move', value: { ...h }, text, number: h.multiplier };
  }
  if (typeof b.choice_index === 'number') {
    const option = options[b.choice_index] ?? null;
    return { kind: 'choice', value: { index: b.choice_index, option }, text: option == null ? String(b.choice_index) : String(option), number: b.choice_index };
  }
  if (typeof b.slider_value === 'number') return { kind: 'scale', value: { value: b.slider_value }, text: null, number: b.slider_value };
  if (Array.isArray(b.ranking_result)) return { kind: 'ranking', value: { order: b.ranking_result }, text: b.ranking_result.join(' > '), number: null };
  if (Array.isArray(b.rafaga_choices)) return { kind: 'choice', value: { choices: b.rafaga_choices }, text: null, number: null };
  if (b.choice === 'A' || b.choice === 'B') return { kind: 'choice', value: { side: b.choice }, text: b.choice, number: null };
  if (format === 'confesionario') return { kind: 'text', value: { submitted: true }, text: null, number: null };
  return { kind: 'behavior', value: { timeout: format !== 'dead_drop', viewed: format === 'dead_drop' }, text: null, number: null };
}

/** Qué tan bien coinciden las latencias que manda el teléfono con el tiempo real entre respuestas (0 = perfecto). */
export function consistencyOf(rows: { latency_ms: number | null; created_at: string }[]) {
  if (rows.length < 3) return null;
  const diffs: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const delta = Date.parse(rows[i].created_at) - Date.parse(rows[i - 1].created_at);
    if (delta < 100 || rows[i].latency_ms == null) continue;
    diffs.push(Math.abs(Number(rows[i].latency_ms) - delta));
  }
  if (diffs.length < 2) return null;
  return Math.min(1, diffs.reduce((a, b) => a + b, 0) / diffs.length / 10000);
}

export const normalizeWallet = (raw: unknown) => {
  const v = String(raw ?? '').trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9._-]{3,80}$/.test(v) ? v : null;
};

/** Edad (años cumplidos) a fecha de nacimiento aproximada: hoy menos esa cantidad de años. */
export function birthDateFromAge(age: number, now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear() - age, now.getUTCMonth(), now.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

/** "Provincia > Ciudad" o "Provincia — Ciudad". */
export function parseLocation(raw: unknown) {
  const s = String(raw ?? '').trim();
  if (!s) return { province: null, city: null };
  const [p, c] = s.split(/\s*(?:>|—|-)\s*/);
  return { province: p?.slice(0, 80) || null, city: c?.slice(0, 80) || null };
}

// ---------- Mayor o menor ----------
export const HILO_LADDER = [1.5, 2, 3, 5, 10];
export type Hand = { cards: number[]; decisions: string[]; status: 'playing' | 'stood' | 'busted' | 'timeout'; multiplier: number };
export type HiloAction = 'start' | 'higher' | 'lower' | 'stand';

const okGuess = (cur: number, next: number, g: string) => (g === 'higher' ? next >= cur : next <= cur);

/** Un paso de la mano. El servidor saca la carta; el teléfono solo ve la que tiene enfrente. Reintentos no sacan otra carta. */
export function hiloStep(hand: Hand | null, action: HiloAction, ladder: number[] = HILO_LADDER, draw: () => number = () => 1 + Math.floor(Math.random() * 13), atStep?: number): Hand {
  const h: Hand = hand ? { ...hand, cards: [...hand.cards], decisions: [...hand.decisions] } : { cards: [draw()], decisions: [], status: 'playing', multiplier: 1 };
  if (action === 'start' || h.status !== 'playing') return h;
  if (typeof atStep === 'number' && atStep < h.decisions.length) return h;
  if (action === 'stand') return { ...h, status: 'stood' };
  const cur = h.cards[h.cards.length - 1], next = draw();
  h.cards.push(next);
  h.decisions.push(action);
  if (!okGuess(cur, next, action)) return { ...h, status: 'busted', multiplier: 1 };
  const step = h.decisions.length;
  return { ...h, multiplier: ladder[Math.min(step, ladder.length) - 1], status: step >= ladder.length ? 'stood' : 'playing' };
}

/** Lo que ve el jugador de la mano. */
export function hiloView(h: Hand, ladder: number[] = HILO_LADDER) {
  const steps = h.status === 'busted' ? h.decisions.length - 1 : h.decisions.length;
  const lastOk = h.decisions.length === 0 ? null : h.status !== 'busted';
  return {
    card: h.status === 'busted' ? h.cards[h.cards.length - 2] : h.cards[h.cards.length - 1],
    next: h.decisions.length ? h.cards[h.cards.length - 1] : null,
    ok: lastOk, step: steps, multiplier: h.multiplier, ladder, done: h.status !== 'playing', busted: h.status === 'busted',
  };
}

/** Multiplicador final de la partida: checkpoints por avanzar × lo que se ganó en las manos de mayor o menor. */
export const sessionMultiplier = (checkpoint: number, hands: { status: string; multiplier: number }[]) =>
  Math.round(hands.reduce((m, h) => (h.status === 'stood' ? m * Math.max(1, Number(h.multiplier) || 1) : m), checkpoint) * 100) / 100;

// ---------- La máquina dentro del Drop ----------
// Cartas de voz con `detector: true`: antes de hablar el jugador marca en secreto VERDAD o MENTIRA.
// Tiene que mentir exactamente `lies` veces en el Drop. Al cerrar, la máquina acusa `lies` cartas
// comparando cómo habló en cada una (dudó más, arrancó tarde, habló menos, rellenó).
// Te agarra si encuentra TODAS tus mentiras; si se le escapa al menos una, zafaste.

export type DetectorConfig = { lies: number; winTickets: number; loseTickets: number };
export const DEFAULT_DETECTOR: DetectorConfig = { lies: 1, winTickets: 150, loseTickets: 50 };

export function detectorConfig(raw: unknown): DetectorConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const n = (v: unknown, d: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : d);
  return { lies: Math.max(1, n(r.lies, DEFAULT_DETECTOR.lies)), winTickets: n(r.winTickets, DEFAULT_DETECTOR.winTickets), loseTickets: n(r.loseTickets, DEFAULT_DETECTOR.loseTickets) };
}

export type DetectorItem = { position: number; committed: 'truth' | 'lie'; decision_ms: number | null; onset_ms: number | null; speech_ms: number | null; fillers: number };
export type DetectorResult = {
  lies: number[]; accused: number[]; caught: number; verdict: 'caught' | 'escaped';
  reason: { position: number; kind: 'decision' | 'onset' | 'speech' | 'fillers'; value: number | null };
  tickets: number;
};

const WEIGHTS = { decision: 1.2, onset: 1.0, speech: 0.5, fillers: 0.6 } as const;
type Feature = keyof typeof WEIGHTS;
const FEATURE_OF: Record<Feature, keyof DetectorItem> = { decision: 'decision_ms', onset: 'onset_ms', speech: 'speech_ms', fillers: 'fillers' };

function zscores(items: DetectorItem[], f: keyof DetectorItem) {
  const vals = items.map((i) => Number(i[f])).filter((v) => Number.isFinite(v));
  const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const sd = vals.length ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) : 0;
  return items.map((i) => { const v = Number(i[f]); return sd > 0 && Number.isFinite(v) ? (v - mean) / sd : 0; });
}

// Desempate estable: la misma partida acusa siempre igual.
function jitter(seed: string, salt: number) {
  let h = 2166136261;
  for (const ch of `${seed}:${salt}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1e5;
}

/** Qué cartas acusa la máquina y cómo le fue al jugador. Hace falta al menos dos cartas para comparar. */
export function detectorOutcome(items: DetectorItem[], cfg: DetectorConfig, seed = ''): DetectorResult | null {
  if (items.length < 2) return null;
  const z: Record<Feature, number[]> = {
    decision: zscores(items, 'decision_ms'), onset: zscores(items, 'onset_ms'), fillers: zscores(items, 'fillers'),
    // Mentir suele salir más corto: hablar menos que en el resto suma sospecha.
    speech: zscores(items, 'speech_ms').map((v) => -v),
  };
  const scored = items.map((it, i) => {
    let score = 0, top: Feature = 'decision', topVal = -Infinity;
    for (const f of Object.keys(WEIGHTS) as Feature[]) {
      const c = z[f][i] * WEIGHTS[f];
      score += c;
      if (c > topVal) { topVal = c; top = f; }
    }
    return { position: it.position, score: score + jitter(seed, it.position), reason: top, value: it[FEATURE_OF[top]] as number | null };
  });
  const howMany = Math.min(cfg.lies, items.length - 1);
  const picks = [...scored].sort((a, b) => b.score - a.score).slice(0, howMany).sort((a, b) => a.position - b.position);
  const lies = items.filter((i) => i.committed === 'lie').map((i) => i.position);
  const caught = picks.filter((p) => lies.includes(p.position)).length;
  const verdict = lies.length > 0 && caught >= lies.length ? 'caught' : 'escaped';
  const first = picks[0];
  return {
    lies, accused: picks.map((p) => p.position), caught, verdict,
    reason: { position: first.position, kind: first.reason, value: first.value },
    tickets: verdict === 'escaped' ? cfg.winTickets : -cfg.loseTickets,
  };
}

const nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

/** La acusación, en palabras. `label` es cómo se nombra la carta ("la segunda"). */
export function detectorReason(r: DetectorResult, label: (position: number) => string) {
  const { kind, value, position } = r.reason;
  const at = label(position);
  switch (kind) {
    case 'decision': return value != null ? `En ${at} dudaste ${nf.format(value / 1000)} segundos antes de decidir.` : `En ${at} dudaste antes de decidir.`;
    case 'onset': return value != null ? `En ${at} tardaste ${nf.format(value / 1000)} segundos en arrancar a hablar.` : `En ${at} arrancaste tarde.`;
    case 'speech': return `En ${at} hablaste menos que en las otras.`;
    case 'fillers': return `En ${at} rellenaste con "eh" y "este".`;
  }
}

const ORDINAL = ['la primera', 'la segunda', 'la tercera', 'la cuarta', 'la quinta', 'la sexta'];

/** Cómo se nombra una carta de la máquina en el veredicto: su `detectorLabel` ("la del famoso") o, si no tiene, el orden. */
export function detectorLabel(content: { detectorLabel?: unknown } | null | undefined, position: number) {
  const own = typeof content?.detectorLabel === 'string' ? content.detectorLabel.trim() : '';
  return own || (ORDINAL[position - 1] ?? `la ${position}`);
}

/** Lo que la máquina dice en una carta del veredicto. */
export type DetectorCard = { position: number; text: string; label: string; said: string; lied: boolean; accused: boolean };
export type DetectorVerdictOut = DetectorResult & { text: string; lie_labels: string[]; cards: DetectorCard[] };

/** Los únicos textos que la voz de BRUTAL puede decir en un Drop: las cartas de voz y la presentación de la máquina. */
export function voiceScript(cards: { format: string; content?: Record<string, any> | null }[]) {
  const out: string[] = [];
  for (const c of cards) {
    const content = c.content ?? {};
    if (c.format === 'voice' && content.speak !== false && content.text) out.push(String(content.text));
    if (c.format === 'dead_drop' && content.machine === true && typeof content.speakText === 'string' && content.speakText) out.push(content.speakText);
  }
  return out;
}

/** Cuántas mentiras le quedan y si en la próxima carta está obligado. */
export function detectorBudget(total: number, lies: number, committed: ('truth' | 'lie')[]) {
  const used = committed.filter((c) => c === 'lie').length;
  const remainingLies = Math.max(0, lies - used);
  const remainingItems = Math.max(0, total - committed.length);
  return { remainingLies, remainingItems, mustLie: remainingLies > 0 && remainingLies >= remainingItems, mustTell: remainingLies <= 0 };
}

/** Tickets de la partida con lo que dio la máquina: nunca por debajo de cero. */
export function applyDetector(tickets: number, result: DetectorResult | null | undefined) {
  if (!result) return tickets;
  return Math.max(0, tickets + (Number(result.tickets) || 0));
}

// ---------- Link de grupo ----------
// Un solo link para muchos: cada uno pone un apodo y queda como un nodo de prueba separado.
// Los nodos de grupo llevan un teléfono inventado (+999…) para no confundirse con números reales.

export type JoinConfig = { code: string; open: boolean; max: number };

export function joinConfig(raw: unknown): JoinConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const code = String(r.code ?? '').trim().toLowerCase();
  if (!/^[a-z0-9-]{3,40}$/.test(code)) return null;
  const max = Number(r.max);
  return { code, open: r.open !== false, max: Number.isFinite(max) && max > 0 ? Math.min(500, Math.floor(max)) : 50 };
}

/** Apodo de una persona del grupo: 2 a 20 caracteres visibles, sin saltos de línea. */
export function cleanNickname(raw: unknown) {
  const s = String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  return s.length >= 2 ? s : null;
}

export const GUEST_PREFIX = '+999';
export function guestPhone(rand: () => number = Math.random) {
  let digits = '';
  for (let i = 0; i < 11; i++) digits += Math.floor(rand() * 10);
  return `${GUEST_PREFIX}${digits}`;
}
export const isGuestPhone = (phone: string | null | undefined) => Boolean(phone && phone.startsWith(GUEST_PREFIX));
