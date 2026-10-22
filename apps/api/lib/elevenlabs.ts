import 'server-only';
import { env } from './env';
import { db } from './db';
import { sha256 } from './crypto';
import { HttpError } from './http';

const BASE = 'https://api.elevenlabs.io/v1';
const BUCKET = 'pressure-tts';

function key() {
  if (!env.elevenlabsKey) throw new HttpError(503, 'voice_not_configured', 'Falta la clave de ElevenLabs.');
  return env.elevenlabsKey;
}

async function synth(text: string, voiceId: string, model: string) {
  const res = await fetch(`${BASE}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': key(), 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: model,
      language_code: 'es',
      voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.35, speed: 0.95 },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return { ok: false as const, status: res.status, detail: (await res.text()).slice(0, 300) };
  return { ok: true as const, audio: await res.arrayBuffer() };
}

let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  const s = db().storage;
  const { data } = await s.getBucket(BUCKET);
  if (!data) await s.createBucket(BUCKET, { public: false });
  bucketReady = true;
}

/**
 * Voz de la máquina. Cada frase se genera una vez y queda guardada:
 * la segunda vez sale del almacenamiento, sin costo ni demora.
 */
export async function tts(text: string, voice: { voice_id: string; fallback_voice_id?: string; model?: string }) {
  const model = voice.model || 'eleven_flash_v2_5';
  const path = `${await sha256(`${voice.voice_id}|${model}|${text}`)}.mp3`;
  try {
    await ensureBucket();
    const { data } = await db().storage.from(BUCKET).download(path);
    if (data) return await data.arrayBuffer();
  } catch { /* si el almacenamiento falla, se genera igual */ }

  let r = await synth(text, voice.voice_id, model);
  // ElevenLabs limita cuántas voces genera a la vez: si está ocupado, se espera y se reintenta.
  for (let i = 0; i < 3 && !r.ok && (r.status === 429 || r.status >= 500); i++) {
    await new Promise((res) => setTimeout(res, 600 * (i + 1)));
    r = await synth(text, voice.voice_id, model);
  }
  if (!r.ok && voice.fallback_voice_id && [400, 401, 403, 404, 422].includes(r.status)) {
    console.warn('tts: voz principal falló, uso la de respaldo', r.status, r.detail);
    r = await synth(text, voice.fallback_voice_id, model);
  }
  if (!r.ok) {
    console.error('tts falló', r.status, r.detail);
    throw new HttpError(502, 'tts_failed', `ElevenLabs respondió ${r.status}`);
  }
  try {
    await db().storage.from(BUCKET).upload(path, r.audio, { contentType: 'audio/mpeg', upsert: true });
  } catch { /* guardar es opcional */ }
  return r.audio;
}

export type Word = { text: string; start: number; end: number; type: string };

// Transcripción con tiempos por palabra: de ahí salen el arranque y las pausas.
export async function stt(audio: Blob, filename: string) {
  const form = new FormData();
  form.append('model_id', 'scribe_v1');
  form.append('language_code', 'spa');
  form.append('tag_audio_events', 'false');
  form.append('timestamps_granularity', 'word');
  form.append('file', audio, filename);
  const res = await fetch(`${BASE}/speech-to-text`, {
    method: 'POST',
    headers: { 'xi-api-key': key() },
    body: form,
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new HttpError(502, 'stt_failed', `ElevenLabs respondió ${res.status}`);
  const data: any = await res.json();
  const words: Word[] = Array.isArray(data?.words)
    ? data.words.filter((w: any) => w?.type === 'word').map((w: any) => ({ text: String(w.text), start: Number(w.start), end: Number(w.end), type: 'word' }))
    : [];
  return { text: String(data?.text ?? '').trim(), words };
}

// Rasgos que salen de los tiempos de las palabras.
export function wordFeatures(words: Word[]) {
  if (words.length === 0) return { first_word_ms: null, words: 0, internal_pauses: 0 };
  let pauses = 0;
  for (let i = 1; i < words.length; i++) if (words[i].start - words[i - 1].end > 0.4) pauses++;
  return { first_word_ms: Math.round(words[0].start * 1000), words: words.length, internal_pauses: pauses };
}
