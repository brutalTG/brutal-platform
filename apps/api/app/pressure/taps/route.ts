import { handle, json, preflight, sessionFrom } from '@/lib/http';
import { HttpError } from '@/lib/http';
import { recordTaps, type TapInput } from '@/lib/pressure';

export const runtime = 'nodejs';
export const OPTIONS = preflight;

export const POST = handle(async (req) => {
  const sessionId = await sessionFrom(req);
  const body = await req.json().catch(() => ({})) as { taps?: TapInput[] };
  if (!Array.isArray(body.taps)) throw new HttpError(400, 'bad_taps');
  return json(req, await recordTaps(sessionId, body.taps));
});
