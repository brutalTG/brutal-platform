import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageBand, answersOf, signalPairs, summarize, toCsv, type Facts, type Obs, type StimulusMeta } from './results.ts';

const o = (p: string, stim: string, value: any, extra: Partial<Obs> = {}): Obs => ({
  pseudonym_id: p, stimulus_id: stim, kind: 'choice', quality: 'valid', value, value_text: value?.option ?? null, value_number: null,
  latency_ms: 1000, position: 1, stimulus: { text: '¿A o B?' }, context: {}, observed_at: '2026-10-24T00:00:00Z', ...extra,
});
const facts = new Map<string, Facts>([
  ['p1', { age: 16, is_minor: true, gender: 'Mujer', province: 'CABA', status: 'active' }],
  ['p2', { age: 24, is_minor: false, gender: 'Hombre', province: 'CABA', status: 'active' }],
  ['p3', { age: 30, is_minor: false, gender: 'Mujer', province: 'Córdoba', status: 'archived' }],
]);
const meta = new Map<string, StimulusMeta>([['q1', { label: '¿A o B?', options: ['A', 'B'], order: 0 }]]);

test('franjas de edad', () => {
  assert.equal(ageBand(16), '15–17');
  assert.equal(ageBand(22), '22–25');
  assert.equal(ageBand(null), 'Sin dato');
});

test('reparto de respuestas y corte por edad; archivados y pruebas afuera', () => {
  const obs = [
    o('p1', 'q1', { option: 'A' }), o('p2', 'q1', { option: 'B' }, { latency_ms: 3000 }),
    o('p3', 'q1', { option: 'A' }), o('p2', 'q1', { option: 'A' }, { context: { test: true } }),
  ];
  const [b] = summarize(obs, facts, meta, { cut: 'edad' });
  assert.equal(b.n, 2);
  assert.deepEqual(b.rows.map((r) => [r.label, r.n, r.pct]), [['A', 1, 50], ['B', 1, 50]]);
  assert.equal(b.rows[0].byGroup['15–17'].pct, 100);
  assert.equal(b.rows[1].medianMs, 3000);
});

test('detector: si mintió en una binaria, cuenta la verdad y se ve lo que dijo', () => {
  const pm = new Map<string, StimulusMeta>([['d1', { optionA: 'Bajar la edad', optionB: 'Dejarla' }]]);
  const lie = o('p1', 'd1', { stated: 'a', truth: 'b', committed: 'lie', transcript: 'bajarla' }, { quality: 'declared_lie' });
  const honest = o('p2', 'd1', { stated: 'b', truth: 'b', committed: 'truth', transcript: 'dejarla' });
  assert.deepEqual(answersOf(lie, pm.get('d1'))[0].a, { label: 'Dejarla', stated: 'Bajar la edad', lied: true });
  const [b] = summarize([lie, honest], facts, pm, { cut: 'none' });
  assert.equal(b.lied, 1);
  assert.deepEqual(b.rows.map((r) => [r.label, r.n]), [['Dejarla', 2]]);
  assert.deepEqual(b.statedVsTruth?.find((x) => x.label === 'Bajar la edad'), { label: 'Bajar la edad', stated: 1, truth: 0 });
  assert.equal(b.transcripts?.length, 2);
});

test('ráfaga: un bloque por ítem', () => {
  const rm = new Map<string, StimulusMeta>([['r', { label: 'Ráfaga', itemLabels: ['Nike', 'Adidas'] }]]);
  const blocks = summarize([o('p1', 'r', { choices: ['🔥', '🧊'] }), o('p2', 'r', { choices: ['🔥', '🔥'] })], facts, rm, { cut: 'none' });
  assert.deepEqual(blocks.map((b) => b.title), ['Nike', 'Adidas']);
  assert.equal(blocks[1].rows.find((r) => r.label === '🔥')?.n, 1);
});

test('trampas falladas solo si se piden', () => {
  const obs = [o('p1', 'q1', { option: 'A' }, { quality: 'trap_failed' })];
  assert.equal(summarize(obs, facts, meta, { cut: 'none' }).length, 0);
  assert.equal(summarize(obs, facts, meta, { cut: 'none', includeTrapFailed: true })[0].trapFailed, 1);
});

test('pares de señal: cruza las dos cartas por persona', () => {
  const sm = new Map<string, StimulusMeta>([
    ['e', { label: 'Explorador', signalPairId: 'SP1', signalPairRole: 'explorer' }],
    ['v', { label: 'Validador', signalPairId: 'SP1', signalPairRole: 'validator' }],
  ]);
  const obs = [o('p1', 'e', { option: 'Sí' }), o('p1', 'v', { option: 'No' }), o('p2', 'e', { option: 'Sí' }), o('p2', 'v', { option: 'Sí' })];
  const [p] = signalPairs(obs, facts, sm, { cut: 'none' });
  assert.equal(p.both, 2);
  assert.equal(p.table.length, 2);
});

test('planilla sin datos personales y con comillas cuando hace falta', () => {
  const csv = toCsv([o('p1', 'q1', { option: 'A, claro' })], facts, meta, { cut: 'none' });
  const [head, row] = csv.split('\n');
  assert.ok(head.startsWith('seudonimo,edad'));
  assert.ok(row.includes('"A, claro"'));
  assert.ok(!csv.includes('+549'));
});

test('ordenar: posición promedio, primero y último por opción', () => {
  const rk = new Map<string, StimulusMeta>([['k', { label: 'Tier list', format: 'ranking', options: ['Rock', 'Pop', 'Cumbia'] }]]);
  const obs = [
    o('p1', 'k', { order: ['Rock', 'Pop', 'Cumbia'] }, { kind: 'ranking' }),
    o('p2', 'k', { order: ['Pop', 'Rock', 'Cumbia'] }, { kind: 'ranking' }),
  ];
  const [b] = summarize(obs, facts, rk, { cut: 'none' });
  assert.equal(b.view?.type, 'ranking');
  if (b.view?.type !== 'ranking') return;
  assert.deepEqual(b.view.items.map((i) => [i.label, i.avgPos, i.firstPct, i.lastPct]), [['Rock', 1.5, 50, 0], ['Pop', 1.5, 50, 0], ['Cumbia', 3, 0, 100]]);
});

test('ráfaga agrupada: un bloque, % de la primera opción por ítem (con espacios y letras)', () => {
  const rm = new Map<string, StimulusMeta>([
    ['e', { label: '¿Vas?', labelA: 'VOY', labelB: 'NO VOY', itemLabels: ['Peña', 'After'] }],
    ['b', { label: 'Elegí', itemLabels: ['Twitch'], itemOptions: [['👍 ', '👎']] }],
  ]);
  const obs = [
    o('p1', 'e', { choices: ['A', 'B'] }), o('p2', 'e', { choices: ['A', 'A'] }),
    o('p1', 'b', { choices: ['👍'] }), o('p2', 'b', { choices: ['👎'] }),
  ];
  const blocks = summarize(obs, facts, rm, { cut: 'none', groupRafaga: true });
  assert.equal(blocks.length, 2);
  const e = blocks.find((x) => x.key === 'e')!.view;
  assert.equal(e?.type, 'split');
  if (e?.type === 'split') assert.deepEqual(e.items.map((i) => [i.label, i.a, i.aPct]), [['Peña', 'VOY', 100], ['After', 'VOY', 50]]);
  const bb = blocks.find((x) => x.key === 'b')!.view;
  if (bb?.type === 'split') assert.deepEqual(bb.items.map((i) => [i.a, i.aPct]), [['👍', 50]]);
});

test('escala: tramos, promedio y mediana', () => {
  const sm = new Map<string, StimulusMeta>([['s', { label: '0 a 100', format: 'slider', min: 0, max: 100 }]]);
  const obs = [10, 20, 30, 95].map((v, i) => o(['p1', 'p2', 'p1', 'p2'][i], 's', { value: v }, { kind: 'scale', value_number: v }));
  const [b] = summarize(obs, facts, sm, { cut: 'none' });
  if (b.view?.type !== 'scale') return assert.fail('sin vista de escala');
  assert.equal(b.view.mean, 38.8);
  assert.equal(b.view.median, 25);
  assert.equal(b.view.buckets[9].n, 1);
});

test('predicción: lo que creen vs lo que eligieron en la carta a la que apunta', () => {
  const mm = new Map<string, StimulusMeta>([
    ['q', { label: '¿Cita?', key: 'cita', options: ['Sigo', 'Chau'], order: 0 }],
    ['m', { label: '¿Qué eligió la mayoría?', format: 'market', refLabel: 'cita', order: 1 }],
  ]);
  const obs = [
    o('p1', 'q', { option: 'Chau' }), o('p2', 'q', { option: 'Chau' }),
    o('p1', 'm', { outcome: 'Sigo' }, { kind: 'bet', value_text: null }), o('p2', 'm', { outcome: 'Chau' }, { kind: 'bet', value_text: null }),
  ];
  const b = summarize(obs, facts, mm, { cut: 'none' }).find((x) => x.key === 'm')!;
  if (b.view?.type !== 'market') return assert.fail('sin vista de predicción');
  assert.equal(b.view.realMajority, 'Chau');
  assert.equal(b.view.hitPct, 50);
  assert.deepEqual(b.view.rows.map((r) => [r.label, r.predictedPct, r.realPct]), [['Sigo', 50, 0], ['Chau', 50, 100]]);
});
