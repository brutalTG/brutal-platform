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
