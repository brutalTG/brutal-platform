'use server';

// Informes: la IA lee los resultados contra la tesis y deja un borrador; de ahí salen Black Brief y piezas.
import { revalidatePath } from 'next/cache';
import { from, audit, explain } from '@/lib/db';
import { loadInstrument } from '@/lib/results-data';
import { signalPairs, summarize } from '@/lib/results';
import { compactForAi, GUIDE, KIND_LABEL, type ReportKind } from '@/lib/reports';

type R<T = {}> = ({ ok: true } & T) | { ok: false; error: string };
const UUID = /^[0-9a-f-]{36}$/i;

async function claude(system: string, user: string, maxTokens = 4000): Promise<R<{ text: string }>> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: 'Falta la clave de IA. Cargá ANTHROPIC_API_KEY en el proyecto del panel en Vercel y volvé a publicarlo.' };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5', max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
      signal: AbortSignal.timeout(170_000),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: `La IA respondió ${res.status}: ${String(data?.error?.message ?? '').slice(0, 200)}` };
    const text = (data.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n').trim();
    return text ? { ok: true, text } : { ok: false, error: 'La IA no devolvió texto.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === 'TimeoutError' ? 'La IA tardó demasiado. Probá de nuevo.' : 'No pude hablar con la IA.' };
  }
}

const titleOf = (md: string, fallback: string) => (md.match(/^#\s+(.+)$/m)?.[1] ?? fallback).slice(0, 200);

/** Lee los resultados de un experimento y guarda los hallazgos como borrador. */
export async function readResults(app: string, instrumentId: string): Promise<R<{ id: string }>> {
  const { obs, facts, meta, name, study } = await loadInstrument(app, instrumentId);
  const blocks = summarize(obs, facts, meta, { cut: 'edad' });
  if (!blocks.length) return { ok: false, error: 'Todavía no hay respuestas para leer.' };
  const byGender = summarize(obs, facts, meta, { cut: 'genero' });
  const byZone = summarize(obs, facts, meta, { cut: 'zona' });
  const pairs = signalPairs(obs, facts, meta, { cut: 'none' });
  const snapshot = compactForAi({ name, app, study, blocks, byGender, byZone, pairs });
  const r = await claude(GUIDE.findings, JSON.stringify(snapshot));
  if (!r.ok) return r;
  const { data, error } = await from('signal', 'reports').insert({
    study_id: study?.id ?? null, app_slug: app, instrument_id: instrumentId, kind: 'findings',
    title: titleOf(r.text, `Hallazgos · ${name}`), body: r.text, data_snapshot: snapshot, author: 'claude',
  }).select('id').single();
  if (error) return { ok: false, error: explain(error)! };
  await audit('leyó resultados', 'report', (data as any).id, { instrument: `${app}/${instrumentId}` }, 'claude');
  revalidatePath(`/resultados/${app}/${encodeURIComponent(instrumentId)}`);
  revalidatePath('/informes');
  return { ok: true, id: (data as any).id };
}

/** A partir de un informe (hallazgos), arma un Black Brief o una pieza para redes. */
export async function deriveReport(sourceId: string, kind: Exclude<ReportKind, 'findings' | 'note'>): Promise<R<{ id: string }>> {
  if (!UUID.test(sourceId)) return { ok: false, error: 'Informe inválido.' };
  const { data: src } = await from('signal', 'reports').select('*').eq('id', sourceId).maybeSingle();
  if (!src) return { ok: false, error: 'No encuentro el informe.' };
  const s: any = src;
  const r = await claude(GUIDE[kind], JSON.stringify({ hallazgos_editados: s.body, datos: s.data_snapshot }), kind === 'black_brief' ? 6000 : 2500);
  if (!r.ok) return r;
  const { data, error } = await from('signal', 'reports').insert({
    study_id: s.study_id, app_slug: s.app_slug, instrument_id: s.instrument_id, kind,
    title: titleOf(r.text, `${KIND_LABEL[kind]} · ${s.title}`), body: r.text, data_snapshot: { ...s.data_snapshot, from_report: s.id }, author: 'claude',
  }).select('id').single();
  if (error) return { ok: false, error: explain(error)! };
  revalidatePath('/informes');
  return { ok: true, id: (data as any).id };
}

export async function newNote(app: string | null, instrumentId: string | null, studyId: string | null): Promise<R<{ id: string }>> {
  const { data, error } = await from('signal', 'reports').insert({
    app_slug: app, instrument_id: instrumentId, study_id: studyId && UUID.test(studyId) ? studyId : null, kind: 'note', title: 'Nota sin título', body: '',
  }).select('id').single();
  if (error) return { ok: false, error: explain(error)! };
  revalidatePath('/informes');
  return { ok: true, id: (data as any).id };
}

export async function saveReport(id: string, patch: { title?: string; body?: string; status?: string }): Promise<R> {
  if (!UUID.test(id)) return { ok: false, error: 'Informe inválido.' };
  const upd: Record<string, unknown> = {};
  if (patch.title !== undefined) upd.title = patch.title.trim().slice(0, 200) || 'Sin título';
  if (patch.body !== undefined) upd.body = patch.body.slice(0, 200_000);
  if (patch.status !== undefined) {
    if (!['draft', 'final', 'published', 'archived'].includes(patch.status)) return { ok: false, error: 'Estado inválido.' };
    upd.status = patch.status;
  }
  const { error } = await from('signal', 'reports').update(upd).eq('id', id);
  if (error) return { ok: false, error: explain(error)! };
  revalidatePath('/informes');
  revalidatePath(`/informes/${id}`);
  return { ok: true };
}

export async function listReportsFor(app: string, instrumentId: string) {
  const { data } = await from('signal', 'reports').select('id, kind, title, status, author, created_at').eq('app_slug', app).eq('instrument_id', instrumentId).order('created_at', { ascending: false }).limit(20);
  return (data ?? []) as { id: string; kind: ReportKind; title: string; status: string; author: string; created_at: string }[];
}
