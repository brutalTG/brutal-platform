'use server';

import { revalidatePath } from 'next/cache';
import { from, audit, explain } from '@/lib/db';

type Result = { ok: true; message?: string } | { ok: false; error: string };

const NODE_STATUSES = ['active', 'pending', 'waitlisted', 'blocked', 'archived'] as const;
const LABEL: Record<string, string> = { active: 'activado', blocked: 'bloqueado', archived: 'archivado', waitlisted: 'pasado a espera', pending: 'vuelto a pendiente' };

export async function setNodeStatus(nodeId: string, status: string): Promise<Result> {
  if (!NODE_STATUSES.includes(status as (typeof NODE_STATUSES)[number])) return { ok: false, error: 'Estado no válido.' };
  const patch: Record<string, unknown> = { status, archived_at: status === 'archived' ? new Date().toISOString() : null };
  const { error } = await from('core', 'nodes').update(patch).eq('id', nodeId);
  if (error) return { ok: false, error: explain(error)! };
  await audit(`nodo ${LABEL[status]}`, 'node', nodeId, { status });
  revalidatePath(`/nodos/${nodeId}`);
  revalidatePath('/nodos');
  return { ok: true, message: `Nodo ${LABEL[status]}` };
}

export async function resolveWithdrawal(id: string, decision: 'approved' | 'rejected'): Promise<Result> {
  const { data, error } = await from('economy', 'withdrawals').update({ status: decision, resolved_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'pending').select('id');
  if (error) return { ok: false, error: explain(error)! };
  if (!data?.length) return { ok: false, error: 'Este retiro ya fue resuelto por otra persona.' };
  await audit(decision === 'approved' ? 'aprobó un retiro' : 'rechazó un retiro', 'withdrawal', id);
  revalidatePath('/recompensas');
  return { ok: true, message: decision === 'approved' ? 'Retiro aprobado' : 'Retiro rechazado' };
}

/** Texto de un mensaje del bot. Las variables entre llaves se completan al mandarlo. */
export async function saveTemplate(form: FormData): Promise<Result & { fields?: Record<string, string> }> {
  const key = String(form.get('key') ?? '');
  const body = String(form.get('body') ?? '').trim();
  const { data: prev } = await from('messaging', 'templates').select('body').eq('key', key).maybeSingle();
  if (!prev) return { ok: false, error: 'No encontré ese mensaje.' };
  if (body.length < 3 || body.length > 1000) return { ok: false, error: 'Revisá el texto.', fields: { body: 'Entre 3 y 1000 caracteres.' } };
  // Las variables que usa el sistema no se pueden perder.
  const needed = [...String((prev as { body: string }).body).matchAll(/\{(\w+)\}/g)].map((m) => m[0]);
  const missing = needed.filter((v) => !body.includes(v));
  if (missing.length) return { ok: false, error: 'Faltan variables.', fields: { body: `Tiene que incluir ${missing.join(', ')}.` } };
  const { error } = await from('messaging', 'templates').update({ body }).eq('key', key);
  if (error) return { ok: false, error: explain(error)! };
  await audit('editó un mensaje del bot', 'template', key);
  revalidatePath('/mensajes');
  return { ok: true, message: 'Mensaje guardado' };
}

/** Un mensaje en cola (WhatsApp apagado) que se mandó a mano desde un teléfono: queda como enviado. */
export async function markMessageSent(id: string): Promise<Result> {
  const { data, error } = await from('messaging', 'messages').update({ status: 'sent', sent_at: new Date().toISOString(), provider_message_id: `manual-${id}` })
    .eq('id', id).eq('status', 'queued').select('id');
  if (error) return { ok: false, error: explain(error)! };
  if (!data?.length) return { ok: false, error: 'Ese mensaje ya no está en cola.' };
  await audit('marcó un mensaje como mandado a mano', 'message', id);
  revalidatePath('/mensajes');
  return { ok: true, message: 'Marcado como enviado' };
}
