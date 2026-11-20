import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportResults, excelSheets } from './results-export.ts';
import { xlsx } from './xlsx.ts';
import type { Facts, Obs, StimulusMeta } from './results.ts';

const o = (p: string, stim: string, value: any, extra: Partial<Obs> = {}): Obs => ({
  pseudonym_id: p, stimulus_id: stim, kind: 'choice', quality: 'valid', value, value_text: value?.option ?? null, value_number: null,
  latency_ms: 1200, position: 1, stimulus: {}, context: {}, observed_at: '2026-11-20T00:00:00Z', ...extra,
});
const facts = new Map<string, Facts>([
  ['p1', { age: 19, is_minor: false, gender: 'Mujer', province: 'CABA', status: 'active' }],
  ['p2', { age: 24, is_minor: false, gender: 'Hombre', province: 'Córdoba', status: 'active' }],
]);
const meta = new Map<string, StimulusMeta>([
  ['c', { label: '¿Viernes?', options: ['Entero', 'Destruido'], order: 0 }],
  ['r', { label: 'Tier list', format: 'ranking', options: ['Rock', 'Pop'], order: 1 }],
  ['e', { label: '¿Vas?', labelA: 'VOY', labelB: 'NO VOY', itemLabels: ['Peña'], itemOptions: [['🙋', '🙅']], order: 2 }],
]);
const obs = [
  o('p1', 'c', { option: 'Entero' }), o('p2', 'c', { option: 'Destruido' }),
  o('p1', 'r', { order: ['Rock', 'Pop'] }, { kind: 'ranking' }), o('p2', 'r', { order: ['Pop', 'Rock'] }, { kind: 'ranking' }),
  o('p1', 'e', { choices: ['A'] }), o('p2', 'e', { choices: ['B'] }),
  o('p2', 'c', { option: 'Entero' }, { context: { test: true } }),
];

test('archivo para Claude: participantes, resultado por tipo y sin pruebas', () => {
  const d = exportResults({ obs, facts, meta, name: 'Tu tribu', app: 'drops', id: 'tribu', study: null, opt: {}, now: new Date('2026-11-20T00:00:00Z') });
  assert.equal(d.participantes.n, 2);
  const [c, r, e] = d.preguntas as any[];
  assert.equal(c.tipo_resultado, 'eleccion');
  assert.deepEqual(c.respuestas.map((x: any) => [x.respuesta, x.pct]), [['Entero', 50], ['Destruido', 50]]);
  assert.equal(r.tipo_resultado, 'ranking');
  assert.equal(r.opciones[0].posicion_promedio, 1.5);
  assert.equal(e.tipo_resultado, 'rafaga');
  assert.deepEqual([e.items[0].opcion_a, e.items[0].pct_a], ['🙋 VOY', 50]);
});

test('excel: hojas y un .xlsx válido (zip)', () => {
  const d = exportResults({ obs, facts, meta, name: 'Tu tribu', app: 'drops', id: 'tribu', study: null, opt: {} });
  const sheets = excelSheets(d, { obs, facts, meta, opt: {} });
  assert.deepEqual(sheets.map((s) => s.name), ['Resumen', 'Por edad', 'Por género', 'Por zona', 'Quiénes respondieron', 'Respuestas']);
  assert.equal(sheets[5].rows.length, 1 + 6); // encabezado + 2 elecciones + 2 rankings + 2 ráfagas, sin la prueba
  const file = xlsx(sheets);
  assert.equal(file.readUInt32LE(0), 0x04034b50);
});
