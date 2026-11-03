import { test } from 'node:test';
import assert from 'node:assert/strict';
import { command, inboundGate, parseWati, render, sendText } from './whatsapp.ts';

test('lee mensajes entrantes de WATI y descarta los propios', () => {
  const msgs = parseWati([
    { eventType: 'message', waId: '5491155551234', whatsappMessageId: 'w1', text: 'hola', senderName: 'Juli', timestamp: '1792700000' },
    { eventType: 'message', waId: '5491155551234', whatsappMessageId: 'w2', text: 'eco', owner: true },
    { eventType: 'sentMessageDELIVERED', waId: '5491155551234', id: 'w3' },
  ]);
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].phone, '+5491155551234');
  assert.equal(msgs[0].text, 'hola');
});

test('interpreta comandos', () => {
  assert.equal(command('Baja'), 'opt_out');
  assert.equal(command('ranking'), 'ranking');
  assert.equal(command('hola!!'), 'drop');
  assert.equal(command('JUGAR'), 'drop');
  assert.equal(command('Quiero jugar a BRUTAL'), 'drop');
  assert.equal(command('pressure'), 'play');
});

test('quien escribe por primera vez queda anotado; los bloqueados no reciben nada', () => {
  assert.equal(inboundGate(null), 'create');
  assert.equal(inboundGate({ status: 'pending' }), 'known');
  assert.equal(inboundGate({ status: 'active' }), 'known');
  assert.equal(inboundGate({ status: 'blocked' }), 'ignore');
  assert.equal(inboundGate({ status: 'archived' }), 'ignore');
});

test('completa plantillas', () => {
  assert.equal(render('+{tickets} · #{position}', { tickets: 550, position: 3 }), '+550 · #3');
});

test('en modo simulado no sale nada a la red', async () => {
  let called = false;
  const r = await sendText({ mode: 'mock', endpoint: '', token: '', channel: '' }, '+5491155551234', 'hola', (async () => { called = true; return new Response('{}'); }) as typeof fetch);
  assert.equal(r.ok, true);
  assert.equal(called, false);
});

test('con WATI manda un mensaje de sesión al número', async () => {
  let url = '';
  const r = await sendText({ mode: 'wati', endpoint: 'https://live.wati.io/123', token: 'tok', channel: '5491100000000' }, '+5491155551234', 'hola',
    (async (u: URL) => { url = String(u); return new Response(JSON.stringify({ result: true, message: { whatsappMessageId: 'abc' } })); }) as unknown as typeof fetch);
  assert.deepEqual(r, { ok: true, providerMessageId: 'abc' });
  assert.match(url, /sendSessionMessage\/5491155551234\?messageText=hola/);
});
