import { env } from '@/lib/env';
import { handle, json, requireInternal, HttpError } from '@/lib/http';
import { identity } from '@/lib/whatsapp';
import { handleInbound } from '@/lib/messaging';

export const runtime = 'nodejs';

// Solo en test: el panel simula que un número le escribe al bot. Pasa por el mismo camino que un mensaje real.
export const POST = handle(async (req) => {
  await requireInternal(req);
  if (env.brutalEnv !== 'test') throw new HttpError(403, 'test_only');
  const body = await req.json().catch(() => ({})) as { phone?: string; text?: string };
  const who = identity(body.phone);
  if (!who) throw new HttpError(400, 'bad_phone');
  const result = await handleInbound({
    providerMessageId: `sim-${crypto.randomUUID()}`, waId: who.waId, phone: who.phone,
    displayName: null, text: String(body.text ?? 'JUGAR').slice(0, 500), at: new Date().toISOString(),
  });
  return json(req, { ...result, mode: env.whatsappMode });
});
