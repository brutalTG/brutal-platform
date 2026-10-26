import { safeEqual } from '@/lib/crypto';
import { amigosEnv, amigosStore } from '@/lib/amigos/server';

export const runtime = 'nodejs';

// El gateway avisa cómo salió cada mensaje.
export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (amigosEnv.gatewaySecret.length < 32 || !(await safeEqual(token, amigosEnv.gatewaySecret))) return new Response('Secreto inválido', { status: 401 });
  const b = await req.json().catch(() => ({})) as { id?: string; ok?: boolean; provider_id?: string; error?: string };
  if (!b.id || !/^[0-9a-f-]{36}$/.test(b.id)) return Response.json({ ok: false, error: 'bad_id' }, { status: 400 });
  await amigosStore().ackOutbox(b.id, Boolean(b.ok), b.provider_id ?? null, b.error ?? null);
  return Response.json({ ok: true });
}
