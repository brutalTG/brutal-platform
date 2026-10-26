// Gateway de WhatsApp para AMIGOS DE MIERDA.
// Mantiene abierta la sesión del número del juego (como WhatsApp Web), reenvía al API lo que entra,
// manda lo que el API le pide y le da cuerda al reloj del juego una vez por minuto.
// Corre como proceso permanente (Railway, una VM o una compu prendida). Vercel no sirve: apaga los procesos.

import http from 'node:http';
import { rm } from 'node:fs/promises';
import pino from 'pino';
import QRCode from 'qrcode';
import makeWASocket, { Browsers, DisconnectReason, downloadMediaMessage, fetchLatestBaileysVersion, normalizeMessageContent, useMultiFileAuthState } from 'baileys';
import { RateWindow, gapMs, isIgnorableChat, phoneFromJid, safeEqual, serialQueue, textOf, typingMs } from './util.mjs';

const cfg = {
  port: Number(process.env.PORT ?? 8080),
  apiUrl: (process.env.API_URL ?? '').replace(/\/+$/, ''),
  secret: process.env.GATEWAY_SECRET ?? '',
  authDir: process.env.AUTH_DIR ?? './auth',
  pairPhone: (process.env.PAIR_PHONE ?? '').replace(/\D/g, ''),
  tickSeconds: Number(process.env.TICK_SECONDS ?? 60),
  maxPerMinute: Number(process.env.MAX_PER_MINUTE ?? 30),
};
if (!cfg.apiUrl || cfg.secret.length < 32) {
  console.error('Faltan API_URL o GATEWAY_SECRET (32+ caracteres).');
  process.exit(1);
}

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const state = { connected: false, me: null, qr: null, pairingCode: null, lastError: null, startedAt: new Date().toISOString(), inbound: 0, outbound: 0 };
let sock = null;

// Todo lo que va al API pasa en fila: el motor nunca procesa dos cosas a la vez.
const toApi = serialQueue((e) => log.error({ err: String(e) }, 'cola al API'));
// Lo que sale, también en fila y con ritmo humano.
const outQueue = serialQueue((e) => log.error({ err: String(e) }, 'cola de salida'));
const rate = new RateWindow(cfg.maxPerMinute);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, body) {
  const res = await fetch(`${cfg.apiUrl}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(58_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} respondió ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

// ---------- WhatsApp ----------
async function connect() {
  const { state: auth, saveCreds } = await useMultiFileAuthState(cfg.authDir);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));
  sock = makeWASocket({
    auth, version, logger: log.child({ module: 'baileys' }, { level: 'warn' }),
    browser: Browsers.macOS('Chrome'), markOnlineOnConnect: false, syncFullHistory: false,
  });
  sock.ev.on('creds.update', saveCreds);

  if (!auth.creds.registered && cfg.pairPhone) {
    setTimeout(async () => {
      try {
        state.pairingCode = await sock.requestPairingCode(cfg.pairPhone);
        log.info({ code: state.pairingCode }, 'Código para vincular: WhatsApp > Dispositivos vinculados > Vincular con número');
      } catch (e) { log.error({ err: String(e) }, 'no pude pedir el código de vinculación'); }
    }, 3000);
  }

  sock.ev.on('connection.update', async (u) => {
    if (u.qr) { state.qr = u.qr; log.info('QR nuevo disponible en /qr'); }
    if (u.connection === 'open') {
      state.connected = true; state.qr = null; state.pairingCode = null; state.me = sock.user?.id ?? null;
      log.info({ me: state.me }, 'conectado');
    }
    if (u.connection === 'close') {
      state.connected = false;
      const code = u.lastDisconnect?.error?.output?.statusCode;
      state.lastError = String(u.lastDisconnect?.error?.message ?? code ?? 'desconocido');
      if (code === DisconnectReason.loggedOut) {
        log.error('WhatsApp cerró la sesión: hay que volver a vincular el número.');
        await rm(cfg.authDir, { recursive: true, force: true });
      }
      log.warn({ code }, 'conexión cerrada, reintento');
      setTimeout(() => connect().catch((e) => log.error({ err: String(e) }, 'reconexión')), code === DisconnectReason.loggedOut ? 5000 : 3000);
    }
  });

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) toApi(() => forward(msg));
  });
}

async function phoneOf(key) {
  const direct = phoneFromJid(key.remoteJid) ?? phoneFromJid(key.remoteJidAlt) ?? phoneFromJid(key.senderPn);
  if (direct) return direct;
  if (key.remoteJid?.endsWith('@lid')) {
    const pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(key.remoteJid).catch(() => null);
    return phoneFromJid(pn);
  }
  return null;
}

async function forward(msg) {
  const key = msg.key ?? {};
  if (key.fromMe || isIgnorableChat(key.remoteJid)) return;
  const content = normalizeMessageContent(msg.message);
  if (!content || content.protocolMessage || content.reactionMessage) return;
  const phone = await phoneOf(key);
  if (!phone) { log.warn({ jid: key.remoteJid }, 'no pude saber el número de este chat'); return; }

  let audio = null;
  if (content.audioMessage) {
    try {
      const buf = await downloadMediaMessage(msg, 'buffer', {}, { logger: log, reuploadRequest: sock.updateMediaMessage });
      if (buf.length > 6_000_000) throw new Error('audio demasiado largo');
      audio = { base64: buf.toString('base64'), mime: content.audioMessage.mimetype ?? 'audio/ogg; codecs=opus', seconds: content.audioMessage.seconds ?? null };
    } catch (e) { log.error({ err: String(e) }, 'no pude bajar el audio'); }
  }
  const text = textOf(content);
  if (!text && !audio) return;
  state.inbound++;
  await sock.readMessages([key]).catch(() => {});
  await api('/amigos/webhook', { id: key.id, from: phone, name: msg.pushName ?? null, text, audio });
}

// ---------- Lo que sale ----------
async function deliver({ to, text, image_url, audio_url }) {
  const jid = `${to}@s.whatsapp.net`;
  const wait = rate.waitMs();
  if (wait) await sleep(wait);
  rate.hit();
  if (text && !image_url) {
    await sock.presenceSubscribe(jid).catch(() => {});
    await sock.sendPresenceUpdate('composing', jid).catch(() => {});
    await sleep(typingMs(text));
    await sock.sendPresenceUpdate('paused', jid).catch(() => {});
  }
  if (image_url) await sock.sendMessage(jid, { image: { url: image_url }, caption: text ?? undefined });
  else if (audio_url) await sock.sendMessage(jid, { audio: { url: audio_url }, mimetype: 'audio/ogg; codecs=opus', ptt: true });
  else if (text) await sock.sendMessage(jid, { text });
  state.outbound++;
  await sleep(gapMs());
}

// ---------- HTTP ----------
function authorized(req, url) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : url.searchParams.get('key') ?? '';
  return safeEqual(token, cfg.secret);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 100_000) { reject(new Error('demasiado grande')); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); } });
  });
}

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
};

http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (url.pathname === '/health') return send(res, 200, { ok: true, connected: state.connected });
    if (!authorized(req, url)) return send(res, 401, { ok: false, error: 'unauthorized' });

    if (req.method === 'POST' && url.pathname === '/send') {
      const b = await readJson(req);
      const to = String(b.to ?? '').replace(/\D/g, '');
      if (!/^[1-9]\d{7,14}$/.test(to)) return send(res, 400, { ok: false, error: 'bad_to' });
      if (!b.text && !b.image_url && !b.audio_url) return send(res, 400, { ok: false, error: 'empty' });
      if (!state.connected) return send(res, 503, { ok: false, error: 'not_connected', message: 'El número del juego no está conectado' });
      const id = `q-${crypto.randomUUID()}`;
      outQueue(() => deliver({ to, text: b.text ?? null, image_url: b.image_url ?? null, audio_url: b.audio_url ?? null }));
      return send(res, 200, { ok: true, id, queued: outQueue.size() });
    }
    if (url.pathname === '/status') {
      return send(res, 200, { ...state, qr: state.qr ? await QRCode.toDataURL(state.qr) : null, queue: { api: toApi.size(), out: outQueue.size() } });
    }
    if (url.pathname === '/qr') {
      const img = state.qr ? `<img alt="QR para vincular" src="${await QRCode.toDataURL(state.qr, { width: 360 })}">` : '';
      const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="10">
<title>Vincular número</title><body style="background:#000;color:#fff;font:600 18px system-ui;padding:24px">
<h1>AMIGOS DE MIERDA · gateway</h1>
<p>${state.connected ? `Conectado como ${state.me}` : 'Sin conectar'}</p>
${state.pairingCode ? `<p>Código para vincular: <b style="font-size:32px;letter-spacing:4px">${state.pairingCode}</b><br>WhatsApp → Dispositivos vinculados → Vincular con número de teléfono.</p>` : ''}
${img ? `<p>O escaneá este QR desde Dispositivos vinculados:</p>${img}` : ''}
${state.lastError ? `<p style="color:#888">Último error: ${String(state.lastError).replace(/</g, '&lt;')}</p>` : ''}</body>`;
      return send(res, 200, html, 'text/html; charset=utf-8');
    }
    if (req.method === 'POST' && url.pathname === '/pair') {
      const b = await readJson(req);
      const phone = String(b.phone ?? '').replace(/\D/g, '');
      if (!/^[1-9]\d{7,14}$/.test(phone)) return send(res, 400, { ok: false, error: 'bad_phone' });
      state.pairingCode = await sock.requestPairingCode(phone);
      return send(res, 200, { ok: true, code: state.pairingCode });
    }
    return send(res, 404, { ok: false, error: 'not_found' });
  } catch (e) {
    log.error({ err: String(e) }, 'http');
    return send(res, 500, { ok: false, error: 'server_error' });
  }
}).listen(cfg.port, () => log.info({ port: cfg.port }, 'gateway escuchando'));

// Lo que el API dejó en cola: lo busca cada pocos segundos (no hace falta IP pública).
let polling = false;
setInterval(async () => {
  if (polling || !state.connected || outQueue.size() > 0) return;
  polling = true;
  try {
    const { items = [] } = await api('/amigos/outbox', { limit: 10 });
    for (const it of items) {
      outQueue(async () => {
        try {
          await deliver(it);
          await api('/amigos/outbox/ack', { id: it.id, ok: true });
        } catch (e) {
          await api('/amigos/outbox/ack', { id: it.id, ok: false, error: String(e) }).catch(() => {});
          throw e;
        }
      });
    }
  } catch (e) { log.warn({ err: String(e) }, 'no pude leer la cola'); }
  finally { polling = false; }
}, Math.max(2, Number(process.env.POLL_SECONDS ?? 3)) * 1000);

// El reloj del juego.
setInterval(() => { if (toApi.size() < 3) toApi(() => api('/amigos/tick')); }, Math.max(15, cfg.tickSeconds) * 1000);

connect().catch((e) => { log.error({ err: String(e) }, 'no pude arrancar WhatsApp'); process.exit(1); });
