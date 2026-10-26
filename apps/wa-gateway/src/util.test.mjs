import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateWindow, isIgnorableChat, phoneFromJid, safeEqual, serialQueue, textOf, typingMs } from './util.mjs';

test('saca el número de un JID de persona y descarta lo demás', () => {
  assert.equal(phoneFromJid('5491155551234@s.whatsapp.net'), '5491155551234');
  assert.equal(phoneFromJid('5491155551234:12@s.whatsapp.net'), '5491155551234');
  assert.equal(phoneFromJid('12345@lid'), null);
  assert.equal(phoneFromJid('120363@g.us'), null);
  assert.ok(isIgnorableChat('120363@g.us'));
  assert.ok(isIgnorableChat('status@broadcast'));
  assert.ok(!isIgnorableChat('5491155551234@s.whatsapp.net'));
});

test('lee el texto de los distintos tipos de mensaje', () => {
  assert.equal(textOf({ conversation: 'hola' }), 'hola');
  assert.equal(textOf({ extendedTextMessage: { text: 'Me sumo a LOSPIBES #K7Q2M' } }), 'Me sumo a LOSPIBES #K7Q2M');
  assert.equal(textOf({ audioMessage: {} }), '');
});

test('tipea un rato razonable y respeta el límite por minuto', () => {
  assert.ok(typingMs('hola', () => 0.5) >= 600);
  assert.ok(typingMs('x'.repeat(5000), () => 1) <= 4800);
  const w = new RateWindow(2, 1000);
  w.hit(0); w.hit(10);
  assert.ok(w.waitMs(20) > 0);
  assert.equal(w.waitMs(2000), 0);
});

test('la cola corre de a una y sigue aunque una tarea falle', async () => {
  const order = [];
  const q = serialQueue(() => order.push('error'));
  q(async () => { await new Promise((r) => setTimeout(r, 20)); order.push(1); });
  q(async () => { throw new Error('x'); });
  await q(async () => { order.push(3); });
  assert.deepEqual(order, [1, 'error', 3]);
});

test('compara secretos', () => {
  assert.ok(safeEqual('a'.repeat(32), 'a'.repeat(32)));
  assert.ok(!safeEqual('a'.repeat(32), 'b'.repeat(32)));
  assert.ok(!safeEqual('a', undefined));
});
