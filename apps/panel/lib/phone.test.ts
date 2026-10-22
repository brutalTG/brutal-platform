import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone } from './phone.ts';

test('normaliza celulares argentinos', () => {
  assert.equal(normalizePhone('11 5555-1234'), '+5491155551234');
  assert.equal(normalizePhone('+54 9 11 5555 1234'), '+5491155551234');
  assert.equal(normalizePhone('5491155551234'), '+5491155551234');
  assert.equal(normalizePhone('011 15 5555 1234'), '+5491155551234');
  assert.equal(normalizePhone('351 15 555 1234'), '+5493515551234');
  assert.equal(normalizePhone('+34 612 345 678'), '+34612345678');
  assert.equal(normalizePhone('1234'), null);
});
