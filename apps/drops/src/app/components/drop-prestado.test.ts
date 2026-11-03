// Drop 002 "El puesto prestado": las reglas que salieron del test de Drop 001, controladas sobre el archivo de contenido.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveScoring, computeDimensionsWithOptions, pickArchetype, type UserAnswer } from './archetype-engine.ts';
import { getActionHint } from './survey-constants.ts';
import { randomNickname } from './nickname.ts';

const sql = readFileSync(new URL('../../../../../packages/db/content/drop-prestado.sql', import.meta.url), 'utf8');
const block = (tag: string) => JSON.parse(sql.split(`$${tag}$`)[1]);
const cards: { pos: number; label: string; format: string; timer_s: number; tickets: number; content: any }[] = block('cards');
const reveal = block('reveal');

test('Drop 002: nada de voz ni de texto, todo de un toque', () => {
  const open = ['voice', 'confesionario', 'dead_drop'];
  assert.deepEqual(cards.filter((c) => open.includes(c.format)).map((c) => c.label), []);
  assert.ok(!/voice_id|eleven_multilingual|"speak"/.test(sql), 'no queda configuración de voz');
});

test('Drop 002: solo tickets, ninguna carta paga plata', () => {
  assert.ok(!/cash\s*[:=]\s*0?\.\d|reward_cash_usd\s*=\s*0\.\d/.test(sql));
  for (const c of cards) if (c.format !== 'mayor_menor') assert.ok(c.tickets > 0, `${c.label} paga tickets`);
});

test('Drop 002: tiempos que alcanzan (elegir ≥ 18 s, ráfaga ≥ 4 s por ítem)', () => {
  for (const c of cards) {
    if (['choice', 'slider', 'ranking'].includes(c.format)) assert.ok(c.timer_s >= 18, `${c.label}: ${c.timer_s}s`);
    if (c.format === 'rafaga_emoji') {
      assert.ok(c.content.secondsPerItem >= 4, c.label);
      assert.ok(c.content.labelA && c.content.labelB, `${c.label} dice qué es cada emoji`);
    }
  }
});

test('Drop 002: posiciones seguidas y etiquetas únicas', () => {
  assert.deepEqual(cards.map((c) => c.pos), cards.map((_, i) => i));
  assert.equal(new Set(cards.map((c) => c.label)).size, cards.length);
});

test('Drop 002: las reglas del perfil apuntan a cartas que existen y con la cantidad de opciones correcta', () => {
  const byLabel = new Map(cards.map((c) => [c.label, c]));
  for (const r of reveal.scoring.choiceScoring) {
    const c = byLabel.get(r.questionLabel);
    assert.ok(c, r.questionLabel);
    assert.equal(r.optionScores.length, c!.content.options.length, r.questionLabel);
  }
  for (const r of [...reveal.scoring.rafagaScoring, ...reveal.scoring.sliderScoring, ...reveal.scoring.rankingScoring]) assert.ok(byLabel.get(r.questionLabel), r.questionLabel);
});

// Jugadores al azar: no es la gente real, pero si al azar dos perfiles se llevan todo, el sesgo está en las reglas.
test('Drop 002: los seis perfiles salen parejos con respuestas al azar', () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const pick = (n: number) => Math.floor(rand() * n);
  const scoring = resolveScoring(reveal.scoring, cards.map((c) => c.label));
  const options: Record<number, string[]> = Object.fromEntries(cards.map((c, i) => [i, c.content.options ?? []]));
  const counts: Record<string, number> = {};
  const N = 4000;
  for (let n = 0; n < N; n++) {
    const answers: Record<number, UserAnswer> = {};
    cards.forEach((c, i) => {
      if (c.format === 'choice' || c.format === 'hot_take') answers[i] = { type: c.format, selectedIndex: pick(c.content.options.length) } as UserAnswer;
      if (c.format === 'slider') answers[i] = { type: 'slider', value: pick(101) };
      if (c.format === 'rafaga_emoji') answers[i] = { type: 'rafaga', answers: c.content.items.map(() => (rand() < 0.5 ? 'A' : 'B')) };
      if (c.format === 'ranking') answers[i] = { type: 'ranking', order: [...c.content.options].sort(() => rand() - 0.5) };
    });
    const a = pickArchetype(computeDimensionsWithOptions(answers, scoring, 0, options), reveal.archetypes);
    counts[a.id] = (counts[a.id] ?? 0) + 1;
  }
  const share = Object.fromEntries(reveal.archetypes.map((a: { id: string }) => [a.id, Math.round(((counts[a.id] ?? 0) / N) * 100)]));
  for (const [id, pct] of Object.entries(share)) {
    assert.ok(pct >= 8 && pct <= 28, `perfil ${id}: ${pct}% (${JSON.stringify(share)})`);
  }
});

test('la consigna de cada carta dice cuántos tickets paga', () => {
  assert.equal(getActionHint({ type: 'choice', reward: { type: 'tickets', value: 40 } } as any), 'Elegí una · +40 🎟');
  assert.equal(getActionHint({ type: 'choice', reward: { type: 'coins', value: 0.25 } } as any), 'Elegí una');
  assert.equal(getActionHint({ type: 'choice' } as any), 'Elegí una');
});

test('el apodo viene puesto y cabe en el campo', () => {
  for (let i = 0; i < 200; i++) {
    const n = randomNickname();
    assert.ok(n.length >= 2 && n.length <= 20, n);
  }
});
