'use server';

// Estudios: la pregunta, la tesis, las sub-tesis y la regla para decidir. Desde acá nacen los experimentos.
import { revalidatePath } from 'next/cache';
import { from, audit, explain } from '@/lib/db';
import type { FormResult } from '@/components/ui/form';

const str = (f: FormData, k: string, max = 2000) => String(f.get(k) ?? '').replace(/\r/g, '').trim().slice(0, max);
const UUID = /^[0-9a-f-]{36}$/i;
const STATUSES = ['draft', 'design', 'field', 'analysis', 'published', 'archived'];

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'estudio';

export async function saveStudy(form: FormData): Promise<FormResult & { slug?: string }> {
  const id = str(form, 'id');
  const name = str(form, 'name', 120);
  const fields: Record<string, string> = {};
  if (!name) fields.name = 'Ponele un nombre.';
  const thesis = str(form, 'thesis') || null;
  if (Object.keys(fields).length) return { ok: false, error: 'Revisá los campos marcados.', fields };
  const row = { name, thesis, question: str(form, 'question') || null, audience: str(form, 'audience', 300) || null, decision_rule: str(form, 'decision_rule') || null };
  if (id) {
    if (!UUID.test(id)) return { ok: false, error: 'Estudio inválido.' };
    const { error } = await from('signal', 'studies').update(row).eq('id', id);
    if (error) return { ok: false, error: explain(error)! };
    revalidatePath('/estudios', 'layout');
    return { ok: true, message: 'Estudio guardado' };
  }
  let slug = slugify(name);
  const { data: clash } = await from('signal', 'studies').select('id').eq('slug', slug).maybeSingle();
  if (clash) slug = `${slug.slice(0, 44)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await from('signal', 'studies').insert({ ...row, slug, status: 'draft' }).select('id, slug').single();
  if (error) return { ok: false, error: explain(error)! };
  await audit('creó un estudio', 'study', (data as any).id, { name });
  revalidatePath('/estudios');
  return { ok: true, message: 'Estudio creado', slug: (data as any).slug };
}

export async function setStudyStatus(id: string, status: string): Promise<FormResult> {
  if (!UUID.test(id) || !STATUSES.includes(status)) return { ok: false, error: 'Estado inválido.' };
  const { error } = await from('signal', 'studies').update({ status }).eq('id', id);
  if (error) return { ok: false, error: explain(error)! };
  revalidatePath('/estudios', 'layout');
  return { ok: true, message: 'Etapa actualizada' };
}

export async function saveSubthesis(form: FormData): Promise<FormResult> {
  const id = str(form, 'id'), studyId = str(form, 'study_id');
  const statement = str(form, 'statement', 600), expected = str(form, 'expected', 600) || null;
  let code = str(form, 'code', 12).toUpperCase();
  if (!UUID.test(studyId)) return { ok: false, error: 'Estudio inválido.' };
  if (!statement) return { ok: false, error: 'Revisá los campos marcados.', fields: { statement: 'Escribí la sub-tesis.' } };
  if (id) {
    const { error } = await from('signal', 'subtheses').update({ statement, expected, ...(code ? { code } : {}) }).eq('id', id);
    if (error) return { ok: false, error: /duplicate/.test(error.message) ? 'Ya hay otra con ese código.' : explain(error)! };
  } else {
    const { data: existing } = await from('signal', 'subtheses').select('code, position').eq('study_id', studyId);
    const n = (existing ?? []).length;
    if (!code) code = `S${n + 1}`;
    const { error } = await from('signal', 'subtheses').insert({ study_id: studyId, code, statement, expected, position: n });
    if (error) return { ok: false, error: /duplicate/.test(error.message) ? 'Ya hay otra con ese código.' : explain(error)! };
  }
  revalidatePath('/estudios', 'layout');
  return { ok: true, message: 'Sub-tesis guardada' };
}

export async function removeSubthesis(id: string): Promise<FormResult> {
  if (!UUID.test(id)) return { ok: false, error: 'Inválida.' };
  const { error } = await from('signal', 'subtheses').delete().eq('id', id);
  if (error) return { ok: false, error: explain(error)! };
  revalidatePath('/estudios', 'layout');
  return { ok: true, message: 'Sub-tesis borrada' };
}

/** Arranca un experimento nuevo (borrador) ya atado a este estudio y devuelve su id para abrirlo. */
export async function newExperimentForStudy(studyId: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!UUID.test(studyId)) return { ok: false, error: 'Estudio inválido.' };
  const { data: s } = await from('signal', 'studies').select('name, status').eq('id', studyId).maybeSingle();
  if (!s) return { ok: false, error: 'No encuentro el estudio.' };
  const name = `${(s as any).name} · experimento`;
  const { data, error } = await from('drops', 'drops').insert({
    slug: `${slugify((s as any).name).slice(0, 40)}-${Math.random().toString(36).slice(2, 6)}`, name, status: 'draft', study_id: studyId,
    config: { timeoutMessage: 'Brutal eligió por vos.', multiplierCheckpoints: {}, reveal: { title: 'Tu perfil\nde señal', description: '', archetypes: [] } },
  }).select('id').single();
  if (error) return { ok: false, error: explain(error)! };
  if ((s as any).status === 'draft') await from('signal', 'studies').update({ status: 'design' }).eq('id', studyId);
  revalidatePath('/estudios', 'layout');
  return { ok: true, id: (data as any).id };
}
