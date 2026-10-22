import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signSession, verifySession, safeEqual } from './session.ts';

const secret = 'x'.repeat(40);

test('una sesión firmada se verifica', async () => {
  const v = await signSession(secret, 'nacho');
  const s = await verifySession(secret, v);
  assert.equal(s?.subject, 'nacho');
});

test('una sesión alterada no se verifica', async () => {
  const v = await signSession(secret, 'nacho');
  const tampered = v.replace('nacho', 'admin');
  assert.equal(await verifySession(secret, tampered), null);
});

test('una sesión vencida no se verifica', async () => {
  const v = await signSession(secret, 'nacho', Date.now() - 13 * 3600_000);
  assert.equal(await verifySession(secret, v), null);
});

test('otra clave no verifica', async () => {
  const v = await signSession(secret, 'nacho');
  assert.equal(await verifySession('y'.repeat(40), v), null);
});

test('comparación de contraseñas', async () => {
  assert.equal(await safeEqual('contraseña-de-prueba', 'contraseña-de-prueba'), true);
  assert.equal(await safeEqual('contraseña-de-prueba', 'Contraseña-de-prueba'), false);
});
