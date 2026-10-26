import { env } from '@/lib/env';
import { safeEqual } from '@/lib/crypto';
import { parseWati } from '@/lib/whatsapp';
import { handleInbound } from '@/lib/messaging';

export const runtime = 'nodejs';
export const maxDuration = 30;

// WATI llama acá por cada mensaje. El secreto va como "Authorization: Bearer ..." o "?key=...".
export async function POST(req: Request) {
  if (env.whatsappMode !== 'wati') return new Response('WhatsApp no está en modo WATI', { status: 503 });
  const auth = req.headers.get('authorization') ?? '';
  const supplied = auth.startsWith('Bearer ') ? auth.slice(7) : new URL(req.url).searchParams.get('key') ?? '';
  if (env.watiWebhookSecret.length < 32 || !(await safeEqual(supplied, env.watiWebhookSecret))) {
    return new Response('Secreto inválido', { status: 401 });
  }
  const raw = await req.text();
  if (raw.length > 1_000_000) return new Response('Demasiado grande', { status: 413 });
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return new Response('JSON inválido', { status: 400 }); }

  const results = [];
  for (const m of parseWati(payload)) {
    try { results.push(await handleInbound(m)); } catch (e) { console.error('whatsapp inbound', e); results.push({ handled: false, reason: 'error' }); }
  }
  // Siempre 200 para que WATI no reintente en loop; los errores quedan en el log.
  return Response.json({ ok: true, results });
}
