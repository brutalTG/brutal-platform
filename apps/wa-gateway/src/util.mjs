// Funciones puras del gateway: se prueban sin WhatsApp.

/** El número (solo dígitos) detrás de un JID de persona. Los grupos, estados y canales no cuentan. */
export function phoneFromJid(jid) {
  if (!jid || typeof jid !== 'string') return null;
  if (!jid.endsWith('@s.whatsapp.net')) return null;
  const digits = jid.split('@')[0].split(':')[0];
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function isIgnorableChat(jid) {
  return !jid || jid.endsWith('@g.us') || jid === 'status@broadcast' || jid.endsWith('@newsletter') || jid.endsWith('@broadcast');
}

/** Saca el texto de cualquier tipo de mensaje que nos importa. `content` ya viene sin envoltorios (efímero, ver una vez). */
export function textOf(content) {
  if (!content) return '';
  return content.conversation
    ?? content.extendedTextMessage?.text
    ?? content.imageMessage?.caption
    ?? content.videoMessage?.caption
    ?? content.buttonsResponseMessage?.selectedDisplayText
    ?? content.listResponseMessage?.title
    ?? content.templateButtonReplyMessage?.selectedDisplayText
    ?? content.pollUpdateMessage?.vote?.selectedOptions?.[0]
    ?? '';
}

/** Cuánto "escribe" el bot antes de mandar: parece una persona, no una ametralladora. */
export function typingMs(text, rand = Math.random) {
  const base = Math.min(4000, 600 + (text?.length ?? 0) * 25);
  return Math.round(base * (0.8 + rand() * 0.4));
}

export function gapMs(rand = Math.random) {
  return Math.round(1100 + rand() * 1300);
}

/** Ventana deslizante: cuántos mensajes salieron en el último minuto. */
export class RateWindow {
  constructor(limit, windowMs = 60_000) { this.limit = limit; this.windowMs = windowMs; this.stamps = []; }
  waitMs(now = Date.now()) {
    this.stamps = this.stamps.filter((t) => now - t < this.windowMs);
    if (this.stamps.length < this.limit) return 0;
    return this.windowMs - (now - this.stamps[0]) + 50;
  }
  hit(now = Date.now()) { this.stamps.push(now); }
}

/** Una cola: corre las tareas de a una, en orden. Si una falla, sigue con la próxima. */
export function serialQueue(onError = () => {}) {
  let tail = Promise.resolve();
  let size = 0;
  const run = (task) => {
    size++;
    const p = tail.then(task).catch(onError).finally(() => { size--; });
    tail = p;
    return p;
  };
  run.size = () => size;
  return run;
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
