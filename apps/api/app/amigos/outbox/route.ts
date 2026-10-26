import { safeEqual } from '@/lib/crypto';
import { amigosEnv, amigosStore } from '@/lib/amigos/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// El gateway viene a buscar lo que tiene que mandar. Así puede correr en cualquier compu, sin IP pública.
export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (amigosEnv.gatewaySecret.length < 32 || !(await safeEqual(token, amigosEnv.gatewaySecret))) return new Response('Secreto inválido', { status: 401 });
  const b = await req.json().catch(() => ({})) as { limit?: number };
  const items = await amigosStore().claimOutbox(Math.min(Math.max(Number(b.limit) || 10, 1), 30));
  return Response.json({ ok: true, items });
}
