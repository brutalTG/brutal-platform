import { safeEqual } from '@/lib/crypto';
import { identity } from '@/lib/whatsapp';
import { amigosCtx, amigosEnv } from '@/lib/amigos/server';
import { handleInbound } from '@/lib/amigos/engine';

export const runtime = 'nodejs';
export const maxDuration = 60;

// El gateway del número de AMIGOS DE MIERDA manda acá cada mensaje que entra.
export async function POST(req: Request) {
  if (amigosEnv.mode !== 'gateway') return new Response('El juego no está conectado a un número', { status: 503 });
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (amigosEnv.gatewaySecret.length < 32 || !(await safeEqual(token, amigosEnv.gatewaySecret))) return new Response('Secreto inválido', { status: 401 });
  const raw = await req.text();
  if (raw.length > 8_000_000) return new Response('Demasiado grande', { status: 413 });
  let b: any;
  try { b = JSON.parse(raw); } catch { return new Response('JSON inválido', { status: 400 }); }
  const who = identity(b?.from);
  if (!who || !b?.id) return Response.json({ ok: false, error: 'bad_message' }, { status: 400 });
  const audio = b.audio?.base64 ? { data: Uint8Array.from(Buffer.from(String(b.audio.base64), 'base64')), mime: String(b.audio.mime ?? 'audio/ogg'), seconds: Number.isFinite(b.audio.seconds) ? Math.round(b.audio.seconds) : null } : null;
  try {
    const r = await handleInbound(amigosCtx(), {
      id: String(b.id), phone: who.phone, name: b.name ? String(b.name).slice(0, 120) : null,
      text: String(b.text ?? '').slice(0, 2000), audio, at: new Date(),
    });
    return Response.json({ ok: true, ...r });
  } catch (e) {
    console.error('amigos inbound', e);
    // 200 para que el gateway no reintente en loop; el error queda en el log.
    return Response.json({ ok: false, error: 'server_error' });
  }
}
