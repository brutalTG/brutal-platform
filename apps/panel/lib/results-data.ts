import 'server-only';
import { from } from '@/lib/db';
import type { Facts, Obs, StimulusMeta } from '@/lib/results';

export const PREVIEW_PHONE = '+5490000000001';

export type Instrument = {
  app_slug: string; instrument_type: string; instrument_id: string; name: string; href: string | null;
  observations: number; nodes: number; trap_failed: number; declared_lies: number; first_at: string; last_at: string;
  study_id: string | null; study_name: string | null;
};

const APP_LABEL: Record<string, string> = { drops: 'Drop', pressure: 'Detector (voz)' };
export const appLabel = (a: string, t?: string) => (t === 'onboarding' ? 'Onboarding' : APP_LABEL[a] ?? a);

/** Todos los experimentos que ya tienen respuestas, con nombre y estudio. */
export async function listInstruments(): Promise<Instrument[]> {
  const [{ data: rows, error }, { data: drops }, { data: exps }, { data: studies }] = await Promise.all([
    from('signal', 'instrument_overview').select('*').order('last_at', { ascending: false }),
    from('drops', 'drops').select('slug, name, study_id'),
    from('pressure', 'experiments').select('slug, name, study_id'),
    from('signal', 'studies').select('id, name'),
  ]);
  if (error) throw new Error(error.message);
  const dn = new Map((drops ?? []).map((d: any) => [d.slug, d]));
  const pn = new Map((exps ?? []).map((d: any) => [d.slug, d]));
  const sn = new Map((studies ?? []).map((s: any) => [s.id, s.name]));
  return (rows ?? []).map((r: any) => {
    const own = r.app_slug === 'drops' ? dn.get(r.instrument_id) : r.app_slug === 'pressure' ? pn.get(r.instrument_id) : null;
    const study = own?.study_id ?? r.study_id ?? null;
    return {
      ...r,
      observations: Number(r.observations), nodes: Number(r.nodes), trap_failed: Number(r.trap_failed), declared_lies: Number(r.declared_lies),
      name: r.instrument_type === 'onboarding' ? 'Onboarding' : own?.name ?? r.instrument_id,
      href: r.app_slug === 'drops' && r.instrument_type === 'drop' ? `/experimentos` : r.app_slug === 'pressure' ? `/pressure/${r.instrument_id}` : null,
      study_id: study, study_name: study ? sn.get(study) ?? null : null,
    };
  });
}

async function allPages<T>(build: (fromIdx: number, toIdx: number) => PromiseLike<{ data: T[] | null; error: any }>, size = 1000, max = 50_000) {
  const out: T[] = [];
  for (let i = 0; i < max; i += size) {
    const { data, error } = await build(i, i + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}

/** Observaciones de un experimento, con los datos del nodo y lo que se sabe de cada pregunta. */
export async function loadInstrument(app: string, id: string) {
  const obs = await allPages<Obs>((a, b) =>
    from('signal', 'observations')
      .select('pseudonym_id, stimulus_id, kind, quality, value, value_text, value_number, latency_ms, position, stimulus, context, observed_at')
      .eq('app_slug', app).eq('instrument_id', id).order('observed_at').range(a, b),
  );

  // Datos del nodo por seudónimo (el probador del panel queda afuera).
  const pseudonyms = [...new Set(obs.map((o) => o.pseudonym_id))];
  const facts = new Map<string, Facts>();
  const probe = (await from('core', 'nodes').select('id').eq('phone_e164', PREVIEW_PHONE).maybeSingle()).data as { id: string } | null;
  for (let i = 0; i < pseudonyms.length; i += 300) {
    const chunk = pseudonyms.slice(i, i + 300);
    const { data: ps } = await from('core', 'node_pseudonyms').select('pseudonym_id, node_id').in('pseudonym_id', chunk);
    const nodeIds = (ps ?? []).map((p: any) => p.node_id);
    const { data: nf } = nodeIds.length ? await from('core', 'node_facts').select('id, age, is_minor, gender, province, status').in('id', nodeIds) : { data: [] };
    const byNode = new Map((nf ?? []).map((n: any) => [n.id, n]));
    for (const p of ps ?? []) {
      const n: any = byNode.get((p as any).node_id);
      if (!n) continue;
      facts.set((p as any).pseudonym_id, { age: n.age, is_minor: Boolean(n.is_minor), gender: n.gender, province: n.province, status: probe?.id === n.id ? 'archived' : n.status });
    }
  }

  const meta = new Map<string, StimulusMeta>();
  let name = id, study: { id: string; slug: string; name: string; thesis: string | null; question: string | null; decision_rule: string | null } | null = null;
  let studyId: string | null = null;

  if (app === 'drops') {
    const { data: d } = await from('drops', 'drops').select('id, name, study_id').eq('slug', id).maybeSingle();
    if (d) {
      name = (d as any).name;
      studyId = (d as any).study_id;
      const { data: cards } = await from('drops', 'drop_questions')
        .select('position, questions(id, format, label, content, card_type, signal_pair_id, signal_pair_role)').eq('drop_id', (d as any).id).order('position');
      for (const c of (cards ?? []) as any[]) {
        const q = c.questions;
        if (!q) continue;
        const ct = q.content ?? {};
        meta.set(q.id, {
          label: ct.text ?? ct.prompt ?? q.label, format: q.format, order: c.position, cardType: q.card_type,
          options: Array.isArray(ct.options) ? ct.options.map(String) : undefined,
          optionA: ct.optionA ?? null, optionB: ct.optionB ?? null,
          itemLabels: Array.isArray(ct.items) ? ct.items.map((it: any, i: number) => it?.text ?? it?.trigger?.text ?? (it?.trigger?.type ? `${it.trigger.type === 'video' ? 'Video' : 'Imagen'} ${i + 1}` : `Ítem ${i + 1}`)) : undefined,
          signalPairId: q.signal_pair_id, signalPairRole: q.signal_pair_role,
        });
      }
    }
  } else if (app === 'pressure') {
    const { data: e } = await from('pressure', 'experiments').select('id, name, study_id').eq('slug', id).maybeSingle();
    if (e) {
      name = (e as any).name;
      studyId = (e as any).study_id;
      const { data: items } = await from('pressure', 'items').select('id, section, position, prompt, option_a, option_b').eq('experiment_id', (e as any).id);
      const sectionOrder: Record<string, number> = { calibration: 0, rafaga: 100, game: 200 };
      for (const it of (items ?? []) as any[]) {
        meta.set(it.id, { label: it.prompt, order: (sectionOrder[it.section] ?? 300) + Number(it.position), optionA: it.option_a, optionB: it.option_b, format: it.section });
      }
    }
  }
  if (studyId) {
    const { data: s } = await from('signal', 'studies').select('id, slug, name, thesis, question, decision_rule').eq('id', studyId).maybeSingle();
    study = (s as any) ?? null;
  }
  return { obs, facts, meta, name, study };
}
