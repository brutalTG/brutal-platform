// Latencia corregida por lectura. El tiempo de respuesta incluye leer, así que el tiempo crudo no se lee.
// tiempo esperado = ritmo de la persona × (4,25 s + 0,12 s × palabras leídas hasta la opción elegida)
// duda = tiempo real ÷ tiempo esperado. Más de 1,3: duda. Menos de 0,8: reflejo. En el medio: normal.
// El ritmo de cada persona es la mediana de (real ÷ esperado sin ritmo) en todas sus respuestas.
// Sin base de datos: se prueba solo (latency.test.ts).

import { answersOf, baseStimulus, usable, type Facts, type Obs, type Options, type StimulusMeta } from './results.ts';

export const READ_BASE_MS = 4250;
export const READ_PER_WORD_MS = 120;
export const DUDA = 1.3;
export const REFLEJO = 0.8;

export const words = (s: unknown) => (String(s ?? '').match(/[\p{L}\p{N}]+/gu) ?? []).length;
const clean = (x: unknown) => String(x ?? '').trim();
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const r2 = (x: number) => Math.round(x * 100) / 100;

export type LatencySample = {
  person: string;
  /** stimulus_id; en las ráfagas, `${id}#${ítem}`. */
  key: string;
  /** Elección: la respuesta elegida. Ráfaga: 'A' o 'B'. Escala y ranking: null. */
  choice: string | null;
  ms: number;
  words: number;
  /** Tiempo esperado sin el ritmo de la persona. */
  baseMs: number;
  /** Las ráfagas se comparan solo con ráfagas: un ítem se contesta en uno o dos segundos, no en cuatro. */
  group: 'carta' | 'rafaga';
};

/** Palabras que hay que leer hasta llegar a la opción elegida (si no se encuentra, todas). */
function upTo(options: string[], chosen: string | null) {
  const i = chosen == null ? -1 : options.map(clean).indexOf(clean(chosen));
  const list = i >= 0 ? options.slice(0, i + 1) : options;
  return list.reduce((a, o) => a + words(o), 0);
}

const SKIP_KINDS = new Set(['behavior', 'text', 'voice']);

/** Una muestra por respuesta con tiempo (en las ráfagas, una por ítem). Sin pruebas, sin automáticas, sin tiempos agotados. */
export function latencySamples(obs: Obs[], facts: Map<string, Facts>, meta: Map<string, StimulusMeta>, opt: Omit<Options, 'cut'>): LatencySample[] {
  const out: LatencySample[] = [];
  for (const o of obs) {
    if (!usable(o, facts.get(o.pseudonym_id), { ...opt, cut: 'none' })) continue;
    if (SKIP_KINDS.has(o.kind) || o.value?.timed_out || 'committed' in (o.value ?? {}) || 'stated' in (o.value ?? {})) continue;
    const key = o.stimulus_id ?? 'sin-id';
    const m = meta.get(key) ?? meta.get(baseStimulus(key));
    const v = o.value ?? {};
    const push = (k: string, choice: string | null, ms: unknown, w: number, group: LatencySample['group'] = 'carta') => {
      if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 250) return;
      out.push({ person: o.pseudonym_id, key: k, choice, ms, words: w, baseMs: READ_BASE_MS + READ_PER_WORD_MS * w, group });
    };
    if (Array.isArray(v.choices)) {
      // Ráfaga: cada ítem se lee solo (el encabezado se leyó una vez al empezar).
      const lat = v.meta?.item_latency_ms as unknown[] | undefined;
      (v.choices as unknown[]).forEach((c, i) => {
        const [oa, ob] = (m?.itemOptions?.[i] ?? ['A', 'B']).map(clean);
        const ch = clean(c), side = ch === 'A' || ch === oa ? 'A' : ch === 'B' || ch === ob ? 'B' : null;
        if (!side) return;
        const w = words(m?.itemLabels?.[i]) + words(oa) + words(m?.labelA) + (side === 'B' ? words(ob) + words(m?.labelB) : 0);
        push(`${key}#${i}`, side, lat?.[i], w, 'rafaga');
      });
      continue;
    }
    const prompt = o.stimulus?.prompt ?? o.stimulus?.text ?? m?.label ?? '';
    const pw = words(prompt);
    // Ordenar lleva arrastrar y tocar varias veces: ese tiempo no es de lectura ni de duda.
    if (o.kind === 'ranking' || m?.format === 'ranking') continue;
    if (o.kind === 'scale' || m?.format === 'slider') {
      push(key, null, o.latency_ms, pw + words(m?.labelLeft) + words(m?.labelRight));
    } else {
      const chosen = answersOf(o, m)[0]?.a.label ?? null;
      const opts = m?.options?.length ? m.options : [m?.optionA, m?.optionB].filter((x): x is string => !!x);
      push(key, chosen, o.latency_ms, pw + upTo(opts, chosen));
    }
  }
  // Ráfagas: la base sale de los datos (mediana de lo que tarda un ítem, sin la lectura), no de las cartas.
  const raf = out.filter((x) => x.group === 'rafaga');
  if (raf.length) {
    const base = Math.max(300, median(raf.map((x) => x.ms - READ_PER_WORD_MS * x.words))!);
    for (const x of raf) x.baseMs = base + READ_PER_WORD_MS * x.words;
  }
  return out;
}

/** Ritmo de cada persona (por separado en cartas y en ráfagas): con menos de 3 respuestas con tiempo, se asume 1. */
export function rhythms(samples: LatencySample[]) {
  const by = new Map<string, number[]>();
  for (const s of samples) { const k = `${s.person}|${s.group}`; (by.get(k) ?? by.set(k, []).get(k)!).push(s.ms / s.baseMs); }
  return new Map([...by].map(([p, xs]) => [p, xs.length >= 3 ? median(xs)! : 1]));
}

export const readingOf = (d: number | null) => (d == null ? null : d > DUDA ? 'duda' : d < REFLEJO ? 'reflejo' : 'normal');

export type DoubtStat = { duda_mediana: number; lectura: 'duda' | 'normal' | 'reflejo'; palabras_leidas: number; n_con_tiempo: number };

/** Duda mediana por pregunta y por respuesta: key → (choice | '*') → resumen. */
export function doubtIndex(samples: LatencySample[]) {
  const k = rhythms(samples);
  const acc = new Map<string, Map<string, { d: number[]; w: number[] }>>();
  for (const s of samples) {
    const d = s.ms / (s.baseMs * (k.get(`${s.person}|${s.group}`) ?? 1));
    const byChoice = acc.get(s.key) ?? acc.set(s.key, new Map()).get(s.key)!;
    for (const c of ['*', ...(s.choice != null ? [s.choice] : [])]) {
      const x = byChoice.get(c) ?? byChoice.set(c, { d: [], w: [] }).get(c)!;
      x.d.push(d); x.w.push(s.words);
    }
  }
  const out = new Map<string, Map<string, DoubtStat>>();
  for (const [key, byChoice] of acc) {
    out.set(key, new Map([...byChoice].map(([c, x]) => {
      const dm = r2(median(x.d)!);
      return [c, { duda_mediana: dm, lectura: readingOf(dm)!, palabras_leidas: Math.round(median(x.w)!), n_con_tiempo: x.d.length } as DoubtStat];
    })));
  }
  const ritmos = [...k.entries()].filter(([p]) => p.endsWith('|carta')).map(([, x]) => x);
  return { index: out, ritmo: { personas: ritmos.length, mediana: ritmos.length ? r2(median(ritmos)!) : null } };
}
