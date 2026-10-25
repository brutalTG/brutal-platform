import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from './amigos/rules.ts';
import type { Member } from './amigos/types.ts';

const m = (id: string, position: number, status: Member['status'] = 'active'): Member =>
  ({ id, group_id: 'g', roster_name: id, pseudonym_id: `p-${id}`, position, status, missed: 0, joined_at: null });

test('la hora es la de Buenos Aires', () => {
  const d = R.atLocal('2026-11-03', 21);
  assert.equal(d.toISOString(), '2026-11-04T00:00:00.000Z');
  assert.deepEqual(R.local(d), { date: '2026-11-03', hour: 21, minute: 0, dow: 2 });
  assert.equal(R.addDays('2026-12-31', 1), '2027-01-01');
});

test('el reveal deja al menos hora y media de juego', () => {
  assert.equal(R.revealAtFor(R.atLocal('2026-11-03', 21), 23).toISOString(), R.atLocal('2026-11-03', 23).toISOString());
  assert.equal(R.revealAtFor(R.atLocal('2026-11-03', 22), 23).toISOString(), R.atLocal('2026-11-04', 23).toISOString());
});

test('lee A o B de muchas formas', () => {
  assert.equal(R.parseChoice('a', 'Me voy', 'Me quedo'), 'a');
  assert.equal(R.parseChoice('2', 'Me voy', 'Me quedo'), 'b');
  assert.equal(R.parseChoice('me quedo', 'Me voy', 'Me quedo'), 'b');
  assert.equal(R.parseChoice('Lo aprieto!', 'Lo aprieto', 'No lo aprieto'), 'a');
  assert.equal(R.parseChoice('no lo', 'Lo aprieto', 'No lo aprieto'), 'b');
  assert.equal(R.parseChoice('me', 'Me voy', 'Me quedo'), null);
  assert.equal(R.parseChoice('cualquiera', 'Me voy', 'Me quedo'), null);
});

test('lee la lista de amigos', () => {
  assert.deepEqual(R.parseRoster('Lu, Juan y Mati'), ['Lu', 'Juan', 'Mati']);
  assert.deepEqual(R.parseRoster('1. Lu\n2. Juan\nlu'), ['Lu', 'Juan']);
});

test('encuentra el código del grupo en el mensaje del link', () => {
  assert.equal(R.findCode('Me sumo a LOSPIBES #K7Q2M'), 'K7Q2M');
  assert.equal(R.findCode('grupo de los pibes'), null);
  assert.equal(R.findCode('GRUPO'), null);
  for (let i = 0; i < 50; i++) assert.match(R.newGroupCode(), /^(?=.*\d)[A-HJ-NP-Z2-9]{5}$/);
});

test('comandos', () => {
  assert.equal(R.command('Salir'), 'salir');
  assert.equal(R.command('BORRAME'), 'borrame');
  assert.equal(R.command('sí'), 'si');
  assert.equal(R.command('Quiero jugar con mi grupo'), 'nuevo');
  assert.equal(R.command('hola'), null);
});

test('el autor rota y nadie se manda el audio a sí mismo', () => {
  const ms = [m('a', 0), m('b', 1), m('c', 2), m('d', 3)];
  assert.deepEqual([1, 2, 3, 4, 5].map((d) => R.authorFor(ms, d)!.id), ['a', 'b', 'c', 'd', 'a']);
  for (let day = 1; day <= 8; day++) {
    const t = R.assignTargets(ms, day);
    for (const [from, to] of Object.entries(t)) assert.notEqual(from, to);
    assert.equal(new Set(Object.values(t)).size, 4, 'cada uno recibe un audio');
  }
});

test('a quién se apuesta', () => {
  const ms = [m('f', 0), m('l', 1, 'listed'), m('j', 2), m('x', 3, 'dormant')];
  assert.deepEqual(R.betTargets({ onboarding: true, me: ms[0], founderMemberId: 'f', members: ms, victimId: null }), ['l', 'j']);
  assert.deepEqual(R.betTargets({ onboarding: true, me: ms[2], founderMemberId: 'f', members: ms, victimId: null }), []);
  assert.deepEqual(R.betTargets({ onboarding: false, me: ms[0], founderMemberId: 'f', members: ms, victimId: null }), ['j']);
  assert.deepEqual(R.betTargets({ onboarding: false, me: ms[0], founderMemberId: 'f', members: ms, victimId: 'j' }), ['j']);
  assert.deepEqual(R.betTargets({ onboarding: false, me: ms[2], founderMemberId: 'f', members: ms, victimId: 'j' }), []);
});

test('puntaje: aciertos, víctima, autor que parte al grupo', () => {
  const answers = [
    { round_id: 'r', member_id: 'a', choice: 'a' as const, latency_ms: 1, answered_at: '' },
    { round_id: 'r', member_id: 'b', choice: 'b' as const, latency_ms: 1, answered_at: '' },
    { round_id: 'r', member_id: 'c', choice: 'a' as const, latency_ms: 1, answered_at: '' },
    { round_id: 'r', member_id: 'd', choice: 'b' as const, latency_ms: 1, answered_at: '' },
  ];
  const bets = [
    { round_id: 'r', bettor_member_id: 'a', target_member_id: 'b', guess: 'b' as const, correct: null },
    { round_id: 'r', bettor_member_id: 'a', target_member_id: 'c', guess: 'b' as const, correct: null },
    { round_id: 'r', bettor_member_id: 'b', target_member_id: 'z', guess: 'a' as const, correct: null },
  ];
  const s = R.scoreRound({ roundId: 'r', answers, bets, authorId: 'd', victimId: null });
  assert.deepEqual(s.graded.map((g) => g.correct), [true, false, null]);
  assert.equal(s.totals.get('a'), 10);
  assert.equal(s.totals.get('d'), 20, 'mitad y mitad: bono completo');
  const v = R.scoreRound({ roundId: 'r', answers, bets: [
    { round_id: 'r', bettor_member_id: 'a', target_member_id: 'b', guess: 'a', correct: null },
    { round_id: 'r', bettor_member_id: 'c', target_member_id: 'b', guess: 'a', correct: null },
  ], authorId: null, victimId: 'b' });
  assert.equal(v.totals.get('b'), R.POINTS.victimSafe, 'nadie leyó a la víctima');
  assert.equal(R.splitBonus(3, 0), 0);
});

test('etiquetas de fin de temporada, todas distintas', () => {
  const st = (id: string, rh: number, rt: number, gh: number, gt: number, v: number, a: number) => ({ member_id: id, reads_hit: rh, reads_total: rt, read_hit: gh, read_total: gt, voices: v, answered: a });
  const labels = R.seasonLabels([st('a', 9, 10, 2, 10, 1, 14), st('b', 1, 10, 9, 10, 0, 14), st('c', 5, 10, 0, 10, 7, 14), st('d', 5, 10, 5, 10, 0, 3), st('e', 5, 10, 5, 10, 0, 14)]);
  assert.equal(labels.get('a'), R.LABELS.bestReader);
  assert.equal(labels.get('b'), R.LABELS.worstReader);
  assert.equal(labels.get('c'), R.LABELS.unreadable);
  assert.equal(new Set(labels.values()).size, 5);
});
