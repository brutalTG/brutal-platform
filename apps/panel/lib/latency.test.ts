import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doubtIndex, latencySamples, readingOf, words } from './latency.ts';
import { exportResults } from './results-export.ts';
import type { Facts, Obs, StimulusMeta } from './results.ts';

const o = (p: string, stim: string, value: any, ms: number | null, extra: Partial<Obs> = {}): Obs => ({
  pseudonym_id: p, stimulus_id: stim, kind: 'choice', quality: 'valid', value, value_text: value?.option ?? null, value_number: null,
  latency_ms: ms, position: 1, stimulus: {}, context: {}, observed_at: '2026-11-20T00:00:00Z', ...extra,
});
const facts = new Map<string, Facts>([
  ['p1', { age: 19, is_minor: false, gender: 'Mujer', province: 'CABA', status: 'active' }],
  ['p2', { age: 24, is_minor: false, gender: 'Hombre', province: 'Córdoba', status: 'active' }],
]);
// "¿Viernes?" = 1 palabra. "Corto" = 1. "Me fui a vivir a Madrid" = 6.
const meta = new Map<string, StimulusMeta>([
  ['c', { label: '¿Viernes?', options: ['Corto', 'Me fui a vivir a Madrid'], order: 0 }],
  ['d', { label: 'Uno dos', options: ['Sí', 'No'], order: 1 }],
  ['e', { label: 'Tres cuatro', options: ['Sí', 'No'], order: 2 }],
  ['r', { label: '¿Vas?', labelA: 'VOY', labelB: 'NO VOY', itemLabels: ['Peña folklórica'], itemOptions: [['🙋', '🙅']], order: 3 }],
]);

test('palabras: emoji no cuenta, signos tampoco', () => {
  assert.equal(words('¿Me fui a Madrid? 🙋'), 4);
  assert.equal(words(''), 0);
});

test('la opción larga tarda más por leer, no por dudar', () => {
  // Esperado "Corto": 4250 + 120 × 2 = 4490. "Madrid": 4250 + 120 × 8 = 5210.
  const obs = [o('p1', 'c', { option: 'Corto' }, 4490), o('p2', 'c', { option: 'Me fui a vivir a Madrid' }, 5210)];
  const s = latencySamples(obs, facts, meta, {});
  assert.deepEqual(s.map((x) => x.words), [2, 8]);
  const { index } = doubtIndex(s);
  assert.equal(index.get('c')!.get('Corto')!.duda_mediana, 1);
  assert.equal(index.get('c')!.get('Me fui a vivir a Madrid')!.duda_mediana, 1);
});

test('el ritmo de la persona: un lento no parece dudar en todo', () => {
  const slow = [o('p1', 'c', { option: 'Corto' }, 4490 * 2), o('p1', 'd', { option: 'Sí' }, (4250 + 120 * 3) * 2), o('p1', 'e', { option: 'No' }, (4250 + 120 * 4) * 4)];
  const { index } = doubtIndex(latencySamples(slow, facts, meta, {}));
  assert.equal(index.get('c')!.get('Corto')!.lectura, 'normal');
  assert.equal(index.get('e')!.get('No')!.lectura, 'duda'); // tardó el doble de su propio ritmo
});

test('ráfaga por ítem, sin tiempos agotados ni pruebas', () => {
  const obs = [
    o('p1', 'r', { choices: ['A'], meta: { item_latency_ms: [3000] } }, null),
    o('p2', 'c', { option: 'Corto', timed_out: true }, 9000),
    o('p2', 'c', { option: 'Corto' }, 9000, { context: { test: true } }),
  ];
  const s = latencySamples(obs, facts, meta, {});
  assert.equal(s.length, 1);
  assert.equal(s[0].key, 'r#0');
  assert.equal(s[0].words, 3); // "Peña folklórica" + "VOY"
  assert.equal(readingOf(0.5), 'reflejo');
});

test('el archivo para Claude trae la duda y avisa que el crudo no se lee', () => {
  const obs = [o('p1', 'c', { option: 'Corto' }, 4490), o('p2', 'c', { option: 'Me fui a vivir a Madrid' }, 5210 * 2)];
  const d = exportResults({ obs, facts, meta, name: 'x', app: 'drops', id: 'x', study: null, opt: {} }) as any;
  assert.match(d.como_leerlo, /NO se lee/);
  assert.ok(d.latencia.formula.includes('4.25'));
  const q = d.preguntas[0];
  const madrid = q.respuestas.find((r: any) => r.respuesta.includes('Madrid'));
  assert.equal(madrid.duda, 2);
  assert.equal(madrid.lectura_tiempo, 'duda');
  assert.equal(madrid.palabras_leidas, 8);
});

test('calentamiento: el primer ítem de una ráfaga no se lee como duda ni mueve el ritmo', () => {
  const obs = [
    o('p1', 'r', { choices: ['A', 'A', 'B'], meta: { item_latency_ms: [6000, 1500, 1500] } }, null),
    o('p2', 'r', { choices: ['B', 'A', 'A'], meta: { item_latency_ms: [6000, 1500, 1500] } }, null),
  ];
  const { index } = doubtIndex(latencySamples(obs, facts, meta, {}));
  assert.equal(index.get('r#0')!.get('*')!.lectura, 'calentamiento');
  assert.equal(index.get('r#1')!.get('*')!.lectura, 'normal');
});
