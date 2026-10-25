import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTexts, formatLocations, ONBOARDING_DEFAULTS, parseLocations, withDefaults } from './onboarding.ts';

const form = (over: Record<string, string> = {}) => {
  const d = ONBOARDING_DEFAULTS;
  const base: Record<string, string> = {
    'intro.title': d.intro.title, 'intro.subtitle': d.intro.subtitle, 'nickname.copy': d.nickname.copy, 'nickname.placeholder': d.nickname.placeholder,
    'age.copy': d.age.copy, 'age.min': '15', 'age.max': '35', 'age.rejectMessage': d.age.rejectMessage,
    'gender.copy': d.gender.copy, 'gender.options': d.gender.options.join('\n'), 'location.copy': d.location.copy,
    'location.options': formatLocations(d.location.options), 'platforms.copy': d.platforms.copy,
    'platforms.options': d.platforms.options.join('\n'), 'platforms.minSelect': '1', 'platforms.maxSelect': '3',
  };
  return (k: string) => ({ ...base, ...over })[k] ?? '';
};

test('los valores de fábrica vuelven iguales', () => {
  assert.deepEqual(buildTexts(form()).texts, ONBOARDING_DEFAULTS);
});

test('lugares con barrios', () => {
  assert.deepEqual(parseLocations('CABA: Palermo, Recoleta\nGBA Sur'), [{ label: 'CABA', subOptions: ['Palermo', 'Recoleta'] }, { label: 'GBA Sur' }]);
});

test('la edad no puede salir de 15 a 35', () => {
  assert.ok(buildTexts(form({ 'age.min': '13' })).errors['age.min']);
  assert.ok(buildTexts(form({ 'age.min': '20', 'age.max': '18' })).errors['age.max']);
});

test('opciones vacías no se guardan', () => {
  assert.ok(buildTexts(form({ 'gender.options': 'Una sola' })).errors['gender.options']);
  assert.ok(buildTexts(form({ 'intro.title': ' ' })).errors['intro.title']);
});

test('lo guardado se completa con lo de fábrica', () => {
  assert.equal(withDefaults({ intro: { title: 'Hola', subtitle: 'x' } }).age.min, 15);
});
