// Motor de resultados: toma las observaciones de un experimento (cualquier app) y arma, por pregunta,
// qué respondieron, cuánto tardaron y cómo cambia según edad, género, zona o si es menor.
// Sin base de datos: se prueba solo (results.test.ts).

export type Obs = {
  pseudonym_id: string;
  stimulus_id: string | null;
  kind: string;
  quality: string;
  value: any;
  value_text: string | null;
  value_number: number | null;
  latency_ms: number | null;
  position: number | null;
  stimulus: any;
  context: any;
  observed_at: string;
};

export type Facts = { age: number | null; is_minor: boolean; gender: string | null; province: string | null; status: string };

/** Lo que sabemos de cada pregunta además de la observación (opciones, ítems de una ráfaga, orden, pares de señal). */
export type StimulusMeta = {
  label?: string;
  format?: string;
  order?: number;
  options?: string[];
  itemLabels?: string[];
  optionA?: string | null;
  optionB?: string | null;
  signalPairId?: string | null;
  signalPairRole?: string | null;
  cardType?: string | null;
  /** Ráfagas: las dos opciones de cada ítem (emoji o botón), y las etiquetas generales (VOY / NO VOY). */
  itemOptions?: [string, string][];
  labelA?: string | null;
  labelB?: string | null;
  /** Predicción: la etiqueta de la carta a la que apunta (content.ref) y la etiqueta interna de cada carta. */
  refLabel?: string | null;
  key?: string | null;
  /** Escala: extremos y sus etiquetas. */
  min?: number;
  max?: number;
  labelLeft?: string | null;
  labelRight?: string | null;
};

export type Cut = 'none' | 'edad' | 'genero' | 'zona' | 'menor';
export const CUTS: { value: Cut; label: string }[] = [
  { value: 'none', label: 'Sin corte' },
  { value: 'edad', label: 'Edad' },
  { value: 'genero', label: 'Género' },
  { value: 'zona', label: 'Zona' },
  { value: 'menor', label: 'Menor / adulto' },
];

export function ageBand(age: number | null): string {
  if (age == null) return 'Sin dato';
  if (age < 18) return '15–17';
  if (age <= 21) return '18–21';
  if (age <= 25) return '22–25';
  if (age <= 30) return '26–30';
  return '31+';
}

export function groupOf(f: Facts | undefined, cut: Cut): string {
  if (cut === 'none') return 'Todos';
  if (!f) return 'Sin dato';
  if (cut === 'edad') return ageBand(f.age);
  if (cut === 'genero') return f.gender || 'Sin dato';
  if (cut === 'zona') return f.province || 'Sin dato';
  return f.age == null ? 'Sin dato' : f.is_minor ? 'Menor' : 'Adulto';
}

const PRESSURE_WORDS: Record<string, string> = { yes: 'Sí', no: 'No', agree: 'De acuerdo', disagree: 'En desacuerdo', unclear: 'No se entendió', open: 'Respuesta libre' };

/** Clave de la pregunta: las repreguntas y toques del detector cuelgan de la misma pregunta. */
export const baseStimulus = (id: string | null) => (id ?? 'sin-id').replace(/:(tap|follow)$/, '');

/** Las ráfagas de emoji guardan "A" / "B": se muestra el emoji del ítem y la etiqueta general (🙋 VOY). */
function letterLabel(c: string, i: number, meta?: StimulusMeta) {
  if (c !== 'A' && c !== 'B') return c.trim() || '—';
  const side = c === 'A' ? 0 : 1;
  const emoji = meta?.itemOptions?.[i]?.[side]?.trim();
  const word = side === 0 ? meta?.labelA : meta?.labelB;
  return [emoji, word?.trim()].filter(Boolean).join(' ') || c;
}

export type Answer = { label: string; stated?: string; lied?: boolean };

/** Qué respondió, en palabras. Puede devolver varias (una ráfaga es una respuesta por ítem). */
export function answersOf(o: Obs, meta?: StimulusMeta): { item?: number; a: Answer }[] {
  const v = o.value ?? {};
  // Ráfaga de Drops: una elección por ítem.
  if (Array.isArray(v.choices)) return v.choices.map((c: unknown, i: number) => ({ item: i, a: { label: letterLabel(String(c ?? '—'), i, meta) } }));
  // Detector: lo dicho y lo verdadero (si mintió en una binaria, la verdad es la otra).
  if ('committed' in v || 'stated' in v) {
    const word = (k: string | null) => {
      if (k == null) return null;
      if (k === 'a') return meta?.optionA || 'Opción A';
      if (k === 'b') return meta?.optionB || 'Opción B';
      return PRESSURE_WORDS[k] ?? k;
    };
    const stated = v.number != null ? String(v.number) : word(v.stated) ?? '—';
    const truth = v.number != null && v.committed !== 'lie' ? String(v.number) : word(v.truth);
    return [{ a: { label: truth ?? (v.committed === 'lie' ? 'Mintió (no se sabe la verdad)' : stated), stated, lied: v.committed === 'lie' } }];
  }
  if (typeof v.emoji === 'string') return [{ a: { label: v.timed_out ? 'No tocó' : v.emoji } }];
  if (o.kind === 'scale' && o.value_number != null) return [{ a: { label: String(o.value_number) } }];
  if (o.kind === 'ranking' && Array.isArray(v.order)) return [{ a: { label: v.order.join(' > ') } }];
  if (o.kind === 'behavior') return [{ a: { label: v.viewed ? 'Vio la carta' : 'No respondió a tiempo' } }];
  if (o.kind === 'text') return [{ a: { label: v.submitted ? 'Escribió' : 'No escribió' } }];
  if (v.outcome != null) return [{ a: { label: String(v.outcome) } }];
  if (o.value_text) return [{ a: { label: o.value_text } }];
  if (v.option != null) return [{ a: { label: String(v.option) } }];
  if (v.side) return [{ a: { label: v.side === 'A' ? meta?.optionA || 'A' : meta?.optionB || 'B' } }];
  return [{ a: { label: '—' } }];
}

export type Row = { label: string; n: number; pct: number; medianMs: number | null; byGroup: Record<string, { n: number; pct: number }> };
export type Block = {
  key: string;
  title: string;
  subtitle?: string;
  format?: string;
  kind: string;
  n: number;
  lied: number;
  trapFailed: number;
  rows: Row[];
  groups: { name: string; n: number }[];
  statedVsTruth?: { label: string; stated: number; truth: number }[];
  mean?: number | null;
  transcripts?: string[];
  /** Cómo mostrarla según el tipo de pregunta (si no hay, la lista de respuestas de siempre). */
  view?: View;
};

export type RankItem = { label: string; avgPos: number; firstPct: number; lastPct: number; byGroup: Record<string, number> };
export type SplitItem = { label: string; a: string; b: string; n: number; aPct: number; medianMs: number | null; byGroup: Record<string, { n: number; aPct: number }> };
export type View =
  | { type: 'ranking'; size: number; items: RankItem[] }
  | { type: 'split'; labelA: string | null; labelB: string | null; items: SplitItem[] }
  | { type: 'scale'; min: number; max: number; labelLeft: string | null; labelRight: string | null; buckets: { from: number; to: number; n: number; pct: number }[];
      mean: number; median: number; p25: number; p75: number; byGroup: Record<string, { n: number; mean: number; median: number }> }
  | { type: 'market'; ref: string | null; rows: { label: string; predictedPct: number; realPct: number | null }[]; realMajority: string | null; hitPct: number | null; realN: number };

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const pct = (n: number, d: number) => (d > 0 ? Math.round((1000 * n) / d) / 10 : 0);

export type Options = { cut: Cut; includeLies?: boolean; includeTrapFailed?: boolean; includeArchived?: boolean;
  /** Para el panel: una ráfaga es un solo bloque con todos sus ítems (los informes y la planilla siguen ítem por ítem). */
  groupRafaga?: boolean };

const quantile = (sorted: number[], q: number) => {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return Math.round((sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)) * 10) / 10;
};
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);
const clean = (x: unknown) => String(x ?? '').trim();

/** Ordenar: posición promedio de cada opción (1 = arriba), cuántos la pusieron primera y cuántos última. */
function rankingView(entries: { o: Obs; group: string }[], options?: string[]): View | undefined {
  const orders = entries.map((e) => ({ order: Array.isArray(e.o.value?.order) ? (e.o.value.order as unknown[]).map(clean) : [], group: e.group })).filter((x) => x.order.length);
  if (!orders.length) return undefined;
  const labels = options?.length ? options.map(clean) : [...new Set(orders.flatMap((x) => x.order))];
  const size = Math.max(labels.length, ...orders.map((x) => x.order.length));
  const items: RankItem[] = labels.map((label) => {
    const pos = orders.map((x) => ({ p: x.order.indexOf(label), g: x.group, len: x.order.length })).filter((x) => x.p >= 0);
    const byGroup: Record<string, number[]> = {};
    for (const x of pos) (byGroup[x.g] ??= []).push(x.p + 1);
    return {
      label,
      avgPos: avg(pos.map((x) => x.p + 1)),
      firstPct: pct(pos.filter((x) => x.p === 0).length, orders.length),
      lastPct: pct(pos.filter((x) => x.p === x.len - 1).length, orders.length),
      byGroup: Object.fromEntries(Object.entries(byGroup).map(([g, xs]) => [g, avg(xs)])),
    };
  });
  return { type: 'ranking', size, items: items.sort((a, b) => a.avgPos - b.avgPos) };
}

/** Ráfaga: por ítem, qué parte eligió la primera opción. */
function splitView(entries: { o: Obs; group: string }[], m?: StimulusMeta): View | undefined {
  const lists = entries.map((e) => ({ choices: Array.isArray(e.o.value?.choices) ? (e.o.value.choices as unknown[]).map(clean) : [], lat: e.o.value?.meta?.item_latency_ms as number[] | undefined, group: e.group }));
  const count = Math.max(m?.itemLabels?.length ?? 0, ...lists.map((x) => x.choices.length));
  if (!count) return undefined;
  const items: SplitItem[] = [];
  for (let i = 0; i < count; i++) {
    const [oa, ob] = (m?.itemOptions?.[i] ?? ['A', 'B']).map(clean);
    const sideOf = (c: string) => (c === 'A' || c === oa ? 'A' : c === 'B' || c === ob ? 'B' : null);
    const got = lists.map((x) => ({ side: x.choices[i] != null ? sideOf(x.choices[i]) : null, ms: x.lat?.[i], group: x.group })).filter((x) => x.side);
    if (!got.length) continue;
    const byGroup: SplitItem['byGroup'] = {};
    for (const x of got) { const g = (byGroup[x.group] ??= { n: 0, aPct: 0 }); g.n++; if (x.side === 'A') g.aPct++; }
    for (const g of Object.values(byGroup)) g.aPct = pct(g.aPct, g.n);
    items.push({
      label: m?.itemLabels?.[i] ?? `Ítem ${i + 1}`,
      a: letterLabel('A', i, m), b: letterLabel('B', i, m),
      n: got.length, aPct: pct(got.filter((x) => x.side === 'A').length, got.length),
      medianMs: median(got.map((x) => x.ms).filter((x): x is number => typeof x === 'number')), byGroup,
    });
  }
  return { type: 'split', labelA: m?.labelA ?? null, labelB: m?.labelB ?? null, items };
}

/** Escala: en tramos de a 10, con promedio, mediana y dónde está la mitad del medio. */
function scaleView(entries: { o: Obs; group: string }[], m?: StimulusMeta): View | undefined {
  const vals = entries.map((e) => ({ v: Number(e.o.value_number ?? e.o.value?.value), g: e.group })).filter((x) => Number.isFinite(x.v));
  if (!vals.length) return undefined;
  const min = m?.min ?? 0, max = m?.max ?? 100, step = Math.max(1, (max - min) / 10);
  const buckets = Array.from({ length: 10 }, (_, i) => ({ from: Math.round(min + i * step), to: Math.round(min + (i + 1) * step), n: 0, pct: 0 }));
  for (const x of vals) buckets[Math.min(9, Math.max(0, Math.floor((x.v - min) / step)))].n++;
  for (const b of buckets) b.pct = pct(b.n, vals.length);
  const sorted = vals.map((x) => x.v).sort((a, b) => a - b);
  const byGroup: Record<string, number[]> = {};
  for (const x of vals) (byGroup[x.g] ??= []).push(x.v);
  return {
    type: 'scale', min, max, labelLeft: m?.labelLeft ?? null, labelRight: m?.labelRight ?? null, buckets,
    mean: avg(sorted), median: quantile(sorted, 0.5), p25: quantile(sorted, 0.25), p75: quantile(sorted, 0.75),
    byGroup: Object.fromEntries(Object.entries(byGroup).map(([g, xs]) => [g, { n: xs.length, mean: avg(xs), median: quantile([...xs].sort((a, b) => a - b), 0.5) }])),
  };
}

/** Observaciones que cuentan: sin pruebas, sin automáticas; mentiras y trampas según el filtro. */
export function usable(o: Obs, f: Facts | undefined, opt: Options) {
  if (o.context?.test) return false;
  if (!opt.includeArchived && f?.status === 'archived') return false;
  if (o.quality === 'excluded') return false;
  if (o.quality === 'trap_failed' && !opt.includeTrapFailed) return false;
  return true;
}

export function summarize(obs: Obs[], facts: Map<string, Facts>, meta: Map<string, StimulusMeta>, opt: Options): Block[] {
  type Acc = { o: Obs; f?: Facts; ans: { item?: number; a: Answer }[] };
  const by = new Map<string, Acc[]>();
  for (const o of obs) {
    const f = facts.get(o.pseudonym_id);
    if (!usable(o, f, opt)) continue;
    const key = o.stimulus_id ?? 'sin-id';
    const m = meta.get(key) ?? meta.get(baseStimulus(key));
    const list = by.get(key) ?? [];
    list.push({ o, f, ans: answersOf(o, m) });
    by.set(key, list);
  }

  const blocks: Block[] = [];
  for (const [key, list] of by) {
    const base = baseStimulus(key);
    const m = meta.get(key) ?? meta.get(base);
    const first = list[0].o;
    const suffix = key.endsWith(':follow') ? 'Repregunta' : key.endsWith(':tap') ? 'Toque' : null;
    const prompt = first.stimulus?.prompt ?? first.stimulus?.text ?? m?.label ?? first.stimulus?.label ?? key;
    const items = Math.max(1, ...list.map((x) => x.ans.length));
    const isRafaga = list.some((x) => x.ans.some((a) => a.item != null));
    const lied = list.filter((x) => x.ans.some((a) => a.a.lied)).length;
    const trapFailed = list.filter((x) => x.o.quality === 'trap_failed').length;

    if (isRafaga && opt.groupRafaga) {
      const entries = list.map((x) => ({ o: x.o, group: groupOf(x.f, opt.cut) }));
      const view = splitView(entries, m);
      if (view) {
        const groupCount = new Map<string, number>();
        for (const e of entries) groupCount.set(e.group, (groupCount.get(e.group) ?? 0) + 1);
        blocks.push({
          key, title: String(prompt), format: m?.format ?? first.stimulus?.format, kind: first.kind, n: entries.length, lied, trapFailed, rows: [],
          groups: [...groupCount.entries()].map(([name, c]) => ({ name, n: c })).sort((a, b) => a.name.localeCompare(b.name)), view,
        });
        continue;
      }
    }
    for (let item = 0; item < (isRafaga ? items : 1); item++) {
      const entries = list.flatMap((x) => {
        const a = isRafaga ? x.ans.find((y) => y.item === item) : x.ans[0];
        if (!a) return [];
        if (a.a.lied && !opt.includeLies && a.a.label.startsWith('Mintió')) return [];
        return [{ ...x, a: a.a, group: groupOf(x.f, opt.cut) }];
      });
      if (!entries.length) continue;
      const n = entries.length;
      const groupCount = new Map<string, number>();
      for (const e of entries) groupCount.set(e.group, (groupCount.get(e.group) ?? 0) + 1);
      const labels = new Map<string, typeof entries>();
      for (const e of entries) labels.set(e.a.label, [...(labels.get(e.a.label) ?? []), e]);
      const order = m?.options?.length && !isRafaga ? m.options : null;
      const rows: Row[] = [...labels.entries()].map(([label, es]) => {
        const byGroup: Row['byGroup'] = {};
        for (const [g, gn] of groupCount) {
          const c = es.filter((e) => e.group === g).length;
          byGroup[g] = { n: c, pct: pct(c, gn) };
        }
        return { label, n: es.length, pct: pct(es.length, n), medianMs: median(es.map((e) => e.o.latency_ms).filter((x): x is number => x != null)), byGroup };
      });
      rows.sort((a, b) => {
        if (first.kind === 'scale') return Number(a.label) - Number(b.label);
        if (order) return (order.indexOf(a.label) + 1 || 99) - (order.indexOf(b.label) + 1 || 99);
        return b.n - a.n;
      });
      const statedVsTruth = entries.some((e) => e.a.stated != null && e.a.lied)
        ? [...new Set(entries.flatMap((e) => [e.a.stated!, e.a.label]))].filter((l) => !l.startsWith('Mintió')).map((label) => ({
            label, stated: entries.filter((e) => e.a.stated === label).length, truth: entries.filter((e) => e.a.label === label).length,
          }))
        : undefined;
      const nums = entries.map((e) => (first.kind === 'scale' ? Number(e.o.value_number) : NaN)).filter(Number.isFinite);
      const transcripts = entries.map((e) => String(e.o.value?.transcript ?? '').trim()).filter(Boolean).slice(0, 30);
      blocks.push({
        key: isRafaga ? `${key}#${item}` : key,
        title: isRafaga ? m?.itemLabels?.[item] || `Ítem ${item + 1}` : String(prompt),
        subtitle: isRafaga ? String(prompt === key ? m?.label ?? 'Ráfaga' : prompt) : suffix ?? undefined,
        format: m?.format ?? first.stimulus?.format ?? first.stimulus?.section,
        kind: first.kind,
        n, lied, trapFailed, rows,
        groups: [...groupCount.entries()].map(([name, c]) => ({ name, n: c })).sort((a, b) => a.name.localeCompare(b.name)),
        ...(statedVsTruth ? { statedVsTruth } : {}),
        ...(nums.length ? { mean: Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 } : {}),
        ...(transcripts.length ? { transcripts } : {}),
        ...(() => {
          if (isRafaga) return {};
          const fmtName = m?.format ?? first.stimulus?.format;
          const view = first.kind === 'ranking' || fmtName === 'ranking' ? rankingView(entries, m?.options)
            : first.kind === 'scale' || fmtName === 'slider' ? scaleView(entries, m)
            : undefined;
          return view ? { view } : {};
        })(),
      });
    }
  }
  // Predicción: lo que creen que eligió la mayoría al lado de lo que eligieron de verdad en la carta a la que apunta.
  for (const b of blocks) {
    const m = meta.get(b.key);
    if ((m?.format ?? b.format) !== 'market') continue;
    const refId = m?.refLabel ? [...meta.entries()].find(([, x]) => x.key === m.refLabel)?.[0] ?? null : null;
    const ref = refId ? blocks.find((x) => x.key === refId) : undefined;
    const realN = ref?.n ?? 0;
    const labels = [...(refId ? meta.get(refId)?.options ?? [] : []), ...(ref ? ref.rows.map((r) => r.label) : [])];
    labels.splice(0, labels.length, ...new Set(labels));
    for (const r of b.rows) if (!labels.includes(r.label)) labels.push(r.label);
    const realMajority = ref?.rows.length ? [...ref.rows].sort((x, y) => y.n - x.n)[0].label : null;
    b.view = {
      type: 'market', ref: ref?.title ?? null, realN, realMajority,
      hitPct: realMajority ? b.rows.find((r) => r.label === realMajority)?.pct ?? 0 : null,
      rows: labels.map((label) => ({ label, predictedPct: b.rows.find((r) => r.label === label)?.pct ?? 0, realPct: ref ? ref.rows.find((r) => r.label === label)?.pct ?? 0 : null })),
    };
  }
  const orderOf = (b: Block) => {
    const k = b.key.split('#')[0];
    const m = meta.get(k) ?? meta.get(baseStimulus(k));
    const pos = m?.order ?? obs.find((o) => o.stimulus_id === k)?.position ?? 999;
    return pos * 100 + (k.endsWith(':tap') ? 0 : k.endsWith(':follow') ? 2 : 1) * 10 + Number(b.key.split('#')[1] ?? 0) / 100;
  };
  return blocks.sort((a, b) => orderOf(a) - orderOf(b));
}

/** Pares de señal (explorador vs validador): cuántos respondieron igual en las dos cartas del par. */
export function signalPairs(obs: Obs[], facts: Map<string, Facts>, meta: Map<string, StimulusMeta>, opt: Options) {
  const pairs = new Map<string, { explorer?: string; validator?: string }>();
  for (const [id, m] of meta) {
    if (!m.signalPairId) continue;
    const p = pairs.get(m.signalPairId) ?? {};
    if (m.signalPairRole === 'validator') p.validator = id; else p.explorer = p.explorer ?? id;
    pairs.set(m.signalPairId, p);
  }
  const out: { pair: string; explorer: string; validator: string; both: number; table: { a: string; b: string; n: number }[] }[] = [];
  for (const [pair, p] of pairs) {
    if (!p.explorer || !p.validator) continue;
    const pick = (id: string) => {
      const r = new Map<string, string>();
      for (const o of obs) if (o.stimulus_id === id && usable(o, facts.get(o.pseudonym_id), opt)) r.set(o.pseudonym_id, answersOf(o, meta.get(id))[0]?.a.label ?? '—');
      return r;
    };
    const a = pick(p.explorer), b = pick(p.validator);
    const cells = new Map<string, number>();
    for (const [ps, la] of a) {
      const lb = b.get(ps);
      if (lb == null) continue;
      cells.set(`${la}\u0000${lb}`, (cells.get(`${la}\u0000${lb}`) ?? 0) + 1);
    }
    const table = [...cells.entries()].map(([k, n]) => { const [x, y] = k.split('\u0000'); return { a: x, b: y, n }; }).sort((x, y) => y.n - x.n);
    out.push({ pair, explorer: meta.get(p.explorer)?.label ?? p.explorer, validator: meta.get(p.validator)?.label ?? p.validator, both: table.reduce((s, c) => s + c.n, 0), table });
  }
  return out;
}

/** Una fila por respuesta, para planilla. Sin teléfono ni apodo: seudónimo y datos demográficos. */
export function toCsv(obs: Obs[], facts: Map<string, Facts>, meta: Map<string, StimulusMeta>, opt: Options) {
  const esc = (x: unknown) => {
    const s = x == null ? '' : String(x);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ['seudonimo', 'edad', 'franja', 'genero', 'provincia', 'menor', 'pregunta_id', 'pregunta', 'item', 'respuesta', 'dijo', 'mintio', 'latencia_ms', 'calidad', 'fecha'];
  const lines = [head.join(',')];
  for (const o of obs) {
    const f = facts.get(o.pseudonym_id);
    if (!usable(o, f, { ...opt, includeTrapFailed: true })) continue;
    const m = meta.get(o.stimulus_id ?? '') ?? meta.get(baseStimulus(o.stimulus_id));
    const prompt = o.stimulus?.prompt ?? o.stimulus?.text ?? m?.label ?? '';
    for (const { item, a } of answersOf(o, m)) {
      lines.push([
        o.pseudonym_id.slice(0, 8), f?.age ?? '', ageBand(f?.age ?? null), f?.gender ?? '', f?.province ?? '', f ? (f.is_minor ? 'si' : 'no') : '',
        o.stimulus_id ?? '', prompt, item == null ? '' : m?.itemLabels?.[item] ?? item + 1, a.label, a.stated ?? '', a.lied ? 'si' : '',
        o.latency_ms ?? '', o.quality, o.observed_at,
      ].map(esc).join(','));
    }
  }
  return lines.join('\n');
}
