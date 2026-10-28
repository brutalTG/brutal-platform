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

// ---------- La máquina dentro del Drop ----------
import { applyDetector, detectorBudget, detectorConfig, detectorLabel, detectorOutcome, detectorReason, voiceScript, DEFAULT_DETECTOR } from './drops-game.ts';

const item = (position: number, committed: 'truth' | 'lie', f: Partial<{ decision_ms: number; onset_ms: number; speech_ms: number; fillers: number }> = {}) =>
  ({ position, committed, decision_ms: 900, onset_ms: 600, speech_ms: 9000, fillers: 0, ...f });

test('la máquina acusa la carta donde más dudó y acierta', () => {
  const r = detectorOutcome([item(1, 'truth'), item(2, 'lie', { decision_ms: 4200, speech_ms: 3000 }), item(3, 'truth')], DEFAULT_DETECTOR, 'partida');
  assert.ok(r);
  assert.deepEqual(r.accused, [2]);
  assert.equal(r.verdict, 'caught');
  assert.equal(r.tickets, -50);
  assert.equal(r.reason.position, 2);
  assert.match(detectorReason(r, (p) => `la ${p}`), /En la 2 /);
});

test('si la mentira pasó desapercibida, zafó y cobra el bonus', () => {
  const r = detectorOutcome([item(1, 'truth', { decision_ms: 5000 }), item(2, 'lie'), item(3, 'truth')], DEFAULT_DETECTOR, 'partida');
  assert.ok(r);
  assert.deepEqual(r.accused, [1]);
  assert.equal(r.verdict, 'escaped');
  assert.equal(r.tickets, 150);
});

test('la misma partida se acusa siempre igual, y con una sola carta no hay máquina', () => {
  const items = [item(1, 'truth'), item(2, 'lie'), item(3, 'truth')];
  assert.deepEqual(detectorOutcome(items, DEFAULT_DETECTOR, 'x')?.accused, detectorOutcome(items, DEFAULT_DETECTOR, 'x')?.accused);
  assert.equal(detectorOutcome([item(1, 'lie')], DEFAULT_DETECTOR), null);
});

const TWO = { ...DEFAULT_DETECTOR, lies: 2 };

test('dos mentiras en tres: te agarra solo si encuentra las dos', () => {
  const both = detectorOutcome([item(1, 'lie', { decision_ms: 4000 }), item(2, 'truth'), item(3, 'lie', { onset_ms: 3000 })], TWO, 'p');
  assert.ok(both);
  assert.deepEqual(both.accused, [1, 3]);
  assert.equal(both.caught, 2);
  assert.equal(both.verdict, 'caught');
  const one = detectorOutcome([item(1, 'lie', { decision_ms: 4000 }), item(2, 'truth', { onset_ms: 3000 }), item(3, 'lie')], TWO, 'p');
  assert.ok(one);
  assert.deepEqual(one.accused, [1, 2]);
  assert.equal(one.caught, 1);
  assert.equal(one.verdict, 'escaped');
  assert.equal(one.tickets, 150);
});

test('las cartas de la máquina se nombran por lo que preguntan', () => {
  assert.equal(detectorLabel({ detectorLabel: 'la del famoso' }, 1), 'la del famoso');
  assert.equal(detectorLabel({}, 2), 'la segunda');
  assert.equal(detectorLabel(null, 9), 'la 9');
});

test('la voz solo dice las cartas de voz y la presentación de la máquina', () => {
  assert.deepEqual(voiceScript([
    { format: 'voice', content: { text: 'Decí algo.' } },
    { format: 'voice', content: { text: 'Callada.', speak: false } },
    { format: 'dead_drop', content: { machine: true, speakText: '¿Creés que le podés mentir a una IA?' } },
    { format: 'dead_drop', content: { speakText: 'Esta no.' } },
    { format: 'choice', content: { text: 'Tampoco.' } },
  ]), ['Decí algo.', '¿Creés que le podés mentir a una IA?']);
});

test('presupuesto de mentiras: una en tres', () => {
  assert.deepEqual(detectorBudget(3, 1, []), { remainingLies: 1, remainingItems: 3, mustLie: false, mustTell: false });
  assert.deepEqual(detectorBudget(3, 1, ['truth', 'truth']), { remainingLies: 1, remainingItems: 1, mustLie: true, mustTell: false });
  assert.deepEqual(detectorBudget(3, 1, ['lie']), { remainingLies: 0, remainingItems: 2, mustLie: false, mustTell: true });
});

test('la máquina suma o resta tickets, nunca deja negativo', () => {
  assert.equal(applyDetector(100, { tickets: 150 } as any), 250);
  assert.equal(applyDetector(20, { tickets: -50 } as any), 0);
  assert.equal(applyDetector(20, null), 20);
  assert.deepEqual(detectorConfig({ lies: 2, winTickets: '100', loseTickets: -3 }), { lies: 2, winTickets: 100, loseTickets: 50 });
  assert.equal(detectorConfig(null), null);
});

// ---------- Link de grupo ----------
import { cleanNickname, guestPhone, isGuestPhone, joinConfig } from './drops-game.ts';

test('link de grupo: configuración, apodo y teléfono inventado', () => {
  assert.deepEqual(joinConfig({ code: 'Mentime', max: 30 }), { code: 'mentime', open: true, max: 30 });
  assert.deepEqual(joinConfig({ code: 'mentime', open: false }), { code: 'mentime', open: false, max: 50 });
  assert.equal(joinConfig({ code: 'a b' }), null);
  assert.equal(joinConfig(null), null);
  assert.equal(cleanNickname('  Juan   Cruz \n'), 'Juan Cruz');
  assert.equal(cleanNickname('x'), null);
  assert.equal(cleanNickname('a'.repeat(40))?.length, 20);
  const p = guestPhone(() => 0.5);
  assert.equal(p, '+99955555555555');
  assert.match(p, /^\+[1-9][0-9]{7,14}$/, 'pasa la regla de teléfonos de la base');
  assert.ok(isGuestPhone(p));
  assert.ok(!isGuestPhone('+5491155550000'));
});

// ---------- Detalle fino de cada respuesta ----------
import { cleanMeta } from './drops-game.ts';

test('el detalle fino se guarda dentro de la observación, saneado', () => {
  const o = observationOf('rafaga_emoji', {}, { rafaga_choices: ['A', 'B'], meta: { item_latency_ms: [420, 2800] } });
  assert.deepEqual((o.value as any).meta, { item_latency_ms: [420, 2800] });
  assert.deepEqual((o.value as any).choices, ['A', 'B']);
  assert.deepEqual(cleanMeta('{"bet":30}'), { bet: 30 });
  assert.equal(cleanMeta('no es json'), null);
  assert.equal(cleanMeta([1, 2]), null);
  assert.equal(cleanMeta({}), null);
  assert.equal(cleanMeta({ x: 'a'.repeat(5000) }), null);
  assert.equal((observationOf('choice', { options: ['Sí'] }, { choice_index: 0 }).value as any).meta, undefined);
});
