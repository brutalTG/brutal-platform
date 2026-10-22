import { handle, json, preflight, HttpError } from '@/lib/http';
import { startFromCode } from '@/lib/pressure';

export const runtime = 'nodejs';
export const OPTIONS = preflight;

export const POST = handle(async (req) => {
  const body = await req.json().catch(() => null) as { code?: string; device?: Record<string, unknown> } | null;
  if (!body?.code) throw new HttpError(400, 'invalid_link', 'Falta el código del link.');
  const device = Object.fromEntries(Object.entries(body.device ?? {}).slice(0, 8).map(([k, v]) => [k.slice(0, 30), String(v).slice(0, 120)]));
  return json(req, await startFromCode(body.code, device));
});
