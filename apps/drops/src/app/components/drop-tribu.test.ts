// Drop "Tu tribu" (política y cultura): reglas del contenido, controladas sobre el archivo que se carga en la base.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveScoring, computeDimensionsWithOptions, pickArchetype, type UserAnswer } from './archetype-engine.ts';

const sql = readFileSync(new URL('../../../../../packages/db/content/drop-tribu.sql', import.meta.url), 'utf8');
const block = (tag: string) => JSON.parse(sql.split(`$${tag}$`)[1]);
const cards: { pos: number; label: string; format: string; timer_s: number; tickets: number; tags: string[]; content: any }[] = block('cards');
const extras: { label: string; format: string; content: any }[] = block('extras');
const reveal = block('reveal');

test('Tu tribu: solo mayores de 18, en borrador y con el link cerrado', () => {
  assert.match(sql, /'minAge', 18/);
  assert.match(sql, /'tribu', 'TU TRIBU', 'draft'/);
  assert.match(sql, /'open', false/);
});

test('Tu tribu: 15 cartas + 3 mercados en orden, etiquetas únicas, todo de un toque y solo tickets', () => {
  assert.equal(cards.length, 18);
  assert.equal(cards.filter((c) => c.format === 'market').length, 3);
  assert.deepEqual(cards.map((c) => c.pos), cards.map((_, i) => i));
  const labels = [...cards, ...extras].map((c) => c.label);
  assert.equal(new Set(labels).size, labels.length);
  for (const c of cards.filter((x) => x.format !== 'market')) {
    assert.ok(!['voice', 'confesionario', 'dead_drop'].includes(c.format), c.label);
    assert.ok(c.tickets > 0, `${c.label} paga tickets`);
    assert.ok(c.tags.includes('nucleo') || c.tags.includes('relleno'), `${c.label} dice si es núcleo o relleno`);
  }
  assert.ok(!/reward_cash_usd\s*=\s*0\.\d|, 0\.\d+, c\.tickets/.test(sql));
});

test('Tu tribu: las ráfagas de botones tienen de 2 a 4 opciones y consigna visible', () => {
  for (const c of cards.filter((x) => x.format === 'rafaga_burst')) {
    assert.ok(c.content.prompt, `${c.label} tiene consigna`);
    for (const it of c.content.items) {
      assert.equal(it.interaction.type, 'button_multi');
      assert.ok(it.interaction.options.length >= 2 && it.interaction.options.length <= 4, c.label);
    }
  }
  for (const c of cards.filter((x) => x.format === 'rafaga_emoji')) assert.ok(c.content.labelA && c.content.labelB, c.label);
});

test('Tu tribu: cada predicción va justo después de su carta, paga lo mismo por opción y tiene un % simulado por opción', () => {
  for (const m of cards.filter((c) => c.format === 'market')) {
    const ref = cards.find((c) => c.label === m.content.ref)!;
    assert.ok(ref, m.label);
    assert.equal(ref.pos, m.pos - 1, `${m.label} va pegado a ${ref.label}`);
    assert.equal(m.content.prices, undefined, `${m.label} sin precios`);
    assert.equal(m.content.stakes, undefined, `${m.label} sin apuesta`);
    assert.ok(m.content.payout > 0, `${m.label} tiene premio`);
    assert.equal(m.content.sim.length, ref.content.options.length, m.label);
    assert.ok(!ref.tags.includes('politica'), 'los mercados no apuestan sobre política');
  }
});

test('Tu tribu: lo político queda al final y nunca entra al perfil', () => {
  const political = cards.filter((c) => c.tags.includes('politica'));
  assert.ok(political.length >= 3);
  assert.ok(Math.min(...political.map((c) => c.pos)) >= 11, 'la autoubicación va al final');
  const scored = [...reveal.scoring.choiceScoring, ...reveal.scoring.rafagaScoring].map((r: { questionLabel: string }) => r.questionLabel);
  for (const c of political) assert.ok(!scored.includes(c.label), `${c.label} no puede decidir el perfil`);
  const text = JSON.stringify(reveal.archetypes).toLowerCase();
  for (const w of ['peronis', 'liberal', 'kirchner', 'izquierda', 'derecha', 'milei', 'facho', 'zurdo', 'libertari']) assert.ok(!text.includes(w), w);
  assert.equal(reveal.label, 'Tu tribu');
});

test('Tu tribu: las reglas del perfil apuntan a cartas que existen con la cantidad de opciones correcta', () => {
  const byLabel = new Map(cards.map((c) => [c.label, c]));
  for (const r of reveal.scoring.choiceScoring) assert.equal(r.optionScores.length, byLabel.get(r.questionLabel)!.content.options.length, r.questionLabel);
  for (const r of reveal.scoring.rafagaScoring) assert.ok(byLabel.get(r.questionLabel), r.questionLabel);
});

test('Tu tribu: los seis perfiles salen parejos con respuestas al azar', () => {
  let seed = 11;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const pick = (n: number) => Math.floor(rand() * n);
  const scoring = resolveScoring(reveal.scoring, cards.map((c) => c.label));
  const options: Record<number, string[]> = Object.fromEntries(cards.map((c, i) => [i, c.content.options ?? []]));
  const counts: Record<string, number> = {};
  const N = 4000;
  for (let n = 0; n < N; n++) {
    const answers: Record<number, UserAnswer> = {};
    cards.forEach((c, i) => {
      if (c.format === 'choice') answers[i] = { type: 'choice', selectedIndex: pick(c.content.options.length) };
      if (c.format === 'slider') answers[i] = { type: 'slider', value: pick(101) };
      if (c.format === 'rafaga_emoji') answers[i] = { type: 'rafaga', answers: c.content.items.map(() => (rand() < 0.5 ? 'A' : 'B')) };
    });
    const a = pickArchetype(computeDimensionsWithOptions(answers, scoring, 0, options), reveal.archetypes);
    counts[a.id] = (counts[a.id] ?? 0) + 1;
  }
  const share = Object.fromEntries(reveal.archetypes.map((a: { id: string }) => [a.id, Math.round(((counts[a.id] ?? 0) / N) * 100)]));
  for (const [id, pct] of Object.entries(share)) assert.ok(pct >= 8 && pct <= 28, `perfil ${id}: ${pct}% (${JSON.stringify(share)})`);
});
