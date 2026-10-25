import { env, missing } from '@/lib/env';
import { amigosEnv, amigosMissing } from '@/lib/amigos/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Estado de la configuración, sin mostrar valores.
export function GET() {
  return Response.json({ ok: missing().length === 0, env: env.brutalEnv, whatsapp: env.whatsappMode, missing: missing(), amigos: { whatsapp: amigosEnv.mode, missing: amigosMissing() } });
}
