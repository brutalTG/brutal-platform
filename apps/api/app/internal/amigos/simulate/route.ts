import { env } from '@/lib/env';
import { handle, json, requireInternal, HttpError } from '@/lib/http';
import { identity } from '@/lib/whatsapp';
import { amigosCtx } from '@/lib/amigos/server';
import { handleInbound } from '@/lib/amigos/engine';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Solo test: el panel hace de cuenta que un número le escribe al juego. Mismo camino que un mensaje real.
export const POST = handle(async (req) => {
  await requireInternal(req);
  if (env.brutalEnv !== 'test') throw new HttpError(403, 'test_only');
  const b = await req.json().catch(() => ({})) as { phone?: string; text?: string; audio?: boolean; name?: string };
  const who = identity(b.phone);
  if (!who) throw new HttpError(400, 'bad_phone');
  // Un audio simulado: medio segundo de silencio en ogg no hace falta; alcanza con bytes para probar el circuito.
  const audio = b.audio ? { data: new TextEncoder().encode('audio simulado'), mime: 'audio/ogg; codecs=opus', seconds: 8 } : null;
  const r = await handleInbound(amigosCtx(), {
    id: `sim-${crypto.randomUUID()}`, phone: who.phone, name: b.name ? String(b.name).slice(0, 60) : null,
    text: String(b.text ?? '').slice(0, 1000), audio, at: new Date(),
  });
  return json(req, r);
});
