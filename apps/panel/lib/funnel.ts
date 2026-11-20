'use server';
// ============================================================
// EMBUDO EN VIVO — de dónde viene la gente y dónde se baja
// ============================================================
// Cohorte: personas nuevas (nodos creados en la ventana), agrupadas por canal de entrada
// (ads:<campaña> del link web, ads:whatsapp-jugar del anuncio a WhatsApp, whatsapp, ads:amigo…).
// Pasos: entró → vio la placa → tocó ENTRO → terminó el onboarding → empezó el Drop → lo terminó → reclamó por WhatsApp.
// ============================================================

import { from } from './db';

export type FunnelWindow = '1h' | 'hoy' | '7d';
/** meta: el evento del Pixel de Meta que corresponde a este paso, para comparar con el Administrador de eventos. */
export type FunnelStep = { key: string; label: string; n: number; meta?: string };
/** ads = anuncios reales; organic = sin anuncio (WhatsApp, web, amigos); internal = pruebas del equipo. */
export type ChannelKind = 'ads' | 'organic' | 'internal';
export type FunnelChannel = { channel: string; label: string; kind: ChannelKind; steps: FunnelStep[]; liveNow: number };
export type FunnelData = {
  at: string;
  window: FunnelWindow;
  drop: { slug: string; name: string } | null;
  channels: FunnelChannel[];
  /** Dónde se bajan en el onboarding: personas cuya última pregunta vista fue esa y no lo terminaron. */
  onboardingDrop: { step: string; label: string; reached: number; leftHere: number }[];
  /** Carta por carta: cuántos llegaron y cuántos se fueron ahí (sin actividad hace más de 10 minutos). */
  cards: { position: number; label: string; reached: number; leftHere: number }[];
  liveNow: number;
  error?: string;
};

const ONB_LABELS: Record<string, string> = { intro: 'Entrá a Brutal', nickname: 'Apodo', age: 'Edad', gender: 'Género', location: 'Dónde vivís', closing: 'Cierre' };
// Campañas del equipo para probar (no son gente de los anuncios): van aparte, plegadas.
const INTERNAL = new Set(['bauti', 'brutal', 'test', 'prueba']);
const channelKind = (c: string): ChannelKind => {
  if (!c.startsWith('ads:') || c === 'ads:amigo') return 'organic';
  const name = c.slice(4).toLowerCase();
  return INTERNAL.has(name) || name.startsWith('qa') || name.startsWith('test') ? 'internal' : 'ads';
};
const channelLabel = (c: string) =>
  c === 'ads:whatsapp-jugar' ? 'Anuncio → WhatsApp (JUGAR)' : c === 'ads:ig-ab-drop' ? 'Anuncio de Instagram → Drop' : c === 'whatsapp' ? 'Escribieron al WhatsApp sin anuncio'
    : c === 'ads:amigo' ? 'Link de un amigo' : c === 'web' ? 'Web sin campaña'
    : channelKind(c) === 'internal' ? `Prueba: ${c.slice(4)}` : c.startsWith('ads:') ? `Anuncio → Drop (campaña "${c.slice(4)}")` : c;

function sinceOf(w: FunnelWindow) {
  const now = Date.now();
  if (w === '1h') return new Date(now - 3600_000).toISOString();
  if (w === '7d') return new Date(now - 7 * 86400_000).toISOString();
  // Hoy en Buenos Aires (UTC-3).
  const ar = new Date(now - 3 * 3600_000);
  return new Date(Date.UTC(ar.getUTCFullYear(), ar.getUTCMonth(), ar.getUTCDate()) + 3 * 3600_000).toISOString();
}

async function chunked<T>(ids: string[], size: number, fn: (part: string[]) => Promise<T[]>) {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) out.push(...(await fn(ids.slice(i, i + size))));
  return out;
}

export async function funnelData(win: FunnelWindow = 'hoy'): Promise<FunnelData> {
  const at = new Date().toISOString();
  const empty: FunnelData = { at, window: win, drop: null, channels: [], onboardingDrop: [], cards: [], liveNow: 0 };
  try {
    const since = sinceOf(win);
    const { data: live } = await from('drops', 'drops').select('id, slug, name').eq('status', 'live').order('published_at', { ascending: false }).limit(1);
    const drop = (live ?? [])[0] as { id: string; slug: string; name: string } | undefined;

    const { data: nodesRaw, error } = await from('core', 'nodes')
      .select('id, acquisition_channel, nickname, created_at').gte('created_at', since).not('acquisition_channel', 'like', 'grupo:%')
      .not('acquisition_channel', 'in', '(panel_preview,qa)').order('created_at').limit(5000);
    if (error) return { ...empty, error: error.message };
    const nodes = (nodesRaw ?? []) as { id: string; acquisition_channel: string | null; nickname: string | null; created_at: string }[];
    const ids = nodes.map((n) => n.id);
    if (!ids.length) return { ...empty, drop: drop ? { slug: drop.slug, name: drop.name } : null };

    const events = await chunked(ids, 200, async (part) => ((await from('drops', 'funnel_events').select('node_id, step, detail, created_at').in('node_id', part)).data ?? []) as any[]);
    const pseus = await chunked(ids, 200, async (part) => ((await from('core', 'node_pseudonyms').select('node_id, pseudonym_id').in('node_id', part)).data ?? []) as any[]);
    const nodeOfPs = new Map(pseus.map((p) => [p.pseudonym_id, p.node_id]));
    const sessionsAll = drop ? await chunked(pseus.map((p) => p.pseudonym_id), 200, async (part) => ((await from('drops', 'sessions').select('id, pseudonym_id, status, position, started_at, completed_at').eq('drop_id', drop.id).in('pseudonym_id', part)).data ?? []) as any[]) : [];
    const sessByNode = new Map(sessionsAll.map((s) => [nodeOfPs.get(s.pseudonym_id), s]));
    const lastAnswer = new Map<string, string>();
    const answers = await chunked(sessionsAll.filter((s) => s.status !== 'completed').map((s) => s.id), 200, async (part) => ((await from('drops', 'answers').select('session_id, created_at').in('session_id', part)).data ?? []) as any[]);
    for (const a of answers) if (!lastAnswer.has(a.session_id) || a.created_at > lastAnswer.get(a.session_id)!) lastAnswer.set(a.session_id, a.created_at);
    const claimers = new Set((await chunked(ids, 200, async (part) => ((await from('messaging', 'messages').select('node_id').eq('direction', 'out').eq('purpose', 'web_claim').in('node_id', part)).data ?? []) as any[])).map((m) => m.node_id));

    const ev = new Map<string, Set<string>>();
    const lastOnb = new Map<string, { detail: string; at: string }>();
    const lastSeen = new Map<string, string>();
    for (const e of events) {
      if (!ev.has(e.node_id)) ev.set(e.node_id, new Set());
      ev.get(e.node_id)!.add(e.step);
      if (e.step === 'onb_step' && (!lastOnb.has(e.node_id) || e.created_at > lastOnb.get(e.node_id)!.at)) lastOnb.set(e.node_id, { detail: e.detail, at: e.created_at });
      if (!lastSeen.has(e.node_id) || e.created_at > lastSeen.get(e.node_id)!) lastSeen.set(e.node_id, e.created_at);
    }
    const now = Date.now();
    const recent = (iso?: string, min = 3) => Boolean(iso && now - new Date(iso).getTime() < min * 60_000);
    const isLive = (n: (typeof nodes)[number]) => {
      const s = sessByNode.get(n.id);
      if (s && s.status === 'started') return recent(lastAnswer.get(s.id) ?? s.started_at);
      return !n.nickname && recent(lastSeen.get(n.id) ?? n.created_at);
    };

    const groups = new Map<string, typeof nodes>();
    for (const n of nodes) { const c = n.acquisition_channel ?? 'sin canal'; if (!groups.has(c)) groups.set(c, []); groups.get(c)!.push(n); }
    const channels: FunnelChannel[] = [...groups.entries()].sort((a, b) => b[1].length - a[1].length).map(([channel, list]) => {
      const has = (n: (typeof nodes)[number], s: string) => ev.get(n.id)?.has(s) ?? false;
      const onboarded = (n: (typeof nodes)[number]) => Boolean(n.nickname) || has(n, 'onb_done');
      const started = (n: (typeof nodes)[number]) => sessByNode.has(n.id);
      const done = (n: (typeof nodes)[number]) => sessByNode.get(n.id)?.status === 'completed';
      const count = (f: (n: (typeof nodes)[number]) => boolean) => list.filter(f).length;
      const first = channel === 'ads:whatsapp-jugar' || channel === 'whatsapp' ? 'Escribieron al bot' : 'Abrieron el link';
      return {
        channel, label: channelLabel(channel), kind: channelKind(channel), liveNow: count(isLive),
        steps: [
          { key: 'in', label: first, n: list.length },
          { key: 'intro', label: 'Vieron la placa', meta: 'ViewContent', n: count((n) => has(n, 'intro_view') || has(n, 'intro_enter') || onboarded(n)) },
          { key: 'enter', label: 'Tocaron ENTRO', n: count((n) => has(n, 'intro_enter') || onboarded(n)) },
          { key: 'onb', label: 'Terminaron el onboarding', meta: 'CompleteRegistration', n: count(onboarded) },
          { key: 'start', label: 'Empezaron el Drop', n: count(started) },
          { key: 'done', label: 'Terminaron el Drop', meta: 'Lead', n: count(done) },
          { key: 'claim', label: 'Reclamaron por WhatsApp', n: count((n) => claimers.has(n.id)) },
        ],
      };
    });

    // Onboarding: dónde se fueron los que no lo terminaron.
    const order = ['intro', 'nickname', 'age', 'gender', 'location', 'closing'];
    const reachedOnb = new Map<string, number>(), leftOnb = new Map<string, number>();
    // Las pruebas internas no cuentan en el detalle del onboarding ni carta por carta.
    const real = nodes.filter((n) => channelKind(n.acquisition_channel ?? '') !== 'internal');
    const realIds = new Set(real.map((n) => n.id));
    for (const n of real) {
      const last = lastOnb.get(n.id);
      if (!last) continue;
      const idx = order.indexOf(last.detail);
      for (let i = 0; i <= Math.max(idx, 0); i++) reachedOnb.set(order[i], (reachedOnb.get(order[i]) ?? 0) + 1);
      if (!n.nickname && !ev.get(n.id)?.has('onb_done') && !recent(last.at, 10)) leftOnb.set(last.detail, (leftOnb.get(last.detail) ?? 0) + 1);
    }
    const onboardingDrop = order.filter((s) => reachedOnb.has(s)).map((s) => ({ step: s, label: ONB_LABELS[s] ?? s, reached: reachedOnb.get(s) ?? 0, leftHere: leftOnb.get(s) ?? 0 }));

    // Drop: carta por carta.
    let cards: FunnelData['cards'] = [];
    if (drop) {
      const { data: dq } = await from('drops', 'drop_questions').select('position, questions(label, content)').eq('drop_id', drop.id).eq('enabled', true).order('position');
      const list = (dq ?? []) as any[];
      const sessions = sessionsAll.filter((x) => realIds.has(nodeOfPs.get(x.pseudonym_id)));
      cards = list.map((c, i) => {
        const text = String(c.questions?.content?.text ?? c.questions?.content?.prompt ?? c.questions?.label ?? `Carta ${i + 1}`);
        const reached = sessions.filter((s) => s.status === 'completed' || Number(s.position) >= i).length;
        const leftHere = sessions.filter((s) => s.status !== 'completed' && Number(s.position) === i && !recent(lastAnswer.get(s.id) ?? s.started_at, 10)).length;
        return { position: i, label: text.length > 70 ? text.slice(0, 68) + '…' : text, reached, leftHere };
      });
    }

    return { at, window: win, drop: drop ? { slug: drop.slug, name: drop.name } : null, channels, onboardingDrop, cards, liveNow: channels.filter((c) => c.kind !== 'internal').reduce((t, c) => t + c.liveNow, 0) };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : String(e) };
  }
}
