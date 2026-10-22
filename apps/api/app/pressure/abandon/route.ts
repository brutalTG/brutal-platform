import { handle, json, preflight, sessionFrom } from '@/lib/http';
import { abandon } from '@/lib/pressure';

export const runtime = 'nodejs';
export const OPTIONS = preflight;

export const POST = handle(async (req) => {
  const sessionId = await sessionFrom(req);
  const body = await req.json().catch(() => ({})) as { reason?: string };
  await abandon(sessionId, String(body.reason ?? 'closed'));
  return json(req, { ok: true });
});
