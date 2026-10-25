import 'server-only';
import { env } from '../env';
import { stt } from '../elevenlabs';
import { SupabaseStore, type TransportConfig } from './supabase-store.ts';
import type { Ctx, Urls } from './engine.ts';

// Configuración del juego. El número y el gateway son propios: no comparten nada con el bot de Drops (WATI).
export const amigosEnv = {
  mode: (process.env.AMIGOS_WHATSAPP_MODE ?? 'mock') as TransportConfig['mode'],
  gatewayUrl: (process.env.AMIGOS_GATEWAY_URL ?? '').replace(/\/+$/, ''),
  gatewaySecret: process.env.AMIGOS_GATEWAY_SECRET ?? '',
  publicNumber: (process.env.AMIGOS_PUBLIC_NUMBER ?? '').replace(/\D/g, ''),
  apiPublicUrl: (process.env.API_PUBLIC_URL ?? (env.brutalEnv === 'production' ? 'https://api.brutal.lat' : 'https://test-api.brutal.lat')).replace(/\/+$/, ''),
};

export function amigosMissing() {
  const out: string[] = [];
  if (!/^[1-9]\d{7,14}$/.test(amigosEnv.publicNumber)) out.push('AMIGOS_PUBLIC_NUMBER');
  if (amigosEnv.mode === 'gateway') {
    if (amigosEnv.gatewaySecret.length < 32) out.push('AMIGOS_GATEWAY_SECRET');
  }
  return out;
}

// ---------- Links firmados a las imágenes (los descarga WhatsApp) ----------
const enc = new TextEncoder();
async function hmac(body: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(env.sessionSecret || 'dev-only-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function canonicalQuery(params: Record<string, string>) {
  return Object.keys(params).sort().map((k) => `${k}=${encodeURIComponent(params[k])}`).join('&');
}

export async function signImage(kind: string, id: string, params: Record<string, string>) {
  const q = canonicalQuery(params);
  const sig = await hmac(`${kind}/${id}?${q}`);
  return `${amigosEnv.apiPublicUrl}/amigos/img/${kind}/${id}.png?${q}${q ? '&' : ''}s=${sig}`;
}

export async function verifyImage(kind: string, id: string, search: URLSearchParams) {
  const params: Record<string, string> = {};
  for (const [k, v] of search) if (k !== 's') params[k] = v;
  const expected = await hmac(`${kind}/${id}?${canonicalQuery(params)}`);
  return search.get('s') === expected ? params : null;
}

// El motor arma los links de forma sincrónica: se firman antes y se reemplazan al mandar.
const PENDING = 'urn:amigos-img:';
function placeholder(kind: string, id: string, params: Record<string, string>) {
  return `${PENDING}${kind}/${id}?${canonicalQuery(params)}`;
}
export async function resolveImage(url: string | undefined) {
  if (!url || !url.startsWith(PENDING)) return url;
  const [path, q] = url.slice(PENDING.length).split('?');
  const [kind, id] = path.split('/');
  return signImage(kind, id, Object.fromEntries(new URLSearchParams(q)));
}

const urls: Urls = {
  question: (q, o) => placeholder('q', q.id, { by: o.by, ...(o.teaser ? { t: o.teaser } : {}) }),
  reveal: (r) => placeholder('r', r.id, { v: String(Date.parse(r.revealed_at ?? '') || 0) }),
  table: (g) => placeholder('t', g.id, { v: String(Date.now()), s2: String(g.season) }),
  label: (g, m, label, stat) => placeholder('e', m.id, { g: g.id, l: label, st: stat }),
};

class SignedStore extends SupabaseStore {
  override async send(...args: Parameters<SupabaseStore['send']>) {
    const [p, out, purpose] = args;
    return super.send(p, { ...out, imageUrl: await resolveImage(out.imageUrl) }, purpose);
  }
}

export function amigosStore() {
  return new SignedStore({ mode: amigosEnv.mode, gatewayUrl: amigosEnv.gatewayUrl, gatewaySecret: amigosEnv.gatewaySecret });
}

export function amigosCtx(now = new Date()): Ctx {
  return {
    store: amigosStore(),
    urls,
    now,
    publicNumber: amigosEnv.publicNumber || '5490000000000',
    test: env.brutalEnv !== 'production',
    transcribe: env.elevenlabsKey
      ? async (data, mime) => {
        const ext = /mp4|m4a|aac/.test(mime) ? 'm4a' : /mpeg|mp3/.test(mime) ? 'mp3' : 'ogg';
        const r = await stt(new Blob([data as BlobPart], { type: mime.split(';')[0] }), `voz.${ext}`);
        return r.text || null;
      }
      : undefined,
  };
}
