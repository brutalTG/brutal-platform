// Reglas del detector. Funciones puras: no tocan la base ni la red, así se prueban solas.

export type AnswerType = 'yes_no' | 'agree' | 'number' | 'open' | 'choice';
export type Parsed =
  | { kind: 'yes' | 'no' | 'agree' | 'disagree' | 'a' | 'b'; text: string }
  | { kind: 'number'; value: number; text: string }
  | { kind: 'open'; text: string }
  | { kind: 'unclear'; text: string };

export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const YES = ['si', 'sip', 'sii', 'obvio', 'claro', 're', 'obviamente', 'afirmativo', 'por supuesto', 'seguro', 'mal', 'banda', 'una banda', 'totalmente', 'de una'];
const NO = ['no', 'nop', 'nunca', 'jamas', 'ni en pedo', 'para nada', 'ni ahi', 'cero', 'nada que ver', 'ni loco', 'ni loca', 'negativo'];
const AGREE = ['de acuerdo', 'si', 'obvio', 'totalmente', 'coincido', 'claro', 'banco', 'lo banco', 'obviamente', 'sip', 'tal cual', 're', 'de una', 'estoy de acuerdo'];
const DISAGREE = ['en desacuerdo', 'no estoy de acuerdo', 'no', 'para nada', 'ni ahi', 'cero', 'nada que ver', 'ni en pedo', 'jamas', 'nunca', 'ni loco', 'ni loca'];

// Busca la primera expresión que aparece. "No, obvio que no" es no; "Sí, no sé" es sí.
function firstMatch(t: string, options: Record<string, string[]>): string | null {
  let best: { key: string; at: number; len: number } | null = null;
  for (const [key, list] of Object.entries(options)) {
    for (const phrase of list) {
      const m = new RegExp(`(^| )${phrase}( |$)`).exec(t);
      if (!m) continue;
      const at = m.index + (m[1] ? 1 : 0);
      if (!best || at < best.at || (at === best.at && phrase.length > best.len)) best = { key, at, len: phrase.length };
    }
  }
  return best?.key ?? null;
}

const UNITS: Record<string, number> = {
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21, veintidos: 22, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
};
const SMALL: Record<string, number> = { uno: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9 };

export function parseNumber(text: string): number | null {
  const t = normalize(text);
  const digits = /\b(\d{1,3})\b/.exec(t);
  if (digits) return Number(digits[1]);
  const words = t.split(' ');
  for (let i = 0; i < words.length; i++) {
    const base = UNITS[words[i]];
    if (base === undefined) continue;
    if (base >= 30 && words[i + 1] === 'y' && SMALL[words[i + 2]] !== undefined) return base + SMALL[words[i + 2]];
    return base;
  }
  return null;
}

// Dilema: "la primera", "la segunda" o palabras de la opción. Se comparan raíces de 4 letras
// para que "denuncio" cuente como "lo denunciás".
const ORD_A = ['la primera', 'el primero', 'lo primero', 'primera', 'primero', 'la uno', 'la a', 'opcion a'];
const ORD_B = ['la segunda', 'el segundo', 'lo segundo', 'segunda', 'segundo', 'la dos', 'la b', 'opcion b'];
const STOP = new Set(['para', 'pero', 'aunque', 'nunca', 'todo', 'todos', 'sobre', 'desde', 'hasta', 'como', 'donde', 'cuando', 'porque', 'sin', 'con', 'que', 'una', 'uno', 'los', 'las', 'del', 'por', 'tus', 'sus', 'mas']);
function stems(label: string) {
  return normalize(label).split(' ').filter((w) => w.length >= 4 && !STOP.has(w)).map((w) => w.slice(0, 4));
}
function firstHit(t: string, label: string, ordinals: string[]) {
  let at = Infinity;
  for (const o of ordinals) { const m = new RegExp(`(^| )${o}( |$)`).exec(t); if (m) at = Math.min(at, m.index); }
  const words = t.split(' ');
  let pos = 0;
  const st = stems(label);
  for (const w of words) { if (w.length >= 4 && st.includes(w.slice(0, 4))) { at = Math.min(at, pos); break; } pos += w.length + 1; }
  return at;
}
export function parseChoice(transcript: string, a: string, b: string): Parsed {
  const text = transcript.trim();
  const t = normalize(text);
  if (!t) return { kind: 'unclear', text };
  const ha = firstHit(t, a, ORD_A), hb = firstHit(t, b, ORD_B);
  if (ha === Infinity && hb === Infinity) return { kind: 'unclear', text };
  return { kind: ha <= hb ? 'a' : 'b', text };
}

export function parseAnswer(type: AnswerType, transcript: string, options?: { a: string; b: string }): Parsed {
  if (type === 'choice' && options) return parseChoice(transcript, options.a, options.b);
  const text = transcript.trim();
  const t = normalize(text);
  if (!t) return { kind: 'unclear', text };
  if (type === 'open') return { kind: 'open', text };
  if (type === 'number') {
    const value = parseNumber(text);
    return value === null ? { kind: 'unclear', text } : { kind: 'number', value, text };
  }
  // "No sé", "depende": no es ni sí ni no. La máquina repregunta.
  if (/^(no se|ni idea|depende|mas o menos|capaz|puede ser|que se yo)( |$)/.test(t)) return { kind: 'unclear', text };
  if (type === 'yes_no') {
    const k = firstMatch(t, { yes: YES, no: NO });
    return k ? { kind: k as 'yes' | 'no', text } : { kind: 'unclear', text };
  }
  const k = firstMatch(t, { disagree: DISAGREE, agree: AGREE });
  return k ? { kind: k as 'agree' | 'disagree', text } : { kind: 'unclear', text };
}

// Si mintió en una respuesta binaria, la verdad es la opuesta.
export function truthOf(stated: Parsed['kind'], committed: 'truth' | 'lie'): string | null {
  const opposite: Record<string, string> = { yes: 'no', no: 'yes', agree: 'disagree', disagree: 'agree', a: 'b', b: 'a' };
  if (!(stated in opposite)) return null;
  return committed === 'lie' ? opposite[stated] : stated;
}

// ---------- El detector ----------

export type Features = {
  decision_ms?: number | null; // del fin de la pregunta a marcar verdad/mentira
  onset_ms?: number | null; // de abrir el micrófono a empezar a hablar
  speech_ms?: number | null; // cuánto habló
  pauses?: number | null; // silencios de más de 400 ms en el medio
  fillers?: number | null; // "eh", "este", "o sea"...
  pitch_mean?: number | null; // tono medio en Hz
  lie_press_ms?: number | null; // cuándo tocó MENTIR desde que empezó a escuchar (no entra en la acusación)
};

export type ItemResult = { id: string; position: number; committed: 'truth' | 'lie'; features: Features };
export type Weights = Record<'decision' | 'onset' | 'speech' | 'pauses' | 'fillers' | 'pitch', number>;

export const DEFAULT_WEIGHTS: Weights = { decision: 1.2, onset: 1.0, speech: 0.5, pauses: 0.6, fillers: 0.6, pitch: 0.4 };

const FEATURE_OF: Record<keyof Weights, keyof Features> = {
  decision: 'decision_ms', onset: 'onset_ms', speech: 'speech_ms', pauses: 'pauses', fillers: 'fillers', pitch: 'pitch_mean',
};

function stats(values: number[]) {
  const n = values.length;
  if (n === 0) return { mean: 0, sd: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  return { mean, sd };
}

// Hash estable para desempatar sin azar: la misma partida da siempre la misma acusación.
function jitter(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1e5;
}

export type Accusation = { id: string; position: number; score: number; reason: keyof Weights; value: number | null };

/**
 * Elige en qué respuestas mintió. Compara cada respuesta contra el resto de las de la misma persona.
 * La dirección de "habló más o menos" la decide la calibración: cómo le cambió la voz al mentir a propósito.
 */
export function accuse(
  items: ItemResult[],
  howMany: number,
  calibration: { truth: Features[]; lie: Features | null },
  weights: Weights = DEFAULT_WEIGHTS,
  seed = '',
): Accusation[] {
  const truthSpeech = stats(calibration.truth.map((f) => f.speech_ms ?? NaN).filter(Number.isFinite)).mean;
  const lieSpeech = calibration.lie?.speech_ms;
  const speechDir = lieSpeech != null && truthSpeech > 0 ? (lieSpeech >= truthSpeech ? 1 : -1) : -1;

  const z: Record<string, Partial<Record<keyof Weights, number>>> = {};
  for (const w of Object.keys(weights) as (keyof Weights)[]) {
    const f = FEATURE_OF[w];
    const vals = items.map((i) => i.features[f]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const { mean, sd } = stats(vals);
    for (const it of items) {
      const v = it.features[f];
      z[it.id] ??= {};
      if (typeof v !== 'number' || !Number.isFinite(v) || sd === 0) { z[it.id][w] = 0; continue; }
      const raw = (v - mean) / sd;
      z[it.id][w] = w === 'speech' ? raw * speechDir : raw;
    }
  }

  const scored = items.map((it) => {
    let score = 0;
    let top: keyof Weights = 'decision';
    let topVal = -Infinity;
    for (const w of Object.keys(weights) as (keyof Weights)[]) {
      const contrib = (z[it.id][w] ?? 0) * weights[w];
      score += contrib;
      if (contrib > topVal) { topVal = contrib; top = w; }
    }
    return { id: it.id, position: it.position, score: score + jitter(seed + it.id), reason: top, value: it.features[FEATURE_OF[top]] ?? null };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, howMany).sort((a, b) => a.position - b.position);
}

const nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

export function reasonText(a: Accusation): string {
  const v = a.value;
  switch (a.reason) {
    case 'decision': return v != null ? `En la ${a.position} dudaste ${nf.format(v / 1000)} segundos antes de decidir.` : `En la ${a.position} dudaste.`;
    case 'onset': return v != null ? `En la ${a.position} tardaste ${nf.format(v / 1000)} segundos en arrancar a hablar.` : `En la ${a.position} arrancaste tarde.`;
    case 'speech': return `En la ${a.position} hablaste distinto que cuando decís la verdad.`;
    case 'pauses': return v != null && v > 0 ? `En la ${a.position} te frenaste ${v} ${v === 1 ? 'vez' : 'veces'} en el medio.` : `En la ${a.position} te frenaste.`;
    case 'fillers': return `En la ${a.position} rellenaste con "este" y "eh".`;
    case 'pitch': return `En la ${a.position} te subió la voz.`;
  }
}

export type Outcome = {
  lies: number;
  caught: number;
  verdict: 'caught' | 'escaped';
  tickets: { progress: number; win: number; total: number };
};

export function outcome(
  items: ItemResult[],
  picks: Accusation[],
  rules: { win_max_caught: number },
  rewards: { per_answer: number; max: number; win_bonus: number },
  answered: number,
  paid: boolean,
): Outcome {
  const liesSet = new Set(items.filter((i) => i.committed === 'lie').map((i) => i.id));
  const caught = picks.filter((p) => liesSet.has(p.id)).length;
  const verdict = caught <= rules.win_max_caught ? 'escaped' : 'caught';
  const progress = paid ? Math.min(rewards.max, Math.max(0, answered) * rewards.per_answer) : 0;
  const win = paid && verdict === 'escaped' ? rewards.win_bonus : 0;
  return { lies: liesSet.size, caught, verdict, tickets: { progress, win, total: progress + win } };
}

// Cuántas mentiras le quedan y si está obligado a mentir o a decir la verdad.
export function lieBudget(totalItems: number, lies: number, answered: { committed: 'truth' | 'lie' }[]) {
  const used = answered.filter((a) => a.committed === 'lie').length;
  const remainingLies = lies - used;
  const remainingItems = totalItems - answered.length;
  return {
    remainingLies,
    remainingItems,
    mustLie: remainingLies > 0 && remainingLies >= remainingItems,
    mustTell: remainingLies <= 0,
  };
}

const FILLERS = ['eh', 'em', 'emm', 'ehh', 'este', 'o sea', 'bueno', 'nada', 'tipo', 'mmm', 'eeh'];
export function countFillers(transcript: string) {
  const t = ` ${normalize(transcript)} `;
  return FILLERS.reduce((n, f) => n + (t.split(` ${f} `).length - 1), 0);
}

// ---------- La acusación con las palabras del jugador ----------

/** Lo que "dijo" el jugador en una pregunta, para acusarlo: "que stalkeaste a un ex". */
export function claimFor(stated: string | undefined, item: { position: number; claim_yes: string | null; claim_no: string | null }) {
  if ((stated === 'yes' || stated === 'agree' || stated === 'a') && item.claim_yes) return item.claim_yes;
  if ((stated === 'no' || stated === 'disagree' || stated === 'b') && item.claim_no) return item.claim_no;
  return `lo que contestaste en la ${item.position}`;
}

/** "a", "a y b", "a, b y c". */
export function joinClaims(claims: string[]) {
  if (claims.length <= 1) return claims[0] ?? '';
  return `${claims.slice(0, -1).join(', ')} y ${claims.at(-1)}`;
}

/** Arma la frase de la acusación. Soporta el formato nuevo ({claims}) y el viejo ({a}, {b}, {c}). */
export function accusationText(template: string, picks: { position: number; claim: string }[]) {
  if (template.includes('{claims}')) return template.replace('{claims}', joinClaims(picks.map((p) => p.claim)));
  return template.replace('{a}', String(picks[0]?.position ?? '')).replace('{b}', String(picks[1]?.position ?? '')).replace('{c}', String(picks[2]?.position ?? ''));
}

/** ¿Se hace la repregunta? Solo si coincide con lo que respondió. */
export function shouldFollowUp(when: 'always' | 'yes' | 'no', stated: string | undefined) {
  if (when === 'always') return true;
  if (when === 'yes') return stated === 'yes' || stated === 'agree' || stated === 'a';
  return stated === 'no' || stated === 'disagree' || stated === 'b';
}

// ---------- Mayor o menor ----------
export const DEFAULT_LADDER = [1.5, 2, 3, 5, 10];

/** Carta del 1 (as) al 13 (rey). */
export function drawCard(rand: () => number = Math.random) {
  return 1 + Math.floor(rand() * 13);
}

/** El empate cuenta como acierto. */
export function hiloOk(current: number, next: number, guess: 'higher' | 'lower') {
  return guess === 'higher' ? next >= current : next <= current;
}

/** Multiplica los tickets de la partida. */
export function applyMultiplier(t: { progress: number; win: number; total: number }, m: number) {
  const k = Number.isFinite(m) && m > 0 ? m : 1;
  const progress = Math.round(t.progress * k), win = Math.round(t.win * k);
  return { progress, win, total: progress + win, multiplier: k };
}
