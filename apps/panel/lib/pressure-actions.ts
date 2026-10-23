'use server';

import { revalidatePath } from 'next/cache';
import { db, from, audit, explain } from '@/lib/db';
import { normalizePhone } from '@/lib/phone';
import type { FormResult } from '@/components/ui/form';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const int = (f: FormData, k: string) => Number.parseInt(str(f, k), 10);

const KINDS = { calibration: ['calibration', 'obvious_lie'], game: ['fun', 'signal'], rafaga: ['flash', 'trap'] } as const;
const MEDIA_BUCKET = 'pressure-media';
const ANSWER_TYPES = ['choice', 'yes_no', 'agree', 'number', 'open'];

async function experimentSlug(id: string) {
  const { data } = await from('pressure', 'experiments').select('slug').eq('id', id).single();
  return (data as { slug: string } | null)?.slug ?? '';
}

/** Crea o edita una pregunta del juego. */
export async function saveItem(form: FormData): Promise<FormResult> {
  const id = str(form, 'id');
  const experiment_id = str(form, 'experiment_id');
  const section = str(form, 'section') as 'calibration' | 'game' | 'rafaga';
  const kind = str(form, 'kind');
  const rafaga = section === 'rafaga';
  const echo = rafaga && kind === 'flash' && form.get('echo') === 'on';
  const screen_text = str(form, 'screen_text') || null;
  // En la ráfaga, si no vuelve por voz, la máquina no dice nada: el texto de pantalla hace de pregunta.
  const prompt = rafaga && !echo ? (screen_text ?? '') : str(form, 'prompt');
  const answer_type = rafaga && !echo ? 'yes_no' : str(form, 'answer_type');
  const media_url = str(form, 'media_url') || null;
  const emoji_a = str(form, 'emoji_a') || null;
  const emoji_b = str(form, 'emoji_b') || null;
  const correct = str(form, 'correct') || null;
  const follow_up = str(form, 'follow_up') || null;
  const subthesis_id = str(form, 'subthesis_id') || null;
  const source_note = str(form, 'source_note') || null;
  const follow_up_when = str(form, 'follow_up_when') || 'always';
  const claim_yes = str(form, 'claim_yes') || null;
  const claim_no = str(form, 'claim_no') || null;
  const option_a = str(form, 'option_a') || null;
  const option_b = str(form, 'option_b') || null;

  const fields: Record<string, string> = {};
  if (!(section in KINDS)) fields.section = 'Elegí una sección.';
  else if (!(KINDS[section] as readonly string[]).includes(kind)) fields.kind = section === 'game' ? 'En el juego: diversión o señal.' : 'En la calibración: verdad o mentira de control.';
  if (rafaga && !screen_text) fields.screen_text = 'Escribí el texto que aparece.';
  if (rafaga && (!emoji_a || !emoji_b)) fields.emoji_a = 'Poné los dos emojis.';
  if (rafaga && ((emoji_a?.length ?? 0) > 16 || (emoji_b?.length ?? 0) > 16)) fields.emoji_a = 'Un emoji por botón.';
  if (kind === 'trap' && !['a', 'b'].includes(correct ?? '')) fields.correct = 'Elegí cuál es el toque correcto.';
  if (media_url && !/^https:\/\/\S+$/.test(media_url)) fields.media_url = 'Tiene que ser un link https.';
  if (prompt.length < 3) fields[rafaga && !echo ? 'screen_text' : 'prompt'] = rafaga && !echo ? 'Escribí el texto que aparece.' : 'Escribí lo que dice la máquina.';
  if (prompt.length > 400) fields.prompt = 'Máximo 400 caracteres: la máquina lo dice en voz alta.';
  if (screen_text && screen_text.length > 200) fields.screen_text = 'Máximo 200 caracteres.';
  if (!ANSWER_TYPES.includes(answer_type)) fields.answer_type = 'Elegí cómo se responde.';
  if (follow_up && follow_up.length < 3) fields.follow_up = 'Muy corta.';
  if (!['always', 'yes', 'no'].includes(follow_up_when)) fields.follow_up_when = 'Elegí cuándo.';
  if (answer_type === 'choice' && !option_a) fields.option_a = 'Un dilema necesita las dos opciones.';
  if (answer_type === 'choice' && !option_b) fields.option_b = 'Un dilema necesita las dos opciones.';
  if (follow_up_when !== 'always' && !['yes_no', 'agree', 'choice'].includes(answer_type)) fields.follow_up_when = 'Solo se puede condicionar en preguntas de sí/no o de acuerdo.';
  if (claim_yes && claim_yes.length > 120) fields.claim_yes = 'Máximo 120 caracteres.';
  if (claim_no && claim_no.length > 120) fields.claim_no = 'Máximo 120 caracteres.';
  if (kind === 'signal' && !subthesis_id) fields.subthesis_id = 'Una pregunta de señal tiene que apuntar a una sub-tesis.';
  if (Object.keys(fields).length) return { ok: false, error: 'Revisá los campos marcados.', fields };

  const row = { section, kind, prompt, screen_text, answer_type, follow_up: rafaga && !echo ? null : follow_up, follow_up_when: rafaga && !echo ? 'always' : follow_up_when,
    claim_yes: rafaga && !echo ? null : claim_yes, claim_no: rafaga && !echo ? null : claim_no,
    option_a: answer_type === 'choice' ? option_a : null, option_b: answer_type === 'choice' ? option_b : null, subthesis_id: kind === 'signal' ? subthesis_id : null, source_note,
    ...(rafaga ? { media_url, emoji_a, emoji_b, echo, correct: kind === 'trap' ? correct : null } : {}) };
  if (id) {
    const { error } = await from('pressure', 'items').update(row).eq('id', id);
    if (error) return { ok: false, error: explain(error)! };
    await audit('editó una pregunta del detector', 'pressure_item', id, { prompt });
  } else {
    const { data: last } = await from('pressure', 'items').select('position').eq('experiment_id', experiment_id).eq('section', section)
      .order('position', { ascending: false }).limit(1).maybeSingle();
    const position = ((last as { position: number } | null)?.position ?? 0) + 1;
    const { data, error } = await from('pressure', 'items').insert({ ...row, experiment_id, position }).select('id').single();
    if (error) return { ok: false, error: explain(error)! };
    await audit('agregó una pregunta al detector', 'pressure_item', (data as { id: string }).id, { prompt });
  }
  revalidatePath(`/pressure/${await experimentSlug(experiment_id)}`);
  return { ok: true, message: id ? 'Pregunta guardada' : 'Pregunta agregada al final' };
}

/** Link para subir una imagen o video de la ráfaga directo al almacenamiento (sin pasar por el panel: los videos pesan). */
export async function mediaUploadUrl(name: string, type: string): Promise<{ ok: true; uploadUrl: string; publicUrl: string } | { ok: false; error: string }> {
  if (!/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime))$/.test(type)) return { ok: false, error: 'Subí una imagen (jpg, png, webp, gif) o un video (mp4, webm, mov).' };
  const st = db().storage;
  const { data: bucket } = await st.getBucket(MEDIA_BUCKET);
  if (!bucket) {
    const { error } = await st.createBucket(MEDIA_BUCKET, { public: true, fileSizeLimit: 25_000_000 });
    if (error && !/exists/i.test(error.message)) return { ok: false, error: error.message };
  }
  const ext = (name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || (type.startsWith('video') ? 'mp4' : 'jpg');
  const path = `rafaga/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await st.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: error?.message ?? 'No pude preparar la subida.' };
  return { ok: true, uploadUrl: data.signedUrl, publicUrl: st.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl };
}

/** Sube o baja una pregunta dentro de su sección. */
export async function moveItem(id: string, dir: -1 | 1): Promise<FormResult> {
  const { data: it } = await from('pressure', 'items').select('id, experiment_id, section, position').eq('id', id).single();
  if (!it) return { ok: false, error: 'La pregunta ya no existe.' };
  const item = it as { id: string; experiment_id: string; section: string; position: number };
  let q = from('pressure', 'items').select('id, position').eq('experiment_id', item.experiment_id).eq('section', item.section);
  q = dir < 0 ? q.lt('position', item.position).order('position', { ascending: false }) : q.gt('position', item.position).order('position');
  const { data: nb } = await q.limit(1).maybeSingle();
  if (!nb) return { ok: true };
  const neighbor = nb as { id: string; position: number };
  const a = await from('pressure', 'items').update({ position: neighbor.position }).eq('id', item.id);
  const b = await from('pressure', 'items').update({ position: item.position }).eq('id', neighbor.id);
  if (a.error || b.error) return { ok: false, error: explain(a.error ?? b.error)! };
  revalidatePath(`/pressure/${await experimentSlug(item.experiment_id)}`);
  return { ok: true };
}

/** Prende o apaga una pregunta. No se borran: las partidas viejas las referencian. */
export async function toggleItem(id: string, enabled: boolean): Promise<FormResult> {
  const { data, error } = await from('pressure', 'items').update({ enabled }).eq('id', id).select('experiment_id').single();
  if (error) return { ok: false, error: explain(error)! };
  await audit(enabled ? 'prendió una pregunta' : 'apagó una pregunta', 'pressure_item', id);
  revalidatePath(`/pressure/${await experimentSlug((data as { experiment_id: string }).experiment_id)}`);
  return { ok: true, message: enabled ? 'Pregunta activa' : 'Pregunta apagada: no sale en las partidas nuevas' };
}

/** Reglas, recompensas, voz y frases de la máquina. */
export async function saveSettings(form: FormData): Promise<FormResult> {
  const id = str(form, 'experiment_id');
  const { data: exp, error: e1 } = await from('pressure', 'experiments').select('definition, slug').eq('id', id).single();
  if (e1 || !exp) return { ok: false, error: explain(e1) ?? 'No encontré el juego.' };
  const stages = { rafaga: form.get('stage_rafaga') === 'on', hilo: form.get('stage_hilo') === 'on', vuelta: form.get('stage_vuelta') === 'on' };
  const { count: gameCount } = await from('pressure', 'items').select('id', { count: 'exact', head: true }).eq('experiment_id', id).eq('section', 'game').eq('enabled', true);
  const { count: echoCount } = await from('pressure', 'items').select('id', { count: 'exact', head: true }).eq('experiment_id', id).eq('section', 'rafaga').eq('echo', true).eq('enabled', true);
  // Se puede mentir en las del juego y en las de la vuelta.
  const count = (gameCount ?? 0) + (stages.rafaga && stages.vuelta ? echoCount ?? 0 : 0);
  const seconds = Number(str(form, 'rafaga_seconds').replace(',', '.'));
  const ladder = str(form, 'ladder').split(/[\s;]+|,(?=\s)/).map((x) => Number(x.replace(',', '.').replace(/^x/i, ''))).filter((x) => Number.isFinite(x) && x > 0);

  const lies = int(form, 'lies'), winMax = int(form, 'win_max_caught');
  const perAnswer = int(form, 'per_answer'), max = int(form, 'max'), winBonus = int(form, 'win_bonus');
  const fields: Record<string, string> = {};
  if (!(lies >= 1 && lies < (count ?? 0))) fields.lies = `Entre 1 y ${Math.max(1, (count ?? 1) - 1)} (hay ${count ?? 0} preguntas activas).`;
  if (!(winMax >= 0 && winMax < lies)) fields.win_max_caught = 'Tiene que ser menor que la cantidad de mentiras.';
  if (!(perAnswer >= 0 && perAnswer <= 1000)) fields.per_answer = 'Entre 0 y 1000.';
  if (!(max >= 0 && max <= 5000)) fields.max = 'Entre 0 y 5000.';
  if (!(winBonus >= 0 && winBonus <= 5000)) fields.win_bonus = 'Entre 0 y 5000.';
  const voiceId = str(form, 'voice_id');
  if (!/^[A-Za-z0-9]{12,40}$/.test(voiceId)) fields.voice_id = 'Pegá el ID de la voz de ElevenLabs.';
  if (!str(form, 'accusation').includes('{claims}')) fields.accusation = 'Tiene que incluir {claims}: ahí va lo que dijo.';
  if ([str(form, 'pitch1'), str(form, 'pitch2'), str(form, 'pitch3')].filter(Boolean).length === 0) fields.pitch1 = 'Al menos una frase.';
  if (String(form.get('consent') ?? '').trim().length < 20) fields.consent = 'Explicá que es con voz y qué pasa con lo que dice.';
  if (!(seconds >= 1.5 && seconds <= 10)) fields.rafaga_seconds = 'Entre 1,5 y 10 segundos.';
  if (stages.hilo && (ladder.length < 1 || ladder.length > 10 || ladder.some((x, i) => x > 1000 || (i > 0 && x <= ladder[i - 1])))) fields.ladder = 'De menor a mayor, separados por espacios. Ej: 1,5 2 3 5 10';
  if (Object.keys(fields).length) return { ok: false, error: 'Revisá los campos marcados.', fields };

  const prev = (exp as { definition: Record<string, any> }).definition;
  const definition = {
    ...prev,
    pitch: [str(form, 'pitch1'), str(form, 'pitch2'), str(form, 'pitch3')].filter(Boolean),
    screens: {
      ...(prev.screens ?? {}),
      entry_note: str(form, 'entry_note'),
      consent: String(form.get('consent') ?? '').replace(/\r/g, '').trim(),
      consent_note: str(form, 'consent_note'),
    },
    rules: { ...prev.rules, lies, win_max_caught: winMax },
    rewards: { per_answer: perAnswer, max, win_bonus: winBonus },
    stages,
    rafaga: { ...(prev.rafaga ?? {}), seconds },
    hilo: { ...(prev.hilo ?? {}), multipliers: stages.hilo ? ladder : (prev.hilo?.multipliers ?? ladder) },
    voice: { ...prev.voice, voice_id: voiceId, fallback_voice_id: str(form, 'fallback_voice_id') || prev.voice?.fallback_voice_id },
    lines: {
      ...prev.lines,
      intro: str(form, 'intro'), calibration_start: str(form, 'calibration_start'), calibration_end: str(form, 'calibration_end'),
      game_start: str(form, 'game_start'), unclear: str(form, 'unclear'), not_heard: str(form, 'not_heard'),
      accusation: str(form, 'accusation'), win: str(form, 'win'), lose: str(form, 'lose'),
      result_escaped: str(form, 'result_escaped'), result_caught: str(form, 'result_caught'),
      rafaga_start: str(form, 'rafaga_start'), hilo_start: str(form, 'hilo_start'), hilo_end: str(form, 'hilo_end'), vuelta_start: str(form, 'vuelta_start'),
    },
  };
  const { error } = await from('pressure', 'experiments').update({ definition }).eq('id', id);
  if (error) return { ok: false, error: explain(error)! };
  await audit('cambió las reglas del detector', 'pressure_experiment', id, { lies, winMax, perAnswer, max, winBonus });
  revalidatePath(`/pressure/${(exp as { slug: string }).slug}`);
  return { ok: true, message: 'Ajustes guardados. Valen para las partidas que empiecen desde ahora.' };
}

const EXP_STATUS = ['draft', 'testing', 'live', 'retired'];
export async function setExperimentStatus(id: string, status: string): Promise<FormResult> {
  if (!EXP_STATUS.includes(status)) return { ok: false, error: 'Estado no válido.' };
  const { data, error } = await from('pressure', 'experiments').update({ status }).eq('id', id).select('slug').single();
  if (error) return { ok: false, error: explain(error)! };
  await audit(`puso el juego en ${status}`, 'pressure_experiment', id, { status });
  revalidatePath(`/pressure/${(data as { slug: string }).slug}`);
  revalidatePath('/pressure');
  return { ok: true, message: status === 'retired' ? 'Juego apagado' : status === 'draft' ? 'Juego en borrador: nadie puede entrar' : 'Juego abierto' };
}

/** Invitar a alguien: queda cargado como nodo pendiente. Cuando escriba por WhatsApp, recibe su link. */
export async function inviteNode(form: FormData): Promise<FormResult> {
  const phone = normalizePhone(str(form, 'phone'));
  const nickname = str(form, 'nickname') || null;
  if (!phone) return { ok: false, error: 'Revisá el número.', fields: { phone: 'Con código de área, por ejemplo 11 5555 1234.' } };
  if (nickname && nickname.length > 40) return { ok: false, error: 'Revisá el apodo.', fields: { nickname: 'Máximo 40 caracteres.' } };
  const { data: existing } = await from('core', 'nodes').select('id, status').eq('phone_e164', phone).maybeSingle();
  if (existing) return { ok: false, error: 'Ese número ya está cargado.', fields: { phone: `Ya existe (${(existing as { status: string }).status}).` } };
  const { data, error } = await from('core', 'nodes').insert({ phone_e164: phone, nickname, status: 'pending', acquisition_channel: 'invitacion_panel' }).select('id').single();
  if (error) return { ok: false, error: explain(error)! };
  await audit('invitó a un nodo', 'node', (data as { id: string }).id, { channel: 'panel' });
  revalidatePath('/nodos');
  return { ok: true, message: 'Invitado. Cuando escriba al WhatsApp de BRUTAL le llega su link.' };
}

/** Solo test: simula que un número le escribe al bot. Pasa por el API, igual que un mensaje real. */
export async function simulateWhatsApp(form: FormData): Promise<FormResult> {
  const phone = normalizePhone(str(form, 'phone'));
  const text = str(form, 'text') || 'JUGAR';
  if (!phone) return { ok: false, error: 'Revisá el número.', fields: { phone: 'Con código de área.' } };
  const api = process.env.API_URL, secret = process.env.INTERNAL_API_SECRET;
  if (!api || !secret) return { ok: false, error: 'Falta configurar API_URL e INTERNAL_API_SECRET en el panel.' };
  try {
    const res = await fetch(`${api.replace(/\/+$/, '')}/internal/simulate`, {
      method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, text }), cache: 'no-store', signal: AbortSignal.timeout(20_000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.message ?? `El API respondió ${res.status}` };
    revalidatePath('/mensajes');
    if (!body.handled) return { ok: true, message: body.reason === 'not_invited' ? 'Ese número no está invitado: el bot no responde.' : 'Mensaje recibido sin respuesta.' };
    return { ok: true, message: body.mode === 'wati' ? 'Listo. Le llegó un WhatsApp real a ese número.' : 'Listo. La respuesta del bot está abajo.' };
  } catch {
    return { ok: false, error: 'No pude hablar con el API. ¿Está publicado?' };
  }
}
