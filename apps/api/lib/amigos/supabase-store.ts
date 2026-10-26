import 'server-only';
import { db, from, must } from '../db';
import type { Store } from './store.ts';
import type { Answer, Bet, Group, Inbound, Member, Observation, Outbound, Person, Player, PointRow, Question, Round, Standing, Voice } from './types.ts';
import { newGroupCode } from './rules.ts';

const AUDIO_BUCKET = 'amigos-audio';
const isDup = (e: { code?: string; message?: string } | null) => Boolean(e && (e.code === '23505' || /duplicate key/i.test(e.message ?? '')));

export type TransportConfig = { mode: 'mock' | 'gateway' | 'disabled'; gatewayUrl: string; gatewaySecret: string };

type SendResult = { ok: true; id: string } | { ok: false; code: string; message: string };

export async function gatewaySend(cfg: TransportConfig, to: string, out: Outbound): Promise<SendResult> {
  if (cfg.mode === 'disabled') return { ok: false, code: 'disabled', message: 'WhatsApp del juego apagado' };
  if (cfg.mode === 'mock') return { ok: true, id: `mock-${crypto.randomUUID()}` };
  try {
    const res = await fetch(`${cfg.gatewayUrl}/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.gatewaySecret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: to.replace(/\D/g, ''), text: out.text ?? null, image_url: out.imageUrl ?? null, audio_url: out.audioUrl ?? null }),
      signal: AbortSignal.timeout(10_000),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) return { ok: false, code: String(data?.error ?? res.status), message: String(data?.message ?? 'El gateway no aceptó el mensaje').slice(0, 500) };
    return { ok: true, id: String(data?.id ?? `gw-${crypto.randomUUID()}`) };
  } catch (e) {
    return { ok: false, code: 'network_error', message: e instanceof Error ? e.message.slice(0, 300) : 'error de red' };
  }
}

export class SupabaseStore implements Store {
  constructor(private cfg: TransportConfig) {}

  // ---------- Personas ----------
  async seenInbound(providerId: string) {
    const row = await must(from('messaging', 'messages').select('id').eq('provider_message_id', `amigos:${providerId}`).maybeSingle(), 'dedupe');
    return Boolean(row);
  }

  async ensurePerson(phone: string, displayName: string | null): Promise<Person> {
    const now = new Date().toISOString();
    let node = await must(from('core', 'nodes').select('id, status').eq('phone_e164', phone).maybeSingle(), 'nodo') as { id: string; status: string } | null;
    if (!node) {
      const { data, error } = await from('core', 'nodes')
        .insert({ phone_e164: phone, status: 'active', phone_verified_at: now, last_active_at: now, acquisition_channel: 'amigos' })
        .select('id, status').single();
      if (error && isDup(error)) node = await must(from('core', 'nodes').select('id, status').eq('phone_e164', phone).single(), 'nodo') as any;
      else if (error) throw new Error(`crear nodo: ${error.message}`);
      else node = data as any;
    } else {
      await from('core', 'nodes').update({ last_active_at: now, phone_verified_at: now, ...(node.status === 'pending' ? { status: 'active' } : {}) }).eq('id', node.id);
    }
    const ps = await must(from('core', 'node_pseudonyms').select('pseudonym_id').eq('node_id', node!.id).single(), 'seudónimo') as { pseudonym_id: string };
    let contact = await must(from('messaging', 'contacts').select('id, node_id, opted_out_at').eq('phone_e164', phone).maybeSingle(), 'contacto') as any;
    if (!contact) {
      contact = await must(from('messaging', 'contacts')
        .insert({ phone_e164: phone, wa_id: phone.replace(/\D/g, ''), node_id: node!.id, display_name: displayName, last_inbound_at: now })
        .select('id, node_id, opted_out_at').single(), 'crear contacto');
    } else {
      await from('messaging', 'contacts').update({ last_inbound_at: now, ...(contact.node_id ? {} : { node_id: node!.id }), ...(displayName ? { display_name: displayName } : {}) }).eq('id', contact.id);
    }
    return { nodeId: node!.id, pseudonymId: ps.pseudonym_id, phone, contactId: contact.id, optedOut: Boolean(contact.opted_out_at) || node!.status === 'blocked' };
  }

  async personByPseudonym(pseudonymId: string): Promise<Person | null> {
    const ps = await must(from('core', 'node_pseudonyms').select('node_id').eq('pseudonym_id', pseudonymId).maybeSingle(), 'seudónimo') as { node_id: string } | null;
    if (!ps) return null;
    const node = await must(from('core', 'nodes').select('id, phone_e164, status').eq('id', ps.node_id).single(), 'nodo') as any;
    let contact = await must(from('messaging', 'contacts').select('id, opted_out_at').eq('phone_e164', node.phone_e164).maybeSingle(), 'contacto') as any;
    if (!contact) contact = await must(from('messaging', 'contacts').insert({ phone_e164: node.phone_e164, wa_id: node.phone_e164.replace(/\D/g, ''), node_id: node.id }).select('id, opted_out_at').single(), 'crear contacto');
    return { nodeId: node.id, pseudonymId, phone: node.phone_e164, contactId: contact.id, optedOut: Boolean(contact.opted_out_at) || node.status === 'blocked' };
  }

  async logInbound(p: Person, m: Inbound) {
    const { error } = await from('messaging', 'messages').insert({
      contact_id: p.contactId, node_id: p.nodeId, direction: 'in', purpose: 'amigos_inbound', provider_message_id: `amigos:${m.id}`,
      status: 'received', body: m.audio ? `[audio ${m.audio.seconds ?? '?'}s]` : m.text.slice(0, 4096), media_kind: m.audio ? 'audio' : null,
      idempotency_key: `in:amigos:${m.id}`,
    });
    if (error && !isDup(error)) throw new Error(`registrar mensaje: ${error.message}`);
  }

  async setOptOut(p: Person, out: boolean) {
    await from('messaging', 'contacts').update({ opted_out_at: out ? new Date().toISOString() : null }).eq('id', p.contactId);
    p.optedOut = out;
  }

  async grantConsent(p: Person, purpose: 'whatsapp_messages' | 'research_use' | 'voice_recording', evidence: string, ref: string | null = null) {
    const has = await must(from('core', 'consents').select('id').eq('node_id', p.nodeId).eq('purpose', purpose).is('revoked_at', null).maybeSingle(), 'consentimiento');
    if (has) return;
    const { error } = await from('core', 'consents').insert({ node_id: p.nodeId, purpose, evidence_source: evidence, evidence_reference: ref });
    if (error && !isDup(error)) throw new Error(`consentimiento: ${error.message}`);
  }

  async touchNode(p: Person, patch: { nickname?: string | null; referredBy?: string | null }) {
    const node = await must(from('core', 'nodes').select('nickname, referred_by').eq('id', p.nodeId).single(), 'nodo') as any;
    const up: Record<string, unknown> = {};
    if (patch.nickname && !node.nickname) up.nickname = patch.nickname;
    if (patch.referredBy && !node.referred_by) {
      const ref = await must(from('core', 'node_pseudonyms').select('node_id').eq('pseudonym_id', patch.referredBy).maybeSingle(), 'referido') as any;
      if (ref && ref.node_id !== p.nodeId) up.referred_by = ref.node_id;
    }
    if (Object.keys(up).length) await from('core', 'nodes').update(up).eq('id', p.nodeId);
  }

  async player(pseudonymId: string): Promise<Player> {
    const row = await must(from('amigos', 'players').select('*').eq('pseudonym_id', pseudonymId).maybeSingle(), 'jugador');
    if (row) return row as Player;
    const { data, error } = await from('amigos', 'players').insert({ pseudonym_id: pseudonymId }).select('*').single();
    if (error && isDup(error)) return must(from('amigos', 'players').select('*').eq('pseudonym_id', pseudonymId).single(), 'jugador') as Promise<Player>;
    if (error) throw new Error(`jugador: ${error.message}`);
    return data as Player;
  }

  async savePlayer(pseudonymId: string, patch: Partial<Player>) {
    await this.player(pseudonymId);
    await must(from('amigos', 'players').update(patch).eq('pseudonym_id', pseudonymId), 'guardar jugador');
  }

  // ---------- Grupos ----------
  async createGroup(input: { name: string; founderPseudonymId: string; test: boolean }): Promise<Group> {
    for (let i = 0; i < 6; i++) {
      const { data, error } = await from('amigos', 'groups')
        .insert({ code: newGroupCode(), name: input.name, founder_pseudonym_id: input.founderPseudonymId, test: input.test }).select('*').single();
      if (!error) return data as Group;
      if (!isDup(error)) throw new Error(`crear grupo: ${error.message}`);
    }
    throw new Error('No pude generar un código de grupo libre');
  }
  async group(id: string) { return must(from('amigos', 'groups').select('*').eq('id', id).maybeSingle(), 'grupo') as Promise<Group | null>; }
  async groupByCode(code: string) { return must(from('amigos', 'groups').select('*').eq('code', code).maybeSingle(), 'grupo') as Promise<Group | null>; }
  async groupsToTick() { return must(from('amigos', 'groups').select('*').in('status', ['setup', 'active']).limit(2000), 'grupos') as Promise<Group[]>; }
  async updateGroup(id: string, patch: Partial<Group>) {
    const extra = patch.status === 'finished' ? { finished_at: new Date().toISOString() } : patch.status === 'active' ? { finished_at: null } : {};
    await must(from('amigos', 'groups').update({ ...patch, ...extra }).eq('id', id), 'guardar grupo');
  }

  async members(groupId: string) { return must(from('amigos', 'members').select('*').eq('group_id', groupId).order('position'), 'miembros') as Promise<Member[]>; }
  async memberships(pseudonymId: string) { return must(from('amigos', 'members').select('*').eq('pseudonym_id', pseudonymId), 'membresías') as Promise<Member[]>; }
  async addMember(input: { groupId: string; name: string; pseudonymId: string | null; status: Member['status'] }): Promise<Member> {
    for (let i = 0; i < 3; i++) {
      const last = await must(from('amigos', 'members').select('position').eq('group_id', input.groupId).order('position', { ascending: false }).limit(1).maybeSingle(), 'posición') as { position: number } | null;
      const { data, error } = await from('amigos', 'members').insert({
        group_id: input.groupId, roster_name: input.name, pseudonym_id: input.pseudonymId, status: input.status,
        position: (last?.position ?? -1) + 1, joined_at: input.status === 'active' ? new Date().toISOString() : null,
      }).select('*').single();
      if (!error) return data as Member;
      if (!isDup(error) || /members_name_idx/.test(error.message)) throw new Error(`sumar miembro: ${error.message}`);
    }
    throw new Error('No pude sumar al miembro');
  }
  async updateMember(id: string, patch: Partial<Member>) { await must(from('amigos', 'members').update(patch).eq('id', id), 'guardar miembro'); }

  // ---------- Rondas ----------
  async rounds(groupId: string, season: number) { return must(from('amigos', 'rounds').select('*').eq('group_id', groupId).eq('season', season).order('day'), 'rondas') as Promise<Round[]>; }
  async round(id: string) { return must(from('amigos', 'rounds').select('*').eq('id', id).maybeSingle(), 'ronda') as Promise<Round | null>; }
  async createRound(input: Parameters<Store['createRound']>[0]) { return must(from('amigos', 'rounds').insert(input).select('*').single(), 'crear ronda') as Promise<Round>; }
  async updateRound(id: string, patch: Partial<Round>) { await must(from('amigos', 'rounds').update(patch).eq('id', id), 'guardar ronda'); }

  async answers(roundId: string) { return must(from('amigos', 'answers').select('*').eq('round_id', roundId), 'respuestas') as Promise<Answer[]>; }
  async saveAnswer(a: Answer) {
    const { error } = await from('amigos', 'answers').insert(a);
    if (error && isDup(error)) return false;
    if (error) throw new Error(`respuesta: ${error.message}`);
    return true;
  }
  async bets(roundId: string) { return must(from('amigos', 'bets').select('*').eq('round_id', roundId), 'apuestas') as Promise<Bet[]>; }
  async saveBet(b: Bet) { await must(from('amigos', 'bets').upsert(b, { onConflict: 'round_id,bettor_member_id,target_member_id' }), 'apuesta'); }
  async gradeBets(roundId: string, graded: Bet[]) {
    for (const b of graded) {
      await must(from('amigos', 'bets').update({ correct: b.correct }).eq('round_id', roundId).eq('bettor_member_id', b.bettor_member_id).eq('target_member_id', b.target_member_id), 'corregir apuesta');
    }
  }
  async voices(roundId: string) { return must(from('amigos', 'voices').select('*').eq('round_id', roundId), 'audios') as Promise<Voice[]>; }
  async saveVoice(v: Omit<Voice, 'id' | 'rating' | 'delivered_at' | 'rated_at'>) { return must(from('amigos', 'voices').upsert(v, { onConflict: 'round_id,from_member_id' }).select('*').single(), 'audio') as Promise<Voice>; }
  async updateVoice(id: string, patch: Partial<Voice>) { await must(from('amigos', 'voices').update(patch).eq('id', id), 'guardar audio'); }
  async pendingRatings(memberIds: string[]) {
    if (memberIds.length === 0) return [];
    return must(from('amigos', 'voices').select('*').in('to_member_id', memberIds).not('delivered_at', 'is', null).is('rating', null).eq('skipped', false).order('delivered_at'), 'calificaciones') as Promise<Voice[]>;
  }
  async addPoints(rows: PointRow[]) {
    if (rows.length === 0) return;
    await must(from('amigos', 'points').upsert(rows, { onConflict: 'round_id,member_id,reason', ignoreDuplicates: true }), 'puntos');
  }
  async standings(groupId: string, season: number) {
    return must(from('amigos', 'standings').select('member_id, roster_name, points, position').eq('group_id', groupId).eq('season', season), 'tabla') as Promise<Standing[]>;
  }

  // ---------- Preguntas ----------
  async question(id: string) { return must(from('amigos', 'questions').select('*').eq('id', id).maybeSingle(), 'pregunta') as Promise<Question | null>; }
  async suggestions(n: number, exclude: string[], preferTag?: string) {
    let q = from('amigos', 'questions').select('*').eq('origin', 'house').eq('status', 'active').order('offered').limit(60);
    if (exclude.length) q = q.not('id', 'in', `(${exclude.join(',')})`);
    const rows = await must(q, 'sugerencias') as Question[];
    const score = (x: Question) => (preferTag && x.tags?.includes(preferTag) ? -1000 : 0) + x.offered + Math.random() * 3;
    return rows.map((x) => ({ x, s: score(x) })).sort((a, b) => a.s - b.s).slice(0, n).map((r) => r.x);
  }
  async nationalFor(date: string) {
    return must(from('amigos', 'questions').select('*').eq('origin', 'national').eq('status', 'active').eq('scheduled_for', date).maybeSingle(), 'pregunta nacional') as Promise<Question | null>;
  }
  async createQuestion(q: Pick<Question, 'prompt' | 'detail' | 'option_a' | 'option_b'> & { authorPseudonymId: string }) {
    return must(from('amigos', 'questions').insert({
      prompt: q.prompt.slice(0, 280).padEnd(8, '.'), detail: q.detail, option_a: q.option_a, option_b: q.option_b,
      origin: 'player', status: 'active', author_pseudonym_id: q.authorPseudonymId, picked: 1,
    }).select('*').single(), 'crear pregunta') as Promise<Question>;
  }
  async bumpQuestion(id: string, field: 'offered' | 'picked') {
    const row = await must(from('amigos', 'questions').select(field).eq('id', id).maybeSingle(), 'pregunta') as any;
    if (row) await from('amigos', 'questions').update({ [field]: Number(row[field] ?? 0) + 1 }).eq('id', id);
  }
  async usedQuestionIds(groupId: string) {
    const rows = await must(from('amigos', 'rounds').select('question_id').eq('group_id', groupId).not('question_id', 'is', null), 'usadas') as { question_id: string }[];
    return rows.map((r) => r.question_id);
  }

  // ---------- Señal y audios ----------
  async observe(o: Observation) {
    const { error } = await from('signal', 'observations').insert({ ...o, app_slug: 'amigos', instrument_version: '1' });
    if (error && !isDup(error)) console.error('observación amigos', error.message);
  }

  private bucketReady = false;
  private async ensureBucket() {
    if (this.bucketReady) return;
    const s = db().storage;
    const { data } = await s.getBucket(AUDIO_BUCKET);
    if (!data) await s.createBucket(AUDIO_BUCKET, { public: false });
    this.bucketReady = true;
  }
  async uploadAudio(path: string, data: Uint8Array, mime: string) {
    await this.ensureBucket();
    const { error } = await db().storage.from(AUDIO_BUCKET).upload(path, data, { contentType: mime.split(';')[0] || 'audio/ogg', upsert: true });
    if (error) throw new Error(`subir audio: ${error.message}`);
    return path;
  }
  async audioUrl(path: string) {
    const { data } = await db().storage.from(AUDIO_BUCKET).createSignedUrl(path, 7 * 86400);
    return data?.signedUrl ?? null;
  }

  async erasePerson(p: Person) {
    const ms = await this.memberships(p.pseudonymId);
    const ids = ms.map((m) => m.id);
    if (ids.length) {
      const vs = await must(from('amigos', 'voices').select('audio_path').in('from_member_id', ids), 'audios') as { audio_path: string | null }[];
      const paths = vs.map((v) => v.audio_path).filter(Boolean) as string[];
      if (paths.length) await db().storage.from(AUDIO_BUCKET).remove(paths);
      await from('amigos', 'voices').delete().in('from_member_id', ids);
      await from('amigos', 'answers').delete().in('member_id', ids);
      await from('amigos', 'bets').delete().in('bettor_member_id', ids);
      for (const m of ms) await from('amigos', 'members').update({ status: 'left', roster_name: `Borrado ${m.id.slice(0, 4)}` }).eq('id', m.id);
    }
    await from('signal', 'observations').update({ quality: 'excluded', quality_note: 'El nodo pidió borrar lo jugado (BORRAME)' })
      .eq('pseudonym_id', p.pseudonymId).eq('app_slug', 'amigos');
    const now = new Date().toISOString();
    await from('core', 'consents').update({ revoked_at: now }).eq('node_id', p.nodeId).in('purpose', ['research_use', 'voice_recording']).is('revoked_at', null);
    await from('amigos', 'players').update({ step: 'idle', step_data: {}, step_group_id: null, step_round_id: null }).eq('pseudonym_id', p.pseudonymId);
    await this.setOptOut(p, true);
  }

  // ---------- Lo que sale ----------
  async send(p: Person, out: Outbound, purpose: string) {
    // Sin URL de gateway: el mensaje queda en cola y el gateway lo viene a buscar (puede correr en cualquier compu, sin IP pública).
    if (this.cfg.mode === 'gateway' && !this.cfg.gatewayUrl) {
      await from('messaging', 'messages').insert({
        contact_id: p.contactId, node_id: p.nodeId, direction: 'out', purpose, status: 'queued',
        body: out.text?.slice(0, 4096) ?? null, media_url: out.imageUrl ?? out.audioUrl ?? null,
        media_kind: out.imageUrl ? 'image' : out.audioUrl ? 'audio' : null, idempotency_key: `out:${crypto.randomUUID()}`,
      });
      return;
    }
    const r = await gatewaySend(this.cfg, p.phone, out);
    const now = new Date().toISOString();
    await from('messaging', 'messages').insert({
      contact_id: p.contactId, node_id: p.nodeId, direction: 'out', purpose,
      provider_message_id: r.ok ? `amigos:${r.id}` : null, status: r.ok ? 'sent' : 'failed',
      sent_at: r.ok ? now : null, failed_at: r.ok ? null : now, error_code: r.ok ? null : r.code, error_message: r.ok ? null : r.message,
      body: out.text?.slice(0, 4096) ?? null, media_url: out.imageUrl ?? out.audioUrl ?? null,
      media_kind: out.imageUrl ? 'image' : out.audioUrl ? 'audio' : null, idempotency_key: `out:${crypto.randomUUID()}`,
    });
    if (r.ok) await from('messaging', 'contacts').update({ last_outbound_at: now }).eq('id', p.contactId);
  }

  /** Lo que espera salir, en orden. Al entregarlo queda como enviado: si el gateway falla, avisa con ack. */
  async claimOutbox(limit: number) {
    const rows = await must(from('messaging', 'messages').select('id, contact_id, body, media_url, media_kind, created_at')
      .eq('status', 'queued').like('purpose', 'amigos%').order('created_at').limit(limit), 'cola') as any[];
    if (rows.length === 0) return [];
    const now = new Date().toISOString();
    const claimed = await must(from('messaging', 'messages').update({ status: 'sent', sent_at: now })
      .in('id', rows.map((r) => r.id)).eq('status', 'queued').select('id'), 'tomar cola') as { id: string }[];
    const ok = new Set(claimed.map((c) => c.id));
    const contacts = await must(from('messaging', 'contacts').select('id, phone_e164').in('id', [...new Set(rows.map((r) => r.contact_id))]), 'teléfonos') as any[];
    const phone = new Map(contacts.map((c) => [c.id, c.phone_e164]));
    for (const id of new Set(rows.map((r) => r.contact_id))) await from('messaging', 'contacts').update({ last_outbound_at: now }).eq('id', id);
    return rows.filter((r) => ok.has(r.id)).map((r) => ({
      id: r.id, to: String(phone.get(r.contact_id) ?? '').replace(/\D/g, ''), text: r.body,
      image_url: r.media_kind === 'image' ? r.media_url : null, audio_url: r.media_kind === 'audio' ? r.media_url : null,
    }));
  }

  async ackOutbox(id: string, ok: boolean, providerId: string | null, error: string | null) {
    const now = new Date().toISOString();
    await from('messaging', 'messages').update(ok
      ? { provider_message_id: providerId ? `amigos:${providerId}` : null }
      : { status: 'failed', failed_at: now, error_code: 'gateway', error_message: (error ?? 'falló el envío').slice(0, 500) }).eq('id', id);
  }
}
