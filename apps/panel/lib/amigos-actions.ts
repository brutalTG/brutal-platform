'use server';

import { revalidatePath } from 'next/cache';
import { from, audit, explain } from '@/lib/db';
import { normalizePhone } from '@/lib/phone';
import type { FormResult } from '@/components/ui/form';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

async function callApi(path: string, body: unknown, timeout = 55_000) {
  const api = process.env.API_URL, secret = process.env.INTERNAL_API_SECRET;
  if (!api || !secret) return { ok: false as const, error: 'Falta configurar API_URL e INTERNAL_API_SECRET en el panel.' };
  try {
    const res = await fetch(`${api.replace(/\/+$/, '')}${path}`, {
      method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(timeout),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false as const, error: data.message ?? `El API respondió ${res.status}` };
    return { ok: true as const, data };
  } catch {
    return { ok: false as const, error: 'No pude hablar con el API. ¿Está publicado?' };
  }
}

/** Crea o edita una pregunta de la biblioteca. */
export async function saveQuestion(form: FormData): Promise<FormResult> {
  const id = str(form, 'id');
  const prompt = str(form, 'prompt');
  const detail = str(form, 'detail') || null;
  const option_a = str(form, 'option_a');
  const option_b = str(form, 'option_b');
  const origin = str(form, 'origin') || 'house';
  const tone = str(form, 'tone') || 'fun';
  const subthesis_id = str(form, 'subthesis_id') || null;
  const scheduled_for = str(form, 'scheduled_for') || null;
  const status = str(form, 'status') || 'draft';
  const tags = str(form, 'tags').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8);

  const fields: Record<string, string> = {};
  if (prompt.length < 8) fields.prompt = 'Escribí el dilema.';
  if (prompt.length > 280) fields.prompt = 'Máximo 280 caracteres: tiene que entrar en la imagen.';
  if (detail && detail.length > 200) fields.detail = 'Máximo 200 caracteres.';
  if (!option_a) fields.option_a = 'Falta la opción A.';
  if (!option_b) fields.option_b = 'Falta la opción B.';
  if (option_a.length > 40) fields.option_a = 'Máximo 40 caracteres.';
  if (option_b.length > 40) fields.option_b = 'Máximo 40 caracteres.';
  if (!['house', 'national'].includes(origin)) fields.origin = 'Elegí el tipo.';
  if (origin === 'national' && !scheduled_for) fields.scheduled_for = 'Una pregunta nacional necesita su fecha.';
  if (tone === 'signal' && !subthesis_id) fields.subthesis_id = 'Una pregunta de señal tiene que apuntar a una sub-tesis.';
  if (!['draft', 'active', 'retired'].includes(status)) fields.status = 'Elegí el estado.';
  if (Object.keys(fields).length) return { ok: false, error: 'Revisá los campos marcados.', fields };

  let study_id: string | null = null;
  if (subthesis_id) {
    const { data } = await from('signal', 'subtheses').select('study_id').eq('id', subthesis_id).maybeSingle();
    study_id = (data as { study_id: string } | null)?.study_id ?? null;
  }
  const row = { prompt, detail, option_a, option_b, origin, tone, subthesis_id: tone === 'signal' ? subthesis_id : null, study_id: tone === 'signal' ? study_id : null,
    scheduled_for: origin === 'national' ? scheduled_for : null, status, tags };
  if (id) {
    const { error } = await from('amigos', 'questions').update(row).eq('id', id);
    if (error) return { ok: false, error: /questions_one_national_per_day/.test(error.message) ? 'Ya hay una pregunta nacional activa para esa fecha.' : explain(error)! };
    await audit('editó una pregunta de Amigos de mierda', 'amigos_question', id, { prompt });
  } else {
    const { data, error } = await from('amigos', 'questions').insert(row).select('id').single();
    if (error) return { ok: false, error: /questions_one_national_per_day/.test(error.message) ? 'Ya hay una pregunta nacional activa para esa fecha.' : explain(error)! };
    await audit('creó una pregunta de Amigos de mierda', 'amigos_question', (data as { id: string }).id, { prompt });
  }
  revalidatePath('/amigos/preguntas');
  return { ok: true, message: id ? 'Pregunta guardada.' : 'Pregunta creada.' };
}

export async function setQuestionStatus(id: string, status: 'draft' | 'active' | 'retired'): Promise<FormResult> {
  const { error } = await from('amigos', 'questions').update({ status }).eq('id', id);
  if (error) return { ok: false, error: explain(error)! };
  await audit(`cambió el estado de una pregunta a ${status}`, 'amigos_question', id);
  revalidatePath('/amigos/preguntas');
  return { ok: true, message: status === 'active' ? 'Activa: el bot ya la puede sugerir.' : status === 'retired' ? 'Retirada.' : 'Pasó a borrador.' };
}

/** Solo test: hace de cuenta que un número le escribe al juego. */
export async function simulateAmigos(phoneRaw: string, text: string, audio = false): Promise<FormResult & { phone?: string }> {
  const phone = normalizePhone(phoneRaw);
  if (!phone) return { ok: false, error: 'Revisá el número (con código de área).' };
  if (!audio && !text.trim()) return { ok: false, error: 'Escribí algo.' };
  const r = await callApi('/internal/amigos/simulate', { phone, text, audio });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath('/amigos');
  return { ok: true, phone };
}

/** Botones de operación de un grupo: abrir, revelar, día siguiente, pausar, cerrar. */
export async function groupAction(groupId: string, action: 'open' | 'reveal' | 'next_day' | 'pause' | 'resume' | 'finish', roundId?: string): Promise<FormResult> {
  const r = await callApi('/internal/amigos/action', { action, group_id: groupId, round_id: roundId });
  if (!r.ok) return { ok: false, error: r.error };
  if (r.data?.ok === false) return { ok: false, error: r.data.error ?? 'No se pudo.' };
  await audit(`Amigos de mierda: ${action}`, 'amigos_group', groupId, { round_id: roundId ?? null });
  revalidatePath(`/amigos/${groupId}`);
  revalidatePath('/amigos');
  const msg: Record<string, string> = { open: 'Abierta: la pregunta salió a todos.', reveal: 'Revelada: a cada uno le llegó el resultado.', next_day: 'Arrancó el día siguiente.', pause: 'Grupo en pausa.', resume: 'Grupo activo.', finish: 'Temporada cerrada con etiquetas.' };
  return { ok: true, message: msg[action] };
}

export async function runTick(): Promise<FormResult> {
  const r = await callApi('/internal/amigos/action', { action: 'tick' });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath('/amigos');
  const did = (r.data?.did ?? []) as { group: string; did: string }[];
  return { ok: true, message: did.length ? did.map((d) => `${d.group}: ${d.did}`).join(' · ') : 'Reloj corrido: no había nada que hacer.' };
}

/** Una pregunta que escribió un jugador pasa a la biblioteca como borrador (el "Lab" de CAH). */
export async function promoteQuestion(id: string): Promise<FormResult> {
  const { data: q, error } = await from('amigos', 'questions').select('prompt, detail, option_a, option_b').eq('id', id).single();
  if (error || !q) return { ok: false, error: explain(error) ?? 'No la encuentro.' };
  const { error: e2 } = await from('amigos', 'questions').insert({ ...(q as object), origin: 'house', status: 'draft', tags: ['de-jugador'] });
  if (e2) return { ok: false, error: explain(e2)! };
  await audit('pasó una pregunta de jugador a la biblioteca', 'amigos_question', id);
  revalidatePath('/amigos/preguntas');
  return { ok: true, message: 'Copiada a la biblioteca como borrador.' };
}
