import { env } from '@/lib/env';
import { safeEqual } from '@/lib/crypto';
import { amigosCtx, amigosEnv } from '@/lib/amigos/server';
import { tick } from '@/lib/amigos/engine';

export const runtime = 'nodejs';
export const maxDuration = 60;

// El reloj del juego: lo llama el gateway una vez por minuto (o el cron de Vercel).
async function run(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const okGateway = amigosEnv.gatewaySecret.length >= 32 && (await safeEqual(token, amigosEnv.gatewaySecret));
  const okInternal = env.internalSecret.length >= 32 && (await safeEqual(token, env.internalSecret));
  const okCron = Boolean(process.env.CRON_SECRET) && (await safeEqual(token, process.env.CRON_SECRET!));
  if (!okGateway && !okInternal && !okCron) return new Response('No autorizado', { status: 401 });
  const did = await tick(amigosCtx());
  return Response.json({ ok: true, did });
}
export const POST = run;
export const GET = run;
