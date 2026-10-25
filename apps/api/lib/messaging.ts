import 'server-only';
import { env } from './env';
import { from, must } from './db';
import { newCode, sha256 } from './crypto';
import { command, render, sendText, type Inbound } from './whatsapp';
import { createDropsLink } from './drops';
import { selectAudience, type Audience, type Candidate } from './launch-rules';

const cfg = () => ({ mode: env.whatsappMode, endpoint: env.watiEndpoint, token: env.watiToken, channel: env.watiChannel });

async function template(key: string) {
  const row = await must(from('messaging', 'templates').select('body').eq('key', key).maybeSingle(), `plantilla ${key}`);
  if (!row) throw new Error(`Falta la plantilla ${key}`);
  return (row as { body: string }).body;
}

async function upsertContact(phone: string, waId: string | null, displayName: string | null, nodeId: string | null) {
  const existing = await must(from('messaging', 'contacts').select('id, node_id, opted_out_at').eq('phone_e164', phone).maybeSingle(), 'contacto');
  if (existing) {
    const patch: Record<string, unknown> = { last_inbound_at: new Date().toISOString() };
    if (nodeId && !(existing as any).node_id) patch.node_id = nodeId;
    if (displayName) patch.display_name = displayName;
    await from('messaging', 'contacts').update(patch).eq('id', (existing as any).id);
    return existing as { id: string; node_id: string | null; opted_out_at: string | null };
  }
  return must(from('messaging', 'contacts')
    .insert({ phone_e164: phone, wa_id: waId, display_name: displayName, node_id: nodeId, last_inbound_at: new Date().toISOString() })
    .select('id, node_id, opted_out_at').single(), 'crear contacto') as Promise<{ id: string; node_id: string | null; opted_out_at: string | null }>;
}

/** Manda un texto a un contacto y deja el registro, haya salido bien o no. */
export async function sendToContact(contact: { id: string; phone: string; nodeId: string | null }, text: string, purpose: string, templateKey?: string, campaignId?: string) {
  const result = await sendText(cfg(), contact.phone, text);
  const now = new Date().toISOString();
  await from('messaging', 'messages').insert({
    contact_id: contact.id, node_id: contact.nodeId, campaign_id: campaignId ?? null, direction: 'out', purpose, template_key: templateKey ?? null,
    provider_message_id: result.ok ? result.providerMessageId : null,
    status: result.ok ? 'sent' : 'failed', sent_at: result.ok ? now : null,
    failed_at: result.ok ? null : now, error_code: result.ok ? null : result.errorCode, error_message: result.ok ? null : result.errorMessage,
    body: text, idempotency_key: `out:${crypto.randomUUID()}`,
  });
  if (result.ok) await from('messaging', 'contacts').update({ last_outbound_at: now }).eq('id', contact.id);
  return result;
}

/** Link personal al juego: 48 horas, hasta 5 aperturas. */
export async function createPlayLink(nodeId: string, phone: string, experimentSlug: string) {
  const code = newCode();
  await must(from('core', 'access_links').insert({
    code_hash: await sha256(code), app_slug: 'pressure', purpose: 'activity', node_id: nodeId, phone_e164: phone,
    target_type: 'experiment', target_id: experimentSlug, max_uses: 5,
    expires_at: new Date(Date.now() + 48 * 3600_000).toISOString(),
  }), 'crear link');
  return `${env.pressureOrigin}/j/${code}`;
}

export async function rankingText(nodeId: string | null) {
  const season = await must(from('economy', 'seasons').select('id, name').eq('status', 'active').maybeSingle(), 'temporada');
  if (!season) return 'Todavía no arrancó la temporada.';
  const top = await must(from('economy', 'season_ranking').select('node_id, alias, tickets, position, players')
    .eq('season_id', (season as any).id).order('position').limit(5), 'ranking') as any[];
  if (top.length === 0) return `${(season as any).name}: todavía nadie sumó tickets. Podés ser el primero.`;
  const lines = top.map((r) => `${r.position}. ${r.alias} · ${r.tickets} tickets`);
  let mine = '';
  if (nodeId) {
    const me = await must(from('economy', 'season_ranking').select('alias, tickets, position, players')
      .eq('season_id', (season as any).id).eq('node_id', nodeId).maybeSingle(), 'mi posición') as any;
    mine = me ? `\n\nVos: ${me.alias}, #${me.position} de ${me.players} con ${me.tickets} tickets.` : '\n\nTodavía no sumaste tickets.';
  }
  return `${(season as any).name.toUpperCase()} · TOP 5\n${lines.join('\n')}${mine}`;
}

export const ACTIVE_EXPERIMENT = 'detector-001';

/** Un mensaje entrante. Solo responde a invitados (nodos cargados que no están bloqueados). */
export async function handleInbound(m: Inbound) {
  // Idempotente: WATI puede reenviar el mismo evento.
  const dup = await must(from('messaging', 'messages').select('id').eq('provider_message_id', m.providerMessageId).maybeSingle(), 'dedupe');
  if (dup) return { handled: false, reason: 'duplicate' };

  const node = await must(from('core', 'nodes').select('id, status').eq('phone_e164', m.phone).maybeSingle(), 'nodo') as { id: string; status: string } | null;
  const invited = node && !['blocked', 'archived'].includes(node.status);
  const contact = await upsertContact(m.phone, m.waId, m.displayName, invited ? node!.id : null);
  const cmd = command(m.text);

  await from('messaging', 'messages').insert({
    contact_id: contact.id, node_id: invited ? node!.id : null, direction: 'in', command: cmd, purpose: invited ? 'inbound' : 'not_invited',
    provider_message_id: m.providerMessageId, status: 'received', body: m.text, idempotency_key: `in:${m.providerMessageId}`,
  });

  if (!invited) return { handled: false, reason: 'not_invited' };
  const nodeId = node!.id;
  const to = { id: contact.id, phone: m.phone, nodeId };

  // Escribió desde ese número: queda verificado y con permiso para recibir respuestas.
  const now = new Date().toISOString();
  await from('core', 'nodes').update({ phone_verified_at: now, last_active_at: now, ...(node!.status === 'pending' ? { status: 'active' } : {}) }).eq('id', nodeId);
  const consent = await must(from('core', 'consents').select('id').eq('node_id', nodeId).eq('purpose', 'whatsapp_messages').is('revoked_at', null).maybeSingle(), 'consentimiento');
  if (!consent) await from('core', 'consents').insert({ node_id: nodeId, purpose: 'whatsapp_messages', evidence_source: 'whatsapp_inbound', evidence_reference: m.providerMessageId });

  if (cmd === 'opt_out') {
    await from('messaging', 'contacts').update({ opted_out_at: now }).eq('id', contact.id);
    await sendToContact(to, await template('opt_out'), 'opt_out', 'opt_out');
    return { handled: true, reply: 'opt_out' };
  }
  if (contact.opted_out_at) await from('messaging', 'contacts').update({ opted_out_at: null }).eq('id', contact.id);

  if (cmd === 'ranking') {
    await sendToContact(to, await rankingText(nodeId), 'ranking', 'ranking');
    return { handled: true, reply: 'ranking' };
  }
  // Drops: si todavía no completó el perfil, primero el onboarding.
  if (cmd === 'drop' || cmd === 'profile') {
    const n = await must(from('core', 'nodes').select('nickname, birth_date, province').eq('id', nodeId).single(), 'perfil') as any;
    const ready = Boolean(n.nickname && n.birth_date && n.province);
    const l = await createDropsLink(nodeId, ready ? { purpose: 'drop', destination: cmd === 'profile' ? 'profile' : 'drop' } : { purpose: 'onboarding', hours: 72 });
    const text = !ready ? `Bienvenido a BRUTAL. Armá tu perfil acá (dos minutos) y entrás al Drop:\n\n${l.url}\n\nEl link es tuyo, no lo pases.`
      : cmd === 'profile' ? `Tu perfil, tus tickets y el ranking:\n\n${l.url}` : `Tu Drop te está esperando:\n\n${l.url}\n\nEl link es tuyo, no lo pases.`;
    await sendToContact(to, text, ready ? `drops_${cmd}` : 'drops_onboarding');
    return { handled: true, reply: ready ? `drops_${cmd}` : 'drops_onboarding' };
  }
  const link = await createPlayLink(nodeId, m.phone, ACTIVE_EXPERIMENT);
  await sendToContact(to, render(await template('pressure_invite'), { link }), 'pressure_invite', 'pressure_invite');
  return { handled: true, reply: 'pressure_invite' };
}

/** Aviso del resultado al terminar. Solo si el contacto no se dio de baja. */
export async function notifyResult(nodeId: string, vars: { verdict: string; tickets: number; position: number | string; players: number | string }) {
  const contact = await must(from('messaging', 'contacts').select('id, phone_e164, opted_out_at').eq('node_id', nodeId).maybeSingle(), 'contacto') as any;
  if (!contact || contact.opted_out_at) return null;
  return sendToContact({ id: contact.id, phone: contact.phone_e164, nodeId }, render(await template('pressure_result'), vars), 'pressure_result', 'pressure_result');
}

// ---------- Lanzar un experimento desde el panel ----------
const LAUNCH_MAX = 300; // por tanda: más que esto se manda en varias tandas

async function contactFor(phone: string, nodeId: string) {
  const existing = await must(from('messaging', 'contacts').select('id').eq('phone_e164', phone).maybeSingle(), 'contacto') as { id: string } | null;
  if (existing) return existing.id;
  const row = await must(from('messaging', 'contacts').insert({ phone_e164: phone, wa_id: phone.replace(/\D/g, ''), node_id: nodeId }).select('id').single(), 'crear contacto') as { id: string };
  return row.id;
}

async function candidates(dropId: string): Promise<(Candidate & { ready: boolean })[]> {
  const nodes = await must(from('core', 'nodes').select('id, phone_e164, status, nickname, birth_date, province').neq('phone_e164', '+5490000000001').limit(20000), 'nodos') as any[];
  const facts = new Map((await must(from('core', 'node_facts').select('id, age, is_minor, gender, province').limit(20000), 'datos') as any[]).map((f) => [f.id, f]));
  const out = new Set((await must(from('messaging', 'contacts').select('node_id').not('opted_out_at', 'is', null).limit(20000), 'bajas') as any[]).map((c) => c.node_id));
  const ps = new Map((await must(from('core', 'node_pseudonyms').select('node_id, pseudonym_id').limit(20000), 'seudónimos') as any[]).map((p) => [p.pseudonym_id, p.node_id]));
  const played = new Set((await must(from('drops', 'sessions').select('pseudonym_id').eq('drop_id', dropId).eq('status', 'completed').limit(20000), 'jugaron') as any[]).map((x) => ps.get(x.pseudonym_id)));
  return nodes.map((n) => {
    const f = facts.get(n.id) ?? {};
    return {
      id: n.id, phone: n.phone_e164, status: n.status, age: f.age ?? null, is_minor: Boolean(f.is_minor), gender: f.gender ?? null, province: f.province ?? n.province ?? null,
      opted_out: out.has(n.id), already_played: played.has(n.id), ready: Boolean(n.nickname && n.birth_date && n.province),
    };
  });
}

/** Manda el link personal del Drop a quienes correspondan. Con dryRun solo cuenta. */
export async function launchDrop(slug: string, audience: Audience, dryRun: boolean) {
  const d = await must(from('drops', 'drops').select('id, slug, name, status').eq('slug', slug).maybeSingle(), 'drop') as any;
  if (!d) return { ok: false, error: 'No encuentro ese experimento.' };
  const all = await candidates(d.id);
  const { selected, skipped, truncated } = selectAudience(all, audience, LAUNCH_MAX);
  const needOnboarding = selected.filter((c) => !(c as any).ready).length;
  const summary = { audience: selected.length, need_onboarding: needOnboarding, skipped, truncated, minors: selected.filter((c) => c.is_minor).length, mode: env.whatsappMode };
  if (dryRun) return { ok: true, dryRun: true, ...summary };
  if (d.status !== 'live') return { ok: false, error: 'Primero publicalo: solo se puede mandar un experimento que está en juego.' };
  if (!selected.length) return { ok: false, error: 'Nadie para mandar con ese filtro.' };

  const body = await template('drop_invite');
  const campaign = await must(from('messaging', 'campaigns').insert({
    app_slug: 'drops', name: `${d.name} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`, template_key: 'drop_invite',
    target: { drop: d.slug, audience }, status: 'sending', audience_count: selected.length, started_at: new Date().toISOString(),
  }).select('id').single(), 'campaña') as { id: string };

  let sent = 0, failed = 0;
  for (const c of selected) {
    try {
      const ready = (c as any).ready;
      const l = await createDropsLink(c.id, ready ? { purpose: 'drop', dropSlug: d.slug, hours: 72 } : { purpose: 'onboarding', hours: 72 });
      const text = ready ? render(body, { drop: d.name, link: l.url }) : `Hay algo nuevo en BRUTAL: ${d.name}. Primero armá tu perfil (dos minutos) y entrás directo:\n\n${l.url}`;
      const contactId = await contactFor(c.phone, c.id);
      const r = await sendToContact({ id: contactId, phone: c.phone, nodeId: c.id }, text, 'drop_launch', 'drop_invite', campaign.id);
      if (r.ok) sent++; else failed++;
    } catch (e) {
      console.error('launch', e);
      failed++;
    }
  }
  await from('messaging', 'campaigns').update({ status: 'done', sent_count: sent, failed_count: failed, completed_at: new Date().toISOString() }).eq('id', campaign.id);
  return { ok: true, dryRun: false, campaign_id: campaign.id, sent, failed, ...summary };
}
