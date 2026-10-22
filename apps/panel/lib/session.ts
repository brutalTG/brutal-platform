// Sesión del panel: cookie firmada con HMAC-SHA256. Funciona en el middleware (Edge) y en el servidor.
export const SESSION_COOKIE = 'brutal_panel';
export const SESSION_HOURS = 12;

const enc = new TextEncoder();

async function key(secret: string) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function signSession(secret: string, subject: string, now = Date.now()) {
  const exp = now + SESSION_HOURS * 3600_000;
  const body = `${subject}.${exp}`;
  const sig = await crypto.subtle.sign('HMAC', await key(secret), enc.encode(body));
  return `${body}.${toHex(sig)}`;
}

export async function verifySession(secret: string, value: string | undefined, now = Date.now()) {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const [subject, expRaw, sig] = parts;
  if (!/^[a-f0-9]{64}$/.test(sig)) return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < now) return null;
  const ok = await crypto.subtle.verify('HMAC', await key(secret), fromHex(sig), enc.encode(`${subject}.${expRaw}`));
  return ok ? { subject, exp } : null;
}

export async function safeEqual(a: string, b: string) {
  // Compara hashes de largo fijo para no filtrar el largo ni la posición del error.
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
