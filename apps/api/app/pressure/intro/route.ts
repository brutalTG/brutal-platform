import { handle, json, preflight, HttpError } from '@/lib/http';
import { introFromCode } from '@/lib/pressure';

export const runtime = 'nodejs';
export const OPTIONS = preflight;

// Textos de entrada del juego. No gasta el link: solo lo valida.
export const POST = handle(async (req) => {
  const body = await req.json().catch(() => null) as { code?: string } | null;
  if (!body?.code) throw new HttpError(400, 'invalid_link', 'Falta el código del link.');
  return json(req, await introFromCode(body.code));
});
