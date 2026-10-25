import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hiloStep, hiloView, sessionMultiplier, birthDateFromAge, computeClaim, consistencyOf, multiplierFor, normalizeWallet, observationOf, parseLocation, resolveReward } from './drops-game.ts';

test('un menor nunca cobra plata', () => {
  assert.deepEqual(resolveReward({ cash: 0.2, tickets: 0, minor: null }, true), { cash: 0, tickets: 1 });
  assert.deepEqual(resolveReward({ cash: 0.2, tickets: 0, minor: 5 }, true), { cash: 0, tickets: 5 });
  assert.deepEqual(resolveReward({ cash: 0, tickets: 30, minor: null }, true), { cash: 0, tickets: 30 });
  assert.deepEqual(resolveReward({ cash: 0.2, tickets: 0, minor: null }, false), { cash: 0.2, tickets: 0 });
});

test('trampa fallada resta tickets y el multiplicador solo multiplica tickets', () => {
  const r = computeClaim([
    { position: 0, reward_currency: 'tickets', reward_value: 50, reward_granted: true, trap_correct: null, penalty: 0 },
    { position: 1, reward_currency: 'cash_usd', reward_value: 0.25, reward_granted: true, trap_correct: null, penalty: 0 },
    { position: 2, reward_currency: null, reward_value: 0, reward_granted: false, trap_correct: false, penalty: 30 },
    { position: 3, reward_currency: 'tickets', reward_value: 10, reward_granted: false, trap_correct: null, penalty: 0 },
  ], 1.5);
  assert.deepEqual(r, { usd: 0.25, tickets: 30 });
});

test('multiplicador: el más alto ya alcanzado', () => {
  assert.equal(multiplierFor({ '4': { multiplier: 1.25 }, '9': { multiplier: 1.5 } }, 10), 1.5);
  assert.equal(multiplierFor({ '4': { multiplier: 1.25 }, '9': { multiplier: 1.5 } }, 6), 1.25);
  assert.equal(multiplierFor(undefined, 6), 1);
});

test('respuestas a observaciones', () => {
  assert.equal(observationOf('choice', { options: ['Sí', 'No'] }, { choice_index: 1 }).text, 'No');
  assert.equal(observationOf('slider', {}, { slider_value: 7 }).kind, 'scale');
  assert.equal(observationOf('trap', {}, {}).kind, 'behavior');
});

test('varios', () => {
  assert.equal(normalizeWallet('@Nacho.Brutal'), 'nacho.brutal');
  assert.equal(normalizeWallet('a'), null);
  assert.equal(birthDateFromAge(20, new Date('2026-10-24T12:00:00Z')), '2006-10-24');
  assert.deepEqual(parseLocation('Buenos Aires > La Plata'), { province: 'Buenos Aires', city: 'La Plata' });
  assert.equal(consistencyOf([{ latency_ms: 1, created_at: '2026-01-01T00:00:00Z' }]), null);
});

test('mayor o menor: acierta, se planta, y un reintento no saca otra carta', () => {
  const deck = [7, 9, 9, 2];
  const draw = () => deck.shift()!;
  let h = hiloStep(null, 'start', undefined, draw);
  assert.deepEqual(h.cards, [7]);
  h = hiloStep(h, 'higher', undefined, draw, 0);
  assert.equal(h.multiplier, 1.5);
  h = hiloStep(h, 'higher', undefined, draw, 0); // reintento del paso 0
  assert.equal(h.cards.length, 2);
  h = hiloStep(h, 'higher', undefined, draw, 1); // 9 -> 9: empate cuenta
  assert.equal(h.multiplier, 2);
  h = hiloStep(h, 'stand');
  assert.equal(h.status, 'stood');
  assert.equal(hiloView(h).card, 9);
});

test('mayor o menor: si erra pierde el multiplicador', () => {
  const deck = [10, 3];
  const h = hiloStep(hiloStep(null, 'start', undefined, () => deck.shift()!), 'higher', undefined, () => deck.shift()!);
  assert.equal(h.status, 'busted');
  assert.equal(h.multiplier, 1);
  const v = hiloView(h);
  assert.deepEqual([v.card, v.next, v.ok, v.step], [10, 3, false, 0]);
});

test('multiplicador final: checkpoints por las manos ganadas', () => {
  assert.equal(sessionMultiplier(1.5, [{ status: 'stood', multiplier: 2 }, { status: 'busted', multiplier: 1 }]), 3);
  assert.equal(sessionMultiplier(1, []), 1);
});

test('voz y mayor o menor como observación', () => {
  const v = observationOf('voice', { optionA: 'Oficina', optionB: 'Remoto' }, { voice: { transcript: 'remoto obvio', stated: 'b', number: null, audio_path: 'x', speech_ms: 900, words: 2, first_word_ms: 300 } });
  assert.equal(v.kind, 'voice');
  assert.equal(v.text, 'Remoto');
  const g = observationOf('mayor_menor', {}, { hilo: { status: 'stood', multiplier: 3, steps: 3, cards: [], decisions: [] } });
  assert.equal(g.text, 'se plantó en x3');
});
