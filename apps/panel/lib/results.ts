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

export type Answer = { label: string; stated?: string; lied?: boolean };

/** Qué respondió, en palabras. Puede devolver varias (una ráfaga es una respuesta por ítem). */
export function answersOf(o: Obs, meta?: StimulusMeta): { item?: number; a: Answer }[] {
  const v = o.value ?? {};
  // Ráfaga de Drops: una elección por ítem.
  if (Array.isArray(v.choices)) return v.choices.map((c: unknown, i: number) => ({ item: i, a: { label: String(c ?? '—') } }));
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
};

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const pct = (n: number, d: number) => (d > 0 ? Math.round((1000 * n) / d) / 10 : 0);

export type Options = { cut: Cut; includeLies?: boolean; includeTrapFailed?: boolean; includeArchived?: boolean };

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
      });
    }
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
