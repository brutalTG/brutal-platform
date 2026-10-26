import { cors, handle, preflight, sessionFrom, HttpError } from '@/lib/http';
import { allowedSpeech } from '@/lib/pressure';
import { tts } from '@/lib/elevenlabs';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const OPTIONS = preflight;

// La máquina solo dice lo que está en el guion de esta partida.
export const POST = handle(async (req) => {
  const sessionId = await sessionFrom(req);
  const { text } = await req.json().catch(() => ({})) as { text?: string };
  if (!text || text.length > 400) throw new HttpError(400, 'bad_text');
  const { allowed, voice } = await allowedSpeech(sessionId);
  if (!allowed.has(text)) throw new HttpError(403, 'not_in_script');
  const audio = await tts(text, voice);
  return new Response(audio, {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=3600', ...cors(req.headers.get('origin')) },
  });
});
