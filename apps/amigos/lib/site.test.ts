import { test } from 'node:test';
import assert from 'node:assert/strict';

test('el link al juego abre WhatsApp con el mensaje escrito', async () => {
  process.env.AMIGOS_PUBLIC_NUMBER = '+54 9 11 0000-0000';
  const { playLink } = await import('./site.ts');
  assert.equal(playLink(), 'https://wa.me/5491100000000?text=Quiero%20jugar%20con%20mi%20grupo');
});
