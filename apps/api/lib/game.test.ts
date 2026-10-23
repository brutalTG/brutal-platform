import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accuse, countFillers, lieBudget, outcome, parseAnswer, parseNumber, reasonText, truthOf, type ItemResult } from './game.ts';

test('entiende sí y no como los dice un pibe', () => {
  assert.equal(parseAnswer('yes_no', 'Sí, obvio').kind, 'yes');
  assert.equal(parseAnswer('yes_no', 'Mal, lloré un montón').kind, 'yes');
  assert.equal(parseAnswer('yes_no', 'No, ni en pedo').kind, 'no');
  assert.equal(parseAnswer('yes_no', 'Nunca.').kind, 'no');
  assert.equal(parseAnswer('yes_no', 'No sé').kind, 'unclear');
  assert.equal(parseAnswer('yes_no', '').kind, 'unclear');
  assert.equal(parseAnswer('yes_no', 'Ehh bueno').kind, 'unclear');
});

test('entiende acuerdo y desacuerdo', () => {
  assert.equal(parseAnswer('agree', 'Estoy de acuerdo').kind, 'agree');
  assert.equal(parseAnswer('agree', 'No estoy de acuerdo').kind, 'disagree');
  assert.equal(parseAnswer('agree', 'Sí, totalmente').kind, 'agree');
  assert.equal(parseAnswer('agree', 'Para nada').kind, 'disagree');
  assert.equal(parseAnswer('agree', 'Depende').kind, 'unclear');
});

test('lee la edad dicha en palabras o números', () => {
  assert.equal(parseNumber('Tengo 19'), 19);
  assert.equal(parseNumber('dieciséis'), 16);
  assert.equal(parseNumber('veintitrés años'), 23);
  assert.equal(parseNumber('ochenta'), 80);
  assert.equal(parseNumber('treinta y dos'), 32);
  assert.equal(parseNumber('no te digo'), null);
});

test('si mintió, la verdad es la opuesta', () => {
  assert.equal(truthOf('yes', 'lie'), 'no');
  assert.equal(truthOf('agree', 'truth'), 'agree');
  assert.equal(truthOf('disagree', 'lie'), 'agree');
  assert.equal(truthOf('unclear', 'lie'), null);
});

test('el presupuesto de mentiras obliga a mentir al final y prohíbe pasarse', () => {
  const t = { committed: 'truth' as const }, l = { committed: 'lie' as const };
  assert.deepEqual(lieBudget(10, 3, []).mustLie, false);
  assert.equal(lieBudget(10, 3, [t, t, t, t, t, t, t]).mustLie, true);
  assert.equal(lieBudget(10, 3, [l, l, l]).mustTell, true);
  assert.equal(lieBudget(10, 3, [l, t]).remainingLies, 2);
});

function game(lieAt: number[], slowAt: number[]): ItemResult[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `q${i + 1}`,
    position: i + 1,
    committed: lieAt.includes(i + 1) ? 'lie' : 'truth',
    features: {
      decision_ms: slowAt.includes(i + 1) ? 2600 : 700 + i * 13,
      onset_ms: slowAt.includes(i + 1) ? 1500 : 500,
      speech_ms: 1500, pauses: slowAt.includes(i + 1) ? 2 : 0, fillers: 0, pitch_mean: 150,
    },
  }));
}

test('la máquina acusa donde la persona dudó', () => {
  const items = game([2, 5, 9], [2, 5, 9]);
  const picks = accuse(items, 3, { truth: [{ speech_ms: 1500 }], lie: { speech_ms: 900 } }, undefined, 's1');
  assert.deepEqual(picks.map((p) => p.position), [2, 5, 9]);
  assert.match(reasonText(picks[0]), /En la 2/);
  const o = outcome(items, picks, { win_max_caught: 0 }, { per_answer: 50, max: 500, win_bonus: 200 }, 10, true);
  assert.equal(o.caught, 3);
  assert.equal(o.verdict, 'caught');
  assert.equal(o.tickets.total, 500);
});

test('si no le agarra ninguna, gana 500 + 200', () => {
  const items = game([1, 4, 7], [2, 5, 9]);
  const picks = accuse(items, 3, { truth: [], lie: null }, undefined, 's2');
  const o = outcome(items, picks, { win_max_caught: 0 }, { per_answer: 50, max: 500, win_bonus: 200 }, 10, true);
  assert.equal(o.caught, 0);
  assert.equal(o.verdict, 'escaped');
  assert.deepEqual(o.tickets, { progress: 500, win: 200, total: 700 });
});

test('la revancha no cobra y los tickets nunca pasan el máximo', () => {
  const items = game([1, 4, 7], [2, 5, 9]);
  const picks = accuse(items, 3, { truth: [], lie: null });
  assert.equal(outcome(items, picks, { win_max_caught: 0 }, { per_answer: 50, max: 500, win_bonus: 200 }, 10, false).tickets.total, 0);
  assert.equal(outcome(items, picks, { win_max_caught: 0 }, { per_answer: 80, max: 500, win_bonus: 200 }, 10, true).tickets.progress, 500);
});

test('la misma partida siempre da la misma acusación', () => {
  const items = game([1, 4, 7], []);
  const a = accuse(items, 3, { truth: [], lie: null }, undefined, 'x').map((p) => p.id);
  const b = accuse(items, 3, { truth: [], lie: null }, undefined, 'x').map((p) => p.id);
  assert.deepEqual(a, b);
});

test('cuenta muletillas', () => {
  assert.equal(countFillers('Eh, este, o sea, sí'), 3);
  assert.equal(countFillers('Sí'), 0);
});

import { accusationText, claimFor, joinClaims, shouldFollowUp } from './game.ts';

test('la máquina acusa con lo que dijo el jugador', () => {
  const it = { position: 5, claim_yes: 'que stalkeaste a un ex', claim_no: 'que no stalkeaste a ningún ex' };
  assert.equal(claimFor('no', it), 'que no stalkeaste a ningún ex');
  assert.equal(claimFor('agree', it), 'que stalkeaste a un ex');
  assert.equal(claimFor('unclear', it), 'lo que contestaste en la 5');
  assert.equal(joinClaims(['a', 'b', 'c']), 'a, b y c');
  assert.equal(accusationText('Mentiste cuando dijiste {claims}.', [{ position: 1, claim: 'x' }, { position: 2, claim: 'y' }]), 'Mentiste cuando dijiste x y y.');
  assert.equal(accusationText('En la {a}, la {b} y la {c}.', [{ position: 1, claim: '' }, { position: 4, claim: '' }, { position: 9, claim: '' }]), 'En la 1, la 4 y la 9.');
});

test('la repregunta respeta lo que contestó', () => {
  assert.equal(shouldFollowUp('yes', 'disagree'), false);
  assert.equal(shouldFollowUp('yes', 'agree'), true);
  assert.equal(shouldFollowUp('no', 'no'), true);
  assert.equal(shouldFollowUp('always', undefined), true);
  assert.equal(shouldFollowUp('yes', undefined), false);
});

import { parseChoice } from './game.ts';

test('entiende cuál de las dos opciones eligió', () => {
  const a = 'Lo denunciás', b = 'Lo cubrís';
  assert.equal(parseChoice('Lo denuncio, obvio', a, b).kind, 'a');
  assert.equal(parseChoice('Y... lo cubro', a, b).kind, 'b');
  assert.equal(parseChoice('La segunda', a, b).kind, 'b');
  assert.equal(parseChoice('lo primero', a, b).kind, 'a');
  assert.equal(parseChoice('no sé, ninguna', a, b).kind, 'unclear');
  const x = 'Sueldo fijo con jefe encima', y = 'El triple sin saber si cobrás';
  assert.equal(parseChoice('el triple, ni lo dudo', x, y).kind, 'b');
  assert.equal(parseChoice('prefiero el sueldo fijo', x, y).kind, 'a');
  assert.equal(truthOf('a', 'lie'), 'b');
  assert.equal(claimFor('b', { position: 2, claim_yes: 'que lo denunciás', claim_no: 'que lo cubrís' }), 'que lo cubrís');
  assert.equal(shouldFollowUp('yes', 'a'), true);
});

test('mayor o menor: empate es acierto y el multiplicador redondea', async () => {
  const { hiloOk, applyMultiplier, drawCard } = await import('./game.ts');
  assert.equal(hiloOk(7, 9, 'higher'), true);
  assert.equal(hiloOk(7, 7, 'lower'), true);
  assert.equal(hiloOk(7, 3, 'higher'), false);
  assert.deepEqual(applyMultiplier({ progress: 450, win: 200, total: 650 }, 1.5), { progress: 675, win: 300, total: 975, multiplier: 1.5 });
  assert.equal(applyMultiplier({ progress: 100, win: 0, total: 100 }, NaN).total, 100);
  for (let i = 0; i < 200; i++) { const c = drawCard(); assert.ok(c >= 1 && c <= 13); }
});
