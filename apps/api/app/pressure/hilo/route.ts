import { handle, json, preflight, sessionFrom } from '@/lib/http';
import { HttpError } from '@/lib/http';
import { hilo } from '@/lib/pressure';

export const runtime = 'nodejs';
export const OPTIONS = preflight;

const ACTIONS = ['start', 'higher', 'lower', 'stand'] as const;

export const POST = handle(async (req) => {
  const sessionId = await sessionFrom(req);
  const body = await req.json().catch(() => ({})) as { action?: string; step?: number };
  const action = ACTIONS.find((a) => a === body.action);
  if (!action) throw new HttpError(400, 'bad_action');
  return json(req, await hilo(sessionId, action, typeof body.step === 'number' ? body.step : undefined));
});
