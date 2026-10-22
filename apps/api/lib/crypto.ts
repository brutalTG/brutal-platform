// Tokens firmados y códigos de acceso. Web Crypto: funciona igual en Node y en Edge.
const enc = new TextEncoder();

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256(text: string) {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

async function hmac(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
}

export async function safeEqual(a: string, b: string) {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

// Código de acceso: 22 caracteres de un alfabeto de 32 (110 bits), legible en una URL.
// En la base solo queda su hash.
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
export function newCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(22)), (b) => ALPHABET[b % 32]).join('');
}

// Token de partida: id de sesión + vencimiento + firma.
export async function signToken(secret: string, sessionId: string, hours = 6, now = Date.now()) {
  const exp = now + hours * 3600_000;
  const body = `${sessionId}.${exp}`;
  return `${body}.${await hmac(secret, body)}`;
}

export async function verifyToken(secret: string, token: string | null | undefined, now = Date.now()) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [sessionId, expRaw, sig] = parts;
  if (!/^[0-9a-f-]{36}$/.test(sessionId) || !/^[a-f0-9]{64}$/.test(sig)) return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < now) return null;
  const expected = await hmac(secret, `${sessionId}.${expRaw}`);
  return (await safeEqual(expected, sig)) ? { sessionId, exp } : null;
}
