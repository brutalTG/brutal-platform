import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectAudience, type Candidate } from './launch-rules.ts';

const c = (id: string, p: Partial<Candidate> = {}): Candidate => ({ id, phone: `+54911000000${id}`, status: 'active', age: 20, is_minor: false, gender: 'Mujer', province: 'CABA', opted_out: false, already_played: false, ...p });

test('nunca a bloqueados, dados de baja ni a los que ya jugaron', () => {
  const r = selectAudience([c('1'), c('2', { status: 'blocked' }), c('3', { opted_out: true }), c('4', { already_played: true })], { type: 'all' });
  assert.deepEqual(r.selected.map((x) => x.id), ['1']);
  assert.deepEqual(r.skipped, { opted_out: 1, already_played: 1, not_allowed: 1 });
});

test('filtro por edad, género, zona y menores', () => {
  const all = [c('1', { age: 16, is_minor: true }), c('2', { age: 25, gender: 'Hombre' }), c('3', { age: 30, province: 'Córdoba' })];
  assert.deepEqual(selectAudience(all, { type: 'filter', minAge: 18 }).selected.map((x) => x.id), ['2', '3']);
  assert.deepEqual(selectAudience(all, { type: 'filter', genders: ['mujer'] }).selected.map((x) => x.id), ['1', '3']);
  assert.deepEqual(selectAudience(all, { type: 'filter', provinces: ['cordoba'] }).selected.map((x) => x.id), ['3']);
  assert.deepEqual(selectAudience(all, { type: 'filter', minors: 'only' }).selected.map((x) => x.id), ['1']);
});

test('lista de números', () => {
  assert.deepEqual(selectAudience([c('1'), c('2')], { type: 'phones', phones: ['+549110000002'] }).selected.map((x) => x.id), ['2']);
});
