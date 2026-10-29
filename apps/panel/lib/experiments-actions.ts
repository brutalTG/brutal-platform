'use server';

// Armador de experimentos: lee y guarda cartas y Drops en drops.* (antes vivían en el navegador del sandbox).
import { revalidatePath } from 'next/cache';
import { db, from, audit, explain } from '@/lib/db';
import { panelEnv } from '@/lib/env';
import { buildTexts, withDefaults, type OnboardingTexts } from '@/lib/onboarding';

type Json = Record<string, any>;
export type Saved = { ok: true } | { ok: false; error: string };

export type PanelQuestionRow = { id: string; data: Json; label: string; tags: string[]; createdAt: string; updatedAt: string };
export type PanelDropRow = {
  id: string; name: string; dropId: string; status: 'draft' | 'active' | 'archived'; timeoutMessage: string;
  multiplierCheckpoints: Json; reveal: Json; questionIds: string[]; disabledQuestionIds: string[]; splash?: Json; segmentIds?: string[];
  lastPublishedAt?: string; studyId?: string | null; createdAt: string; updatedAt: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (e: { message?: string; code?: string } | string): Saved => ({ ok: false, error: typeof e === 'string' ? e : explain(e)! });

// ---------- Traducción entre la forma del armador y las columnas ----------
const CARD_TYPE: Record<string, string> = { trap: 'trap', trap_silent: 'trap', dead_drop: 'dead_drop' };

function questionToRow(q: PanelQuestionRow) {
  const { reward, minorReward, type, ...content } = q.data ?? {};
  const timer = Number(content.timer);
  return {
    id: q.id,
    format: String(type ?? 'choice'),
    label: String(q.label || type || 'Carta').slice(0, 300),
    content,
    card_type: CARD_TYPE[type] ?? (['brand', 'culture'].includes(content.cardType) ? content.cardType : 'culture'),
    tags: Array.isArray(q.tags) ? q.tags.map(String).slice(0, 20) : [],
    timer_s: Number.isFinite(timer) && timer > 0 ? Math.round(timer) : null,
    signal_pair_id: content.signalPairId ?? null,
    reward_cash_usd: reward?.type === 'coins' ? Math.max(0, Number(reward.value) || 0) : 0,
    reward_tickets: reward?.type === 'tickets' ? Math.max(0, Math.floor(Number(reward.value) || 0)) : 0,
    reward_minor_tickets: minorReward?.value != null ? Math.max(0, Math.floor(Number(minorReward.value) || 0)) : null,
    status: 'active',
    updated_at: new Date().toISOString(),
  };
}

function rowToQuestion(r: any): PanelQuestionRow {
  const content = r.content ?? {};
  const cash = Number(r.reward_cash_usd) || 0, tickets = Number(r.reward_tickets) || 0;
  const data: Json = {
    ...content,
    type: r.format,
    timer: r.format === 'dead_drop' ? 0 : content.timer ?? r.timer_s ?? 15,
    ...(cash > 0 ? { reward: { type: 'coins', value: cash } } : tickets > 0 ? { reward: { type: 'tickets', value: tickets } } : {}),
    ...(r.reward_minor_tickets != null ? { minorReward: { type: 'tickets', value: Number(r.reward_minor_tickets) } } : {}),
  };
  return { id: r.id, data, label: r.label, tags: r.tags ?? [], createdAt: r.created_at, updatedAt: r.updated_at };
}

const STATUS_IN: Record<string, PanelDropRow['status']> = { draft: 'draft', scheduled: 'draft', live: 'active', closed: 'archived', archived: 'archived' };

function rowToDrop(r: any, cards: any[]): PanelDropRow {
  const cfg = r.config ?? {};
  const mine = cards.filter((c) => c.drop_id === r.id).sort((a, b) => a.position - b.position);
  return {
    id: r.id, name: r.name, dropId: r.slug, status: STATUS_IN[r.status] ?? 'draft',
    timeoutMessage: cfg.timeoutMessage ?? 'Brutal eligió por vos.',
    multiplierCheckpoints: cfg.multiplierCheckpoints ?? {},
    reveal: cfg.reveal ?? { title: 'Tu perfil\nde señal', description: '', archetypes: [] },
    questionIds: mine.map((c) => c.question_id),
    disabledQuestionIds: mine.filter((c) => !c.enabled).map((c) => c.question_id),
    ...(cfg.splash ? { splash: cfg.splash } : {}),
    ...(r.segment_ids?.length ? { segmentIds: r.segment_ids } : {}),
    studyId: r.study_id ?? null,
    ...(r.published_at ? { lastPublishedAt: r.published_at } : {}),
    createdAt: r.created_at, updatedAt: cfg.editedAt ?? r.updated_at,
  };
}

// ---------- Lectura ----------
export async function loadBuilder(): Promise<{ ok: true; questions: PanelQuestionRow[]; drops: PanelDropRow[]; studies: { id: string; name: string }[]; detectors: { slug: string; name: string; status: string }[] } | { ok: false; error: string }> {
  const [q, d, c, st, px] = await Promise.all([
    from('drops', 'questions').select('*').neq('status', 'retired').order('created_at'),
    from('drops', 'drops').select('*').order('created_at'),
    from('drops', 'drop_questions').select('drop_id, question_id, position, enabled'),
    from('signal', 'studies').select('id, name').neq('status', 'archived').order('created_at', { ascending: false }),
    from('pressure', 'experiments').select('slug, name, status').order('created_at', { ascending: false }),
  ]);
  const error = q.error ?? d.error ?? c.error;
  if (error) return { ok: false, error: explain(error)! };
  return { ok: true, questions: (q.data ?? []).map(rowToQuestion), drops: (d.data ?? []).map((r) => rowToDrop(r, c.data ?? [])), studies: (st.data ?? []) as { id: string; name: string }[], detectors: (px.data ?? []) as { slug: string; name: string; status: string }[] };
}

export async function listSegments() {
  const { data } = await from('core', 'segments').select('id, name, node_count').order('name');
  return (data ?? []).map((s: any) => ({ segmentId: s.id, name: s.name, matchingCount: Number(s.node_count) || 0 }));
}

export async function listDimensions() {
  const { data } = await from('profile', 'dimensions').select('*').order('name');
  return (data ?? []).map((x: any) => ({
    dimensionId: x.id, slug: x.slug, name: x.name, description: x.description ?? '',
    valueType: x.value_type === 'scale' ? 'scale' : 'categorical', stability: x.stability,
    scaleMin: x.scale_min, scaleMax: x.scale_max, isActive: x.is_active,
  }));
}

// ---------- Cartas ----------
export async function saveQuestion(q: PanelQuestionRow): Promise<Saved> {
  if (!UUID.test(q?.id ?? '')) return fail('Carta sin identificador.');
  const { error } = await from('drops', 'questions').upsert(questionToRow(q), { onConflict: 'id' });
  if (error) return fail(error);
  return { ok: true };
}

/** Borra la carta. Si alguien ya la respondió, se retira (deja de verse) para no perder la señal. */
export async function removeQuestion(id: string): Promise<Saved> {
  if (!UUID.test(id)) return fail('Carta inválida.');
  const { count } = await from('drops', 'answers').select('id', { count: 'exact', head: true }).eq('question_id', id);
  await from('drops', 'drop_questions').delete().eq('question_id', id);
  const { error } = count
    ? await from('drops', 'questions').update({ status: 'retired' }).eq('id', id)
    : await from('drops', 'questions').delete().eq('id', id);
  if (error) return fail(error);
  return { ok: true };
}

// ---------- Drops ----------
export async function saveDrop(d: PanelDropRow): Promise<Saved> {
  if (!UUID.test(d?.id ?? '')) return fail('Drop sin identificador.');
  if (!/^[a-z0-9-]{3,80}$/.test(d.dropId ?? '')) return fail('El identificador del Drop solo puede tener minúsculas, números y guiones.');
  // Lo que el editor no conoce (la máquina, la voz) se conserva tal como estaba en la base.
  const { data: current } = await from('drops', 'drops').select('config').eq('id', d.id).maybeSingle();
  const { timeoutMessage: _t, multiplierCheckpoints: _m, reveal: _r, splash: _s, editedAt: _e, ...keep } = ((current as any)?.config ?? {}) as Record<string, unknown>;
  const { error } = await db().schema('drops').rpc('panel_save_drop', {
    p: {
      id: d.id, slug: d.dropId, name: (d.name || 'Sin nombre').slice(0, 120), status: 'draft',
      config: {
        ...keep,
        timeoutMessage: d.timeoutMessage, multiplierCheckpoints: d.multiplierCheckpoints ?? {}, reveal: d.reveal ?? {},
        ...(d.splash ? { splash: d.splash } : {}), editedAt: d.updatedAt ?? new Date().toISOString(),
      },
      question_ids: d.questionIds ?? [], disabled_ids: d.disabledQuestionIds ?? [],
      segment_ids: (d.segmentIds ?? []).filter((s) => UUID.test(s)),
    },
  });
  if (error) return fail(/duplicate key.*slug/i.test(error.message) ? 'Ya hay otro Drop con ese identificador.' : error);
  await from('drops', 'drops').update({ study_id: d.studyId && UUID.test(d.studyId) ? d.studyId : null }).eq('id', d.id);
  if (d.status === 'archived') await from('drops', 'drops').update({ status: 'archived' }).eq('id', d.id).neq('status', 'archived');
  if (d.status === 'draft') await from('drops', 'drops').update({ status: 'draft' }).eq('id', d.id).in('status', ['archived', 'closed']);
  return { ok: true };
}

/** Publicar: queda como el Drop que juegan todos. El que estaba publicado se cierra. */
export async function publishDrop(id: string): Promise<Saved & { publishedAt?: string }> {
  if (!UUID.test(id)) return fail('Drop inválido.');
  const { data: d } = await from('drops', 'drops').select('id, name, version, status').eq('id', id).maybeSingle();
  if (!d) return fail('No encuentro ese Drop. ¿Se terminó de guardar?');
  const { count } = await from('drops', 'drop_questions').select('question_id', { count: 'exact', head: true }).eq('drop_id', id).eq('enabled', true);
  if (!count) return fail('El Drop no tiene cartas activas.');
  const now = new Date().toISOString();
  await from('drops', 'drops').update({ status: 'closed', closes_at: now }).eq('status', 'live').neq('id', id);
  const { error } = await from('drops', 'drops').update({ status: 'live', published_at: now, version: Number((d as any).version) + ((d as any).status === 'live' ? 1 : 0), closes_at: null }).eq('id', id);
  if (error) return fail(error);
  await audit('publicó un Drop', 'drop', id, { name: (d as any).name });
  revalidatePath('/experimentos');
  return { ok: true, publishedAt: now };
}

export async function removeDrop(id: string): Promise<Saved> {
  if (!UUID.test(id)) return fail('Drop inválido.');
  const { count } = await from('drops', 'sessions').select('id', { count: 'exact', head: true }).eq('drop_id', id);
  const { error } = count
    ? await from('drops', 'drops').update({ status: 'archived' }).eq('id', id)
    : await from('drops', 'drops').delete().eq('id', id);
  if (error) return fail(error);
  return { ok: true };
}

// ---------- Probar ----------
const PREVIEW_PHONE = '+5490000000001';
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789ab';

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Link de prueba: lo juega el nodo "Probador del panel", aunque el Drop esté en borrador. No acredita nada. */
export async function previewLink(slug: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return { ok: false, error: 'Drop inválido.' };
  let { data: n } = await from('core', 'nodes').select('id').eq('phone_e164', PREVIEW_PHONE).maybeSingle();
  if (!n) {
    const r = await from('core', 'nodes').insert({
      phone_e164: PREVIEW_PHONE, status: 'active', nickname: 'Probador', birth_date: '1999-01-01', province: 'CABA', acquisition_channel: 'panel_preview',
    }).select('id').single();
    if (r.error) return { ok: false, error: explain(r.error)! };
    n = r.data;
  }
  const code = Array.from(crypto.getRandomValues(new Uint8Array(22)), (b) => ALPHABET[b % 32]).join('');
  const { error } = await from('core', 'access_links').insert({
    code_hash: await sha256(code), app_slug: 'drops', purpose: 'test', node_id: (n as any).id,
    target_type: 'drop', target_id: slug, max_uses: 20, expires_at: new Date(Date.now() + 6 * 3600_000).toISOString(),
  });
  if (error) return { ok: false, error: explain(error)! };
  const origin = process.env.DROPS_URL ?? (panelEnv() === 'production' ? 'https://drops.brutal.lat' : 'https://test-drops.brutal.lat');
  return { ok: true, url: `${origin.replace(/\/+$/, '')}/a/${code}` };
}

/** Subida directa de imagen o video para una carta (mismo depósito público que usa el detector). */
export async function cardMediaUploadUrl(name: string, type: string): Promise<{ ok: true; uploadUrl: string; publicUrl: string } | { ok: false; error: string }> {
  if (!/^(image|video)\//.test(type)) return { ok: false, error: 'Solo imágenes o videos.' };
  const ext = (name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
  const path = `drops/${crypto.randomUUID()}.${ext}`;
  const bucket = db().storage.from('pressure-media');
  const { data, error } = await bucket.createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: error?.message ?? 'No se pudo preparar la subida.' };
  return { ok: true, uploadUrl: data.signedUrl, publicUrl: bucket.getPublicUrl(path).data.publicUrl };
}

// ---------- Onboarding ----------

export async function loadOnboarding(): Promise<{ ok: true; texts: OnboardingTexts; edited: boolean } | { ok: false; error: string }> {
  const { data, error } = await from('core', 'apps').select('config').eq('slug', 'drops').maybeSingle();
  if (error) return { ok: false, error: /config/.test(error.message) ? 'Falta aplicar la última migración de la base (core.apps.config).' : explain(error)! };
  const saved = (data as any)?.config?.onboarding ?? null;
  return { ok: true, texts: withDefaults(saved), edited: Boolean(saved) };
}

export async function saveOnboarding(form: FormData): Promise<{ ok: true; message: string } | { ok: false; error: string; fields?: Record<string, string> }> {
  const { texts, errors } = buildTexts((k) => String(form.get(k) ?? ''));
  if (!texts) return { ok: false, error: 'Revisá los campos marcados.', fields: errors };
  const { data, error: e1 } = await from('core', 'apps').select('config').eq('slug', 'drops').maybeSingle();
  if (e1) return { ok: false, error: explain(e1)! };
  const config = { ...((data as any)?.config ?? {}), onboarding: texts };
  const { error } = await from('core', 'apps').update({ config }).eq('slug', 'drops');
  if (error) return { ok: false, error: explain(error)! };
  await audit('editó el onboarding', 'app', 'drops');
  revalidatePath('/onboarding');
  return { ok: true, message: 'Guardado. Lo ve el próximo que entre por un link de onboarding.' };
}
