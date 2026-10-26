import { handle, json, preflight, sessionFrom, HttpError } from '@/lib/http';
import { recordAnswer } from '@/lib/pressure';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const OPTIONS = preflight;

// multipart: meta (JSON) + audio (archivo, opcional).
export const POST = handle(async (req) => {
  const sessionId = await sessionFrom(req);
  const form = await req.formData().catch(() => null);
  if (!form) throw new HttpError(400, 'bad_request');
  const meta = JSON.parse(String(form.get('meta') ?? '{}'));
  const audio = form.get('audio');
  const file = audio instanceof Blob ? audio : null;
  if (file && file.size > 6_000_000) throw new HttpError(413, 'audio_too_long', 'La respuesta es demasiado larga.');
  const result = await recordAnswer(sessionId, {
    item_id: String(meta.item_id ?? ''),
    stage: meta.stage === 'follow' ? 'follow' : 'main',
    attempt: Number(meta.attempt ?? 1),
    committed: meta.committed === 'lie' ? 'lie' : meta.committed === 'truth' ? 'truth' : undefined,
    features: meta.features ?? {},
    audio: file,
    mime: file?.type ?? '',
  });
  return json(req, result);
});
