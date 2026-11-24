// Bajar resultados: un archivo ordenado para pasarle a Claude (JSON) y una planilla de Excel.
// Las dos salen del mismo armado (exportResults), con las mismas cuentas que se ven en el panel.
// Sin base de datos: se prueba solo (results-export.test.ts).

import { ageBand, answersOf, baseStimulus, signalPairs, summarize, usable, type Block, type Cut, type Facts, type Obs, type Options, type StimulusMeta } from './results.ts';
import { KIND } from './question-kinds.ts';
import { doubtIndex, latencySamples, READ_BASE_MS, READ_PER_WORD_MS, DUDA, REFLEJO, type DoubtStat } from './latency.ts';

type DoubtIdx = Map<string, Map<string, DoubtStat>>;
/** Lo que se agrega a cada respuesta: la duda (tiempo real ÷ esperado para esa persona y ese texto). */
const doubt = (dx: DoubtIdx, key: string, choice: string) => {
  const d = dx.get(key)?.get(choice);
  return d ? { duda: d.duda_mediana, lectura_tiempo: d.lectura, palabras_leidas: d.palabras_leidas } : {};
};

const CUT_NAMES: { cut: Exclude<Cut, 'none' | 'menor'>; name: string }[] = [
  { cut: 'edad', name: 'edad' },
  { cut: 'genero', name: 'genero' },
  { cut: 'zona', name: 'zona' },
];

const kindOf = (b: Block) => KIND[b.format ?? ''] || KIND[b.kind] || b.format || b.kind;
const pct = (n: number, d: number) => (d > 0 ? Math.round((1000 * n) / d) / 10 : 0);
const secs = (ms: number | null) => (ms == null ? null : Math.round(ms / 100) / 10);

/** Lo que dice el resultado de una pregunta, según su tipo. */
function resultOf(b: Block, dx: DoubtIdx) {
  const v = b.view;
  if (v?.type === 'ranking') return { tipo_resultado: 'ranking', opciones: v.items.map((i) => ({ opcion: i.label, posicion_promedio: i.avgPos, pct_primero: i.firstPct, pct_ultimo: i.lastPct })) };
  if (v?.type === 'split') return { tipo_resultado: 'rafaga', items: v.items.map((i, ix) => {
    const da = dx.get(`${b.key}#${ix}`)?.get('A'), db = dx.get(`${b.key}#${ix}`)?.get('B');
    return {
      item: i.label, opcion_a: i.a, pct_a: i.aPct, opcion_b: i.b, pct_b: Math.round((100 - i.aPct) * 10) / 10, n: i.n, segundos_crudos_mediana: secs(i.medianMs),
      ...(da ? { duda_a: da.duda_mediana, lectura_a: da.lectura } : {}), ...(db ? { duda_b: db.duda_mediana, lectura_b: db.lectura } : {}),
    };
  }) };
  if (v?.type === 'scale') return {
    tipo_resultado: 'escala', minimo: v.min, maximo: v.max, etiqueta_minimo: v.labelLeft, etiqueta_maximo: v.labelRight,
    promedio: v.mean, mediana: v.median, percentil_25: v.p25, percentil_75: v.p75, tramos: v.buckets.map((x) => ({ desde: x.from, hasta: x.to, pct: x.pct, n: x.n })),
  };
  if (v?.type === 'market') return {
    tipo_resultado: 'prediccion', carta_original: v.ref, la_mayoria_eligio: v.realMajority, pct_que_acerto: v.hitPct,
    opciones: v.rows.map((r) => ({ opcion: r.label, pct_creen_que_eligio_la_mayoria: r.predictedPct, pct_eligio_de_verdad: r.realPct })),
  };
  return { tipo_resultado: 'eleccion', respuestas: b.rows.map((r) => ({ respuesta: r.label, pct: r.pct, n: r.n, segundos_crudos_mediana: secs(r.medianMs), ...doubt(dx, b.key, r.label) })) };
}

/** Cómo cambia por grupo (solo grupos con 5 o más personas, para no leer ruido). */
function cutOf(b: Block) {
  const gs = b.groups.filter((g) => g.n >= 5);
  const v = b.view;
  const grupos = gs.map((g) => `${g.name} (n=${g.n})`);
  if (v?.type === 'ranking') return { grupos, filas: v.items.map((i) => ({ opcion: i.label, posicion_promedio_por_grupo: Object.fromEntries(gs.map((g) => [g.name, i.byGroup[g.name] ?? null])) })) };
  if (v?.type === 'split') return { grupos, filas: v.items.map((i) => ({ item: i.label, [`pct_${i.a}`]: Object.fromEntries(gs.map((g) => [g.name, i.byGroup[g.name]?.aPct ?? null])) })) };
  if (v?.type === 'scale') return { grupos, promedio_por_grupo: Object.fromEntries(gs.map((g) => [g.name, v.byGroup[g.name]?.mean ?? null])), mediana_por_grupo: Object.fromEntries(gs.map((g) => [g.name, v.byGroup[g.name]?.median ?? null])) };
  if (v?.type === 'market') return null;
  return { grupos, filas: b.rows.map((r) => ({ respuesta: r.label, pct_por_grupo: Object.fromEntries(gs.map((g) => [g.name, r.byGroup[g.name]?.pct ?? null])) })) };
}

export type ExportData = ReturnType<typeof exportResults>;

export function exportResults(x: { obs: Obs[]; facts: Map<string, Facts>; meta: Map<string, StimulusMeta>; name: string; app: string; id: string; study: any; opt: Omit<Options, 'cut'>; now?: Date }) {
  const base = { ...x.opt, groupRafaga: true };
  const blocks = summarize(x.obs, x.facts, x.meta, { ...base, cut: 'none' });
  const cuts = Object.fromEntries(CUT_NAMES.map((c) => [c.name, summarize(x.obs, x.facts, x.meta, { ...base, cut: c.cut })]));
  const lat = doubtIndex(latencySamples(x.obs, x.facts, x.meta, x.opt));
  const people = [...new Set(x.obs.filter((o) => usable(o, x.facts.get(o.pseudonym_id), { ...base, cut: 'none' })).map((o) => o.pseudonym_id))];
  const tally = (f: (p: Facts | undefined) => string) => {
    const m = new Map<string, number>();
    for (const p of people) { const k = f(x.facts.get(p)); m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([grupo, n]) => ({ grupo, n, pct: pct(n, people.length) }));
  };
  return {
    archivo: 'BRUTAL · resultados',
    como_leerlo: 'Cada pregunta trae su resultado según el tipo: elección (porcentaje por respuesta), ranking (posición promedio: 1 = arriba), ráfaga (por ítem, % de cada opción), escala (promedio, mediana y tramos) o predicción (lo que creen que eligió la mayoría vs. lo que eligió de verdad). "cortes" muestra cada grupo con 5 o más personas; con pocos casos es solo una pista. Las pruebas y las respuestas automáticas no cuentan. El tiempo crudo (segundos_crudos_mediana) NO se lee: incluye el tiempo de leer, y una opción larga siempre tarda más. Para leer el tiempo usar "duda" (ver "latencia").',
    latencia: {
      formula: `tiempo esperado = ritmo de la persona × (${READ_BASE_MS / 1000} s + ${READ_PER_WORD_MS / 1000} s × palabras leídas hasta la opción elegida); duda = tiempo real ÷ tiempo esperado`,
      como_leer: `duda > ${DUDA} = dudó (tardó más de lo que pedía leer); duda < ${REFLEJO} = reflejo (contestó antes de terminar de leer); en el medio, normal. Es la mediana de las personas que eligieron esa respuesta. El ritmo de cada persona es la mediana de todas sus respuestas, así un lento no parece dudar en todo. Con pocas respuestas es una pista, no una medición. Las escalas llevan solo la duda de la pregunta entera. Los rankings no llevan duda (ordenar es arrastrar, no leer). En las ráfagas cada ítem se compara con lo que tarda un ítem de ráfaga, no con una carta.`,
      ritmo_participantes: lat.ritmo,
    },
    experimento: x.name,
    instrumento: `${x.app}/${x.id}`,
    tipo: x.app === 'pressure' ? 'detector de mentiras por voz' : 'Drop (cartas en el teléfono)',
    generado: (x.now ?? new Date()).toISOString(),
    estudio: x.study ? { nombre: x.study.name, tesis: x.study.thesis, pregunta: x.study.question, regla_de_decision: x.study.decision_rule } : null,
    participantes: {
      n: people.length,
      por_edad: tally((f) => ageBand(f?.age ?? null)),
      por_genero: tally((f) => f?.gender || 'Sin dato'),
      por_zona: tally((f) => f?.province || 'Sin dato'),
    },
    preguntas: blocks.map((b, i) => ({
      numero: i + 1,
      pregunta: b.title,
      ...(b.subtitle ? { contexto: b.subtitle } : {}),
      tipo: kindOf(b),
      n: b.n,
      ...(b.lied ? { mintieron: b.lied } : {}),
      ...(lat.index.get(b.key)?.get('*') ? { duda_pregunta: lat.index.get(b.key)!.get('*')!.duda_mediana, lectura_tiempo_pregunta: lat.index.get(b.key)!.get('*')!.lectura } : {}),
      ...resultOf(b, lat.index),
      cortes: Object.fromEntries(CUT_NAMES.map((c) => [c.name, cutOf(cuts[c.name].find((y) => y.key === b.key) ?? b)]).filter(([, v]) => v)),
      ...(b.statedVsTruth ? { dijeron_vs_verdad: b.statedVsTruth } : {}),
      ...(b.transcripts ? { frases: b.transcripts.slice(0, 15) } : {}),
    })),
    pares_de_senal: signalPairs(x.obs, x.facts, x.meta, { ...base, cut: 'none' }),
  };
}

type Cell = string | number | null;
export type Sheet = { name: string; rows: Cell[][]; widths?: number[] };

/** La planilla: resumen por pregunta, cortes por edad / género / zona, quiénes respondieron y una fila por respuesta. */
export function excelSheets(d: ExportData, raw: { obs: Obs[]; facts: Map<string, Facts>; meta: Map<string, StimulusMeta>; opt: Omit<Options, 'cut'> }): Sheet[] {
  const resumen: Cell[][] = [[`${d.experimento} · ${d.participantes.n} participantes`], ['Duda = tiempo real ÷ tiempo esperado para esa persona y ese texto. Más de 1,3: dudó. Menos de 0,8: reflejo. El tiempo crudo no se lee.'], []];
  for (const q of d.preguntas as any[]) {
    resumen.push([`${q.numero}. ${q.pregunta}`, `${q.tipo} · ${q.n} respuestas`]);
    if (q.tipo_resultado === 'ranking') {
      resumen.push(['Opción', 'Posición promedio (1 = arriba)', '% primero', '% último']);
      for (const o of q.opciones) resumen.push([o.opcion, o.posicion_promedio, o.pct_primero, o.pct_ultimo]);
    } else if (q.tipo_resultado === 'rafaga') {
      resumen.push(['Ítem', 'Opción A', '% A', 'Opción B', '% B', 'n', 'Duda A', 'Duda B']);
      for (const o of q.items) resumen.push([o.item, o.opcion_a, o.pct_a, o.opcion_b, o.pct_b, o.n, o.duda_a ?? null, o.duda_b ?? null]);
    } else if (q.tipo_resultado === 'escala') {
      resumen.push(['Promedio', q.promedio, 'Mediana', q.mediana, 'Mitad del medio', `${q.percentil_25} a ${q.percentil_75}`]);
      resumen.push(['Tramo', '%', 'n']);
      for (const t of q.tramos) resumen.push([`${t.desde}–${t.hasta}`, t.pct, t.n]);
    } else if (q.tipo_resultado === 'prediccion') {
      if (q.la_mayoria_eligio) resumen.push(['La mayoría eligió', q.la_mayoria_eligio, '% que acertó', q.pct_que_acerto]);
      resumen.push(['Opción', '% creen que eligió la mayoría', '% eligió de verdad']);
      for (const o of q.opciones) resumen.push([o.opcion, o.pct_creen_que_eligio_la_mayoria, o.pct_eligio_de_verdad]);
    } else {
      resumen.push(['Respuesta', '%', 'n', 'Duda (1 = normal)', 'Lectura del tiempo', 'Segundos crudos (no leer)']);
      for (const o of q.respuestas) resumen.push([o.respuesta, o.pct, o.n, o.duda ?? null, o.lectura_tiempo ?? '', o.segundos_crudos_mediana]);
    }
    resumen.push([]);
  }

  const cutSheet = (key: 'edad' | 'genero' | 'zona', name: string): Sheet => {
    const rows: Cell[][] = [];
    for (const q of d.preguntas as any[]) {
      const c = q.cortes?.[key];
      if (!c || !c.grupos?.length) continue;
      const names = c.grupos.map((g: string) => g.replace(/ \(n=\d+\)$/, ''));
      rows.push([`${q.numero}. ${q.pregunta}`]);
      if (c.promedio_por_grupo) {
        rows.push(['', ...c.grupos]);
        rows.push(['Promedio', ...names.map((n: string) => c.promedio_por_grupo[n])]);
        rows.push(['Mediana', ...names.map((n: string) => c.mediana_por_grupo[n])]);
      } else {
        const unit = q.tipo_resultado === 'ranking' ? 'Posición promedio' : q.tipo_resultado === 'rafaga' ? '% primera opción' : '%';
        rows.push([unit, ...c.grupos]);
        for (const f of c.filas) {
          const vals = f.posicion_promedio_por_grupo ?? f.pct_por_grupo ?? Object.values(f).find((v) => v && typeof v === 'object');
          rows.push([f.opcion ?? f.respuesta ?? f.item, ...names.map((n: string) => (vals as any)?.[n] ?? null)]);
        }
      }
      rows.push([]);
    }
    return { name, rows: rows.length ? rows : [['Sin grupos de 5 o más personas todavía.']], widths: [48, 16, 16, 16, 16, 16, 16, 16] };
  };

  const quienes: Cell[][] = [['Participantes', d.participantes.n], []];
  for (const [title, list] of [['Edad', d.participantes.por_edad], ['Género', d.participantes.por_genero], ['Zona', d.participantes.por_zona]] as const) {
    quienes.push([title, 'n', '%']);
    for (const g of list) quienes.push([g.grupo, g.n, g.pct]);
    quienes.push([]);
  }

  const respuestas: Cell[][] = [['Seudónimo', 'Edad', 'Franja', 'Género', 'Provincia', 'Pregunta', 'Ítem', 'Respuesta', 'Segundos', 'Calidad', 'Fecha']];
  for (const o of raw.obs) {
    const f = raw.facts.get(o.pseudonym_id);
    if (!usable(o, f, { ...raw.opt, cut: 'none', includeTrapFailed: true })) continue;
    const m = raw.meta.get(o.stimulus_id ?? '') ?? raw.meta.get(baseStimulus(o.stimulus_id));
    const prompt = o.stimulus?.prompt ?? o.stimulus?.text ?? m?.label ?? '';
    for (const { item, a } of answersOf(o, m)) {
      respuestas.push([o.pseudonym_id.slice(0, 8), f?.age ?? null, ageBand(f?.age ?? null), f?.gender ?? '', f?.province ?? '', prompt,
        item == null ? '' : m?.itemLabels?.[item] ?? item + 1, a.label, o.latency_ms == null ? null : Math.round(o.latency_ms / 100) / 10, o.quality, o.observed_at.slice(0, 19).replace('T', ' ')]);
    }
  }

  return [
    { name: 'Resumen', rows: resumen, widths: [48, 22, 14, 22, 14, 10] },
    cutSheet('edad', 'Por edad'),
    cutSheet('genero', 'Por género'),
    cutSheet('zona', 'Por zona'),
    { name: 'Quiénes respondieron', rows: quienes, widths: [28, 10, 10] },
    { name: 'Respuestas', rows: respuestas, widths: [11, 6, 8, 10, 14, 48, 28, 28, 9, 12, 19] },
  ];
}
