// El motor de AMIGOS DE MIERDA. Recibe mensajes, corre el reloj y decide qué decirle a cada uno.
// No sabe nada de Supabase ni de WhatsApp: habla con un Store y arma links con Urls.
import type { Store } from './store.ts';
import type { Answer, Choice, Group, Inbound, Member, Person, Player, Question, Round, Step, Voice } from './types.ts';
import * as R from './rules.ts';
import { NUDGES, T } from './text.ts';

export type Urls = {
  question(q: Question, opts: { by: string; teaser?: string | null }): string;
  reveal(round: Round, group: Group, question: Question): string;
  table(group: Group): string;
  label(group: Group, member: Member, label: string, stat: string): string;
};

export type Ctx = {
  store: Store;
  urls: Urls;
  now: Date;
  publicNumber: string;
  test: boolean;
  transcribe?: (data: Uint8Array, mime: string) => Promise<string | null>;
};

const MAX_MEMBERS = 12;
const TASK_STEPS: Step[] = ['answer', 'bet', 'voice', 'rate'];
const FREE_TEXT: Step[] = ['f_name', 'f_me', 'custom_a', 'custom_b', 'f_roster', 'j_who'];

// ---------- Links ----------
export function joinLink(ctx: Ctx, g: Group) {
  return `https://wa.me/${ctx.publicNumber}?text=${encodeURIComponent(`Me sumo a ${g.name} #${g.code}`)}`;
}
export function startLink(ctx: Ctx) {
  return `https://wa.me/${ctx.publicNumber}?text=${encodeURIComponent('Quiero jugar con mi grupo')}`;
}

// ---------- Hablar ----------
async function say(ctx: Ctx, p: Person, text: string, purpose: string) {
  if (p.optedOut) return;
  await ctx.store.send(p, { text }, `amigos_${purpose}`);
}
async function show(ctx: Ctx, p: Person, imageUrl: string, text: string | undefined, purpose: string) {
  if (p.optedOut) return;
  await ctx.store.send(p, { imageUrl, text }, `amigos_${purpose}`);
}

async function setStep(ctx: Ctx, p: Person, step: Step, opts: { group?: string | null; round?: string | null; data?: Record<string, unknown>; prompt?: string } = {}) {
  await ctx.store.savePlayer(p.pseudonymId, {
    step, step_group_id: opts.group ?? null, step_round_id: opts.round ?? null,
    step_data: { ...(opts.data ?? {}), ...(opts.prompt ? { prompt: opts.prompt } : {}) },
    prompted_at: ctx.now.toISOString(),
  });
  if (opts.prompt) await say(ctx, p, opts.prompt, step);
}
const idle = (ctx: Ctx, p: Person) => setStep(ctx, p, 'idle');

// ---------- Lecturas comunes ----------
async function founderOf(ctx: Ctx, g: Group, members?: Member[]) {
  const ms = members ?? await ctx.store.members(g.id);
  return ms.find((m) => m.pseudonym_id === g.founder_pseudonym_id) ?? null;
}
async function currentRound(ctx: Ctx, g: Group) {
  const rs = await ctx.store.rounds(g.id, g.season);
  return rs.sort((a, b) => a.day - b.day).at(-1) ?? null;
}
const active = (ms: Member[]) => R.byPosition(ms.filter((m) => m.status === 'active' && m.pseudonym_id));
const nameOf = (ms: Member[], id: string | null) => ms.find((m) => m.id === id)?.roster_name ?? '?';
const label = (q: Question, c: Choice) => (c === 'a' ? q.option_a : q.option_b);

function byLine(g: Group, r: Round, ms: Member[]) {
  return r.author_member_id ? `Pregunta de ${nameOf(ms, r.author_member_id)} · ${g.name}` : `Pregunta de BRUTAL · ${g.name}`;
}

function obsContext(ctx: Ctx, g: Group, r: Round, q: Question, me: Member | null) {
  return {
    group_id: g.id, group_number: g.number, season: r.season, day: r.day, origin: q.origin,
    author: r.author_member_id === null ? 'brutal' : r.author_member_id === me?.id ? 'self' : 'friend',
    victim: r.victim_member_id ? (r.victim_member_id === me?.id ? 'self' : 'other') : null,
    group_size: undefined as number | undefined, test: g.test || ctx.test,
  };
}
const stimulus = (q: Question) => ({ prompt: q.prompt, detail: q.detail, option_a: q.option_a, option_b: q.option_b, origin: q.origin, tone: q.tone });

// =====================================================================
// Mensaje entrante
// =====================================================================
export async function handleInbound(ctx: Ctx, m: Inbound): Promise<{ handled: boolean; reason?: string }> {
  const s = ctx.store;
  if (await s.seenInbound(m.id)) return { handled: false, reason: 'duplicate' };
  const person = await s.ensurePerson(m.phone, m.name);
  await s.logInbound(person, m);
  await s.grantConsent(person, 'whatsapp_messages', 'amigos_inbound', m.id);
  const player = await s.player(person.pseudonymId);
  if (player.blocked_reason) return { handled: false, reason: 'blocked' };

  // En los pasos donde se escribe libre (nombres, opciones, audios escritos), solo valen SALIR, BORRAME y AYUDA.
  const raw = m.audio ? null : R.command(m.text);
  const cmd = raw && FREE_TEXT.includes(player.step) && !['salir', 'borrame', 'ayuda'].includes(raw) ? null : raw;
  if (cmd === 'salir') {
    await say(ctx, person, T.optOut(), 'opt_out');
    await s.setOptOut(person, true);
    return { handled: true, reason: 'opt_out' };
  }
  if (person.optedOut) { await s.setOptOut(person, false); person.optedOut = false; }

  if (cmd === 'borrame') {
    await say(ctx, person, T.erased(), 'erased');
    await s.erasePerson(person);
    await idle(ctx, person);
    return { handled: true, reason: 'erased' };
  }
  if (cmd === 'ayuda') {
    await say(ctx, person, T.help(), 'help');
    if (player.step_data?.prompt && player.step !== 'idle') await say(ctx, person, String(player.step_data.prompt), 'reprompt');
    return { handled: true, reason: 'help' };
  }
  if (cmd === 'pausa') {
    await s.savePlayer(person.pseudonymId, { paused_until: R.local(ctx.now).date });
    await say(ctx, person, T.paused(), 'paused');
    return { handled: true, reason: 'paused' };
  }
  if (cmd === 'vuelvo') {
    for (const mm of await s.memberships(person.pseudonymId)) if (mm.status === 'dormant') await s.updateMember(mm.id, { status: 'active', missed: 0 });
    await s.savePlayer(person.pseudonymId, { paused_until: null });
    await say(ctx, person, T.back(), 'back');
    await idle(ctx, person);
    await advance(ctx, person);
    return { handled: true, reason: 'back' };
  }
  if (cmd === 'tabla') { await sendTables(ctx, person); return { handled: true, reason: 'table' }; }
  if (cmd === 'otra') return restartSeason(ctx, person);

  // Un código de grupo cuenta si viene con # (el link lo trae) o si la persona no estaba en medio de algo.
  const code = m.audio ? null : R.findCode(m.text);
  if (code && (m.text.includes('#') || player.step === 'idle')) return join(ctx, person, code);
  if (cmd === 'nuevo' && !['f_name', 'f_me'].includes(player.step)) return startFounder(ctx, person);

  return onStep(ctx, person, player, m, cmd);
}

async function onStep(ctx: Ctx, p: Person, player: Player, m: Inbound, cmd: R.Command | null): Promise<{ handled: boolean; reason?: string }> {
  const s = ctx.store;
  const d = player.step_data ?? {};
  const text = m.text ?? '';
  const stale = TASK_STEPS.includes(player.step) && player.step !== 'rate' && !(await roundIsOpen(ctx, player.step_round_id));

  if (m.audio && player.step !== 'voice') {
    await say(ctx, p, T.voiceOutOfTurn(), 'voice_out_of_turn');
    if (d.prompt) await say(ctx, p, String(d.prompt), 'reprompt');
    return { handled: true, reason: 'audio_out_of_turn' };
  }

  switch (stale ? 'idle' : player.step) {
    case 'f_name': {
      const name = R.cleanName(text, 40);
      if (!name) { await say(ctx, p, T.badName(), 'bad'); return { handled: true }; }
      await setStep(ctx, p, 'f_me', { data: { groupName: name }, prompt: T.askMe(name) });
      return { handled: true };
    }
    case 'f_me': {
      const me = R.cleanName(text, 30);
      if (!me) { await say(ctx, p, T.badName(), 'bad'); return { handled: true }; }
      const g = await s.createGroup({ name: String(d.groupName), founderPseudonymId: p.pseudonymId, test: ctx.test });
      await s.addMember({ groupId: g.id, name: me, pseudonymId: p.pseudonymId, status: 'active' });
      await s.touchNode(p, { nickname: me });
      await offerPick(ctx, p, { mode: 'founder', group: g, exclude: [] });
      return { handled: true, reason: 'group_created' };
    }
    case 'pick': {
      const ids = (d.suggestions ?? []) as string[];
      if (cmd === 'ideas') {
        const g = await s.group(String(d.groupId));
        if (g) await offerPick(ctx, p, { mode: d.mode, group: g, round: d.roundId ?? null, exclude: [...ids, ...((d.seen ?? []) as string[])] });
        return { handled: true };
      }
      const i = R.parseIndex(text, ids.length);
      if (i !== null) {
        const q = await s.question(ids[i]);
        if (q) { await s.bumpQuestion(q.id, 'picked'); return chosen(ctx, p, d, q, false); }
      }
      const prompt = R.cleanName(text, 280);
      if (prompt.length >= 12 && !/^\d+$/.test(prompt)) {
        await setStep(ctx, p, 'custom_a', { group: player.step_group_id, data: { ...d, prompt: undefined, own: prompt }, prompt: T.askOptionA() });
        return { handled: true };
      }
      if (d.prompt) await say(ctx, p, String(d.prompt), 'reprompt');
      return { handled: true };
    }
    case 'custom_a': {
      if (text.trim().length > 40) { await say(ctx, p, T.tooLong(40), 'bad'); return { handled: true }; }
      const a = R.cleanName(text, 40);
      if (!a) { await say(ctx, p, T.askOptionA(), 'bad'); return { handled: true }; }
      await setStep(ctx, p, 'custom_b', { data: { ...d, prompt: undefined, a }, prompt: T.askOptionB() });
      return { handled: true };
    }
    case 'custom_b': {
      if (text.trim().length > 40) { await say(ctx, p, T.tooLong(40), 'bad'); return { handled: true }; }
      const b = R.cleanName(text, 40);
      if (!b) { await say(ctx, p, T.askOptionB(), 'bad'); return { handled: true }; }
      const q = await s.createQuestion({ prompt: String(d.own), detail: null, option_a: String(d.a), option_b: b, authorPseudonymId: p.pseudonymId });
      return chosen(ctx, p, d, q, true);
    }
    case 'victim': {
      const ids = (d.options ?? []) as string[];
      const r = await s.round(String(player.step_round_id));
      const g = r ? await s.group(r.group_id) : null;
      if (!r || !g) { await idle(ctx, p); return { handled: true }; }
      if (cmd !== 'no') {
        const i = R.parseIndex(text, ids.length);
        if (i === null) { if (d.prompt) await say(ctx, p, String(d.prompt), 'reprompt'); return { handled: true }; }
        await s.updateRound(r.id, { victim_member_id: ids[i] });
      }
      await say(ctx, p, T.authorReady(g.open_hour), 'author_ready');
      await idle(ctx, p);
      await advance(ctx, p);
      return { handled: true };
    }
    case 'f_roster': {
      const g = await s.group(String(player.step_group_id));
      if (!g) { await idle(ctx, p); return { handled: true }; }
      const ms = await s.members(g.id);
      const taken = new Set(ms.map((x) => R.canonical(x.roster_name)));
      const names = R.parseRoster(text).filter((n) => !taken.has(R.canonical(n))).slice(0, MAX_MEMBERS - ms.length);
      if (names.length === 0) { await say(ctx, p, T.rosterEmpty(), 'bad'); return { handled: true }; }
      for (const n of names) await s.addMember({ groupId: g.id, name: n, pseudonymId: null, status: 'listed' });
      await idle(ctx, p);
      await advance(ctx, p);
      return { handled: true, reason: 'roster' };
    }
    case 'j_who': return claimSeat(ctx, p, player, text);
    case 'answer': return onAnswer(ctx, p, player, text);
    case 'bet': return onBet(ctx, p, player, text);
    case 'voice': return onVoice(ctx, p, player, m, cmd);
    case 'rate': return onRate(ctx, p, player, cmd);
    case 'age': {
      const age = R.parseAge(text);
      if (age === null) { await say(ctx, p, T.badAge(), 'bad'); return { handled: true }; }
      await s.observe({
        pseudonym_id: p.pseudonymId, instrument_type: 'amigos_onboarding', instrument_id: 'age', kind: 'declared',
        value: { age }, value_number: age, observed_at: ctx.now.toISOString(), context: { test: ctx.test },
        idempotency_key: `amigos:age:${p.pseudonymId}`,
      });
      if (age < 18) {
        await say(ctx, p, T.minor(), 'minor');
        for (const mm of await s.memberships(p.pseudonymId)) await s.updateMember(mm.id, { status: 'left' });
        await s.savePlayer(p.pseudonymId, { declared_age: age, blocked_reason: 'minor', step: 'idle', step_data: {} });
        await s.setOptOut(p, true);
        return { handled: true, reason: 'minor' };
      }
      await s.savePlayer(p.pseudonymId, { declared_age: age });
      await say(ctx, p, T.ageThanks(), 'age');
      await idle(ctx, p);
      await advance(ctx, p);
      return { handled: true };
    }
    default: {
      const mine = (await s.memberships(p.pseudonymId)).filter((x) => x.status !== 'left');
      if (mine.length === 0) return startFounder(ctx, p);
      if (stale) await idle(ctx, p);
      if (await advance(ctx, p)) return { handled: true };
      const g = await s.group(mine[0].group_id);
      await say(ctx, p, T.idle(g?.open_hour ?? 21), 'idle');
      return { handled: true, reason: 'idle' };
    }
  }
}

async function roundIsOpen(ctx: Ctx, roundId: string | null) {
  if (!roundId) return false;
  const r = await ctx.store.round(roundId);
  return r?.status === 'open';
}

// ---------- Armar un grupo ----------
async function startFounder(ctx: Ctx, p: Person) {
  await ctx.store.grantConsent(p, 'research_use', 'amigos_welcome');
  await setStep(ctx, p, 'f_name', { prompt: T.intro() });
  return { handled: true, reason: 'founder_start' };
}

async function offerPick(ctx: Ctx, p: Person, o: { mode: 'founder' | 'author'; group: Group; round?: string | null; exclude: string[] }) {
  const s = ctx.store;
  const used = await s.usedQuestionIds(o.group.id);
  const qs = await s.suggestions(3, [...used, ...o.exclude], o.mode === 'founder' ? 'apertura' : undefined);
  for (const q of qs) await s.bumpQuestion(q.id, 'offered');
  const lines = qs.map((q) => `${q.prompt}${q.detail ? ` ${q.detail}` : ''} (${q.option_a} / ${q.option_b})`);
  const prompt = o.mode === 'founder' ? T.pick(lines) : T.authorTurn(lines, o.group.open_hour);
  await setStep(ctx, p, 'pick', {
    group: o.group.id, round: o.round ?? null,
    data: { mode: o.mode, groupId: o.group.id, roundId: o.round ?? null, suggestions: qs.map((q) => q.id), seen: o.exclude },
    prompt,
  });
}

async function chosen(ctx: Ctx, p: Person, d: Record<string, any>, q: Question, own: boolean) {
  const s = ctx.store;
  const g = await s.group(String(d.groupId));
  if (!g) { await idle(ctx, p); return { handled: true }; }
  const ms = await s.members(g.id);
  const me = ms.find((x) => x.pseudonym_id === p.pseudonymId) ?? null;
  await s.observe({
    pseudonym_id: p.pseudonymId, instrument_type: 'amigos_authoring', instrument_id: q.id, kind: 'text',
    stimulus: { mode: d.mode, offered: d.suggestions ?? [] },
    value: { prompt: q.prompt, option_a: q.option_a, option_b: q.option_b, source: own ? 'own' : 'library', question_id: q.id },
    value_text: q.prompt, observed_at: ctx.now.toISOString(),
    context: { group_id: g.id, group_number: g.number, mode: d.mode, test: g.test || ctx.test },
    idempotency_key: `amigos:authoring:${g.id}:${d.roundId ?? 'onboarding'}:${p.pseudonymId}`,
  });

  if (d.mode === 'founder') {
    await s.createRound({
      group_id: g.id, season: g.season, day: 1, local_date: R.local(ctx.now).date, question_id: q.id,
      author_member_id: me?.id ?? null, victim_member_id: null, status: 'open',
      opened_at: ctx.now.toISOString(), reveal_at: R.revealAtFor(ctx.now, g.reveal_hour).toISOString(), targets: {},
    });
    await idle(ctx, p);
    await advance(ctx, p);
    return { handled: true, reason: 'round1_open' };
  }

  const r = await s.round(String(d.roundId));
  if (!r || r.status !== 'drafting') { await idle(ctx, p); await advance(ctx, p); return { handled: true }; }
  await s.updateRound(r.id, { question_id: q.id });
  const others = active(ms).filter((x) => x.id !== me?.id);
  if (others.length >= 2) {
    await setStep(ctx, p, 'victim', { group: g.id, round: r.id, data: { options: others.map((x) => x.id) }, prompt: T.askVictim(others.map((x) => x.roster_name)) });
  } else {
    await say(ctx, p, T.authorReady(g.open_hour), 'author_ready');
    await idle(ctx, p);
  }
  return { handled: true, reason: 'authored' };
}

// ---------- Entrar a un grupo ----------
async function join(ctx: Ctx, p: Person, code: string) {
  const s = ctx.store;
  const g = await s.groupByCode(code);
  if (!g) { await say(ctx, p, T.noGroup(), 'join_fail'); return { handled: true, reason: 'no_group' }; }
  if (g.status === 'finished') { await say(ctx, p, T.groupOver(g.name), 'join_fail'); return { handled: true, reason: 'finished' }; }
  const ms = await s.members(g.id);
  const mine = ms.find((x) => x.pseudonym_id === p.pseudonymId);
  if (mine && mine.status !== 'left') {
    await say(ctx, p, T.alreadyIn(g.name), 'join');
    if (mine.status === 'dormant') await s.updateMember(mine.id, { status: 'active', missed: 0 });
    await idle(ctx, p);
    await advance(ctx, p);
    return { handled: true, reason: 'already_in' };
  }
  await s.grantConsent(p, 'research_use', 'amigos_welcome', g.id);
  const founder = await founderOf(ctx, g, ms);
  const fname = founder?.roster_name ?? 'Alguien';
  await say(ctx, p, T.welcome(fname, g.name), 'welcome');
  const listed = R.byPosition(ms.filter((x) => x.status === 'listed'));
  const prompt = listed.length ? T.whoAreYou(fname, listed.map((x) => x.roster_name)) : T.askJoinName();
  await setStep(ctx, p, 'j_who', { group: g.id, data: { options: listed.map((x) => x.id) }, prompt });
  return { handled: true, reason: 'join' };
}

async function claimSeat(ctx: Ctx, p: Person, player: Player, text: string) {
  const s = ctx.store;
  const g = await s.group(String(player.step_group_id));
  if (!g) { await idle(ctx, p); return { handled: true }; }
  const ms = await s.members(g.id);
  const i = R.parseIndex(text, (player.step_data?.options ?? []).length);
  let seat: Member | null = i !== null ? ms.find((x) => x.id === (player.step_data.options as string[])[i] && x.status === 'listed') ?? null : null;
  if (!seat) {
    const name = R.cleanName(text, 30);
    if (!name || /^\d+$/.test(name)) { if (player.step_data?.prompt) await say(ctx, p, String(player.step_data.prompt), 'reprompt'); return { handled: true }; }
    const same = ms.find((x) => R.canonical(x.roster_name) === R.canonical(name) && x.status !== 'left');
    if (same && same.status === 'listed') seat = same;
    else if (same) { await say(ctx, p, T.nameTaken(name), 'bad'); return { handled: true }; }
    else {
      if (ms.filter((x) => x.status !== 'left').length >= MAX_MEMBERS) { await say(ctx, p, T.groupFull(), 'full'); await idle(ctx, p); return { handled: true }; }
      seat = await s.addMember({ groupId: g.id, name, pseudonymId: p.pseudonymId, status: 'active' });
    }
  }
  if (seat.status === 'listed') await s.updateMember(seat.id, { pseudonym_id: p.pseudonymId, status: 'active', joined_at: ctx.now.toISOString() });
  const founder = await founderOf(ctx, g, ms);
  await s.touchNode(p, { nickname: seat.roster_name, referredBy: founder?.pseudonym_id ?? null });
  await idle(ctx, p);
  await advance(ctx, p);
  return { handled: true, reason: 'joined' };
}

// ---------- Jugar ----------
async function loadRound(ctx: Ctx, roundId: string | null) {
  if (!roundId) return null;
  const r = await ctx.store.round(roundId);
  if (!r || !r.question_id) return null;
  const [g, q] = await Promise.all([ctx.store.group(r.group_id), ctx.store.question(r.question_id)]);
  if (!g || !q) return null;
  const ms = await ctx.store.members(g.id);
  return { r, g, q, ms };
}

async function onAnswer(ctx: Ctx, p: Person, player: Player, text: string) {
  const s = ctx.store;
  const L = await loadRound(ctx, player.step_round_id);
  if (!L || L.r.status !== 'open') { await say(ctx, p, T.tooLate(), 'late'); await idle(ctx, p); await advance(ctx, p); return { handled: true }; }
  const { r, g, q, ms } = L;
  const choice = R.parseChoice(text, q.option_a, q.option_b);
  if (!choice) { await say(ctx, p, T.badChoice(q), 'bad'); return { handled: true }; }
  const me = ms.find((x) => x.pseudonym_id === p.pseudonymId);
  if (!me) { await idle(ctx, p); return { handled: true }; }
  const latency = player.prompted_at ? Math.max(0, ctx.now.getTime() - Date.parse(player.prompted_at)) : null;
  const saved = await s.saveAnswer({ round_id: r.id, member_id: me.id, choice, latency_ms: latency, answered_at: ctx.now.toISOString() });
  if (saved) {
    await s.observe({
      pseudonym_id: p.pseudonymId, instrument_type: 'amigos_question', instrument_id: q.id, stimulus_id: q.id, stimulus: stimulus(q),
      kind: 'choice', value: { choice, label: label(q, choice) }, value_text: label(q, choice), latency_ms: latency,
      observed_at: ctx.now.toISOString(), session_id: r.id, position: r.day, study_id: q.study_id, subthesis_id: q.subthesis_id,
      context: { ...obsContext(ctx, g, r, q, me), group_size: active(ms).length },
      idempotency_key: `amigos:answer:${r.id}:${me.id}`,
    });
  }
  // El primer día, cada amigo ve en el acto si el fundador lo leyó.
  if (R.isOnboarding(r) && me.pseudonym_id !== g.founder_pseudonym_id) {
    const founder = await founderOf(ctx, g, ms);
    const bet = (await s.bets(r.id)).find((b) => b.target_member_id === me.id && b.bettor_member_id === founder?.id);
    const fname = founder?.roster_name ?? 'Quien te invitó';
    await say(ctx, p, bet ? T.instant(fname, label(q, bet.guess), label(q, choice)) : T.instantNoBet(fname), 'instant');
  }
  await idle(ctx, p);
  await advance(ctx, p);
  return { handled: true, reason: 'answered' };
}

async function onBet(ctx: Ctx, p: Person, player: Player, text: string) {
  const s = ctx.store;
  const L = await loadRound(ctx, player.step_round_id);
  if (!L || L.r.status !== 'open') { await idle(ctx, p); await advance(ctx, p); return { handled: true }; }
  const { r, q, ms } = L;
  const guess = R.parseChoice(text, q.option_a, q.option_b);
  if (!guess) { await say(ctx, p, T.badChoice(q), 'bad'); return { handled: true }; }
  const me = ms.find((x) => x.pseudonym_id === p.pseudonymId);
  const target = String(player.step_data?.target ?? '');
  if (me && target && ms.some((x) => x.id === target)) await s.saveBet({ round_id: r.id, bettor_member_id: me.id, target_member_id: target, guess, correct: null });
  await idle(ctx, p);
  await advance(ctx, p);
  return { handled: true, reason: 'bet' };
}

async function onVoice(ctx: Ctx, p: Person, player: Player, m: Inbound, cmd: R.Command | null) {
  const s = ctx.store;
  const L = await loadRound(ctx, player.step_round_id);
  if (!L || L.r.status !== 'open') { await idle(ctx, p); await advance(ctx, p); return { handled: true }; }
  const { r, g, q, ms } = L;
  const me = ms.find((x) => x.pseudonym_id === p.pseudonymId);
  const to = ms.find((x) => x.id === String(player.step_data?.to ?? ''));
  if (!me || !to) { await idle(ctx, p); await advance(ctx, p); return { handled: true }; }
  const base = { round_id: r.id, from_member_id: me.id, to_member_id: to.id };
  const ctxObs = { ...obsContext(ctx, g, r, q, me), to_pseudonym: to.pseudonym_id };

  if (m.audio) {
    const ext = /mp4|m4a|aac/.test(m.audio.mime) ? 'm4a' : /mpeg|mp3/.test(m.audio.mime) ? 'mp3' : 'ogg';
    const path = `${g.id}/${r.id}/${me.id}.${ext}`;
    await s.uploadAudio(path, m.audio.data, m.audio.mime);
    let transcript: string | null = null;
    try { transcript = ctx.transcribe ? await ctx.transcribe(m.audio.data, m.audio.mime) : null; } catch { transcript = null; }
    await s.saveVoice({ ...base, audio_path: path, mime: m.audio.mime, duration_s: m.audio.seconds, transcript, skipped: false });
    await s.grantConsent(p, 'voice_recording', 'amigos_voice', r.id);
    await s.observe({
      pseudonym_id: p.pseudonymId, instrument_type: 'amigos_voice', instrument_id: q.id, stimulus_id: q.id, stimulus: stimulus(q),
      kind: 'voice', value: { audio_path: path, duration_s: m.audio.seconds, transcript, to_pseudonym: to.pseudonym_id },
      value_text: transcript, observed_at: ctx.now.toISOString(), session_id: r.id, position: r.day,
      study_id: q.study_id, subthesis_id: q.subthesis_id, context: ctxObs, idempotency_key: `amigos:voice:${r.id}:${me.id}`,
    });
    await say(ctx, p, T.voiceSaved(to.roster_name, g.reveal_hour), 'voice_saved');
  } else if (cmd === 'saltear' || cmd === 'no') {
    await s.saveVoice({ ...base, audio_path: null, mime: null, duration_s: null, transcript: null, skipped: true });
    await say(ctx, p, T.voiceSkipped(), 'voice_skipped');
  } else {
    const written = (m.text ?? '').trim().slice(0, 1000);
    if (written.length < 3) { if (player.step_data?.prompt) await say(ctx, p, String(player.step_data.prompt), 'reprompt'); return { handled: true }; }
    await s.saveVoice({ ...base, audio_path: null, mime: null, duration_s: null, transcript: written, skipped: false });
    await s.observe({
      pseudonym_id: p.pseudonymId, instrument_type: 'amigos_voice', instrument_id: q.id, stimulus_id: q.id, stimulus: stimulus(q),
      kind: 'text', value: { transcript: written, to_pseudonym: to.pseudonym_id, written: true }, value_text: written,
      observed_at: ctx.now.toISOString(), session_id: r.id, position: r.day, study_id: q.study_id, subthesis_id: q.subthesis_id,
      context: ctxObs, idempotency_key: `amigos:voice:${r.id}:${me.id}`,
    });
    await say(ctx, p, T.voiceWritten(to.roster_name), 'voice_written');
  }
  await idle(ctx, p);
  await advance(ctx, p);
  return { handled: true, reason: 'voice' };
}

async function onRate(ctx: Ctx, p: Person, player: Player, cmd: R.Command | null) {
  const s = ctx.store;
  if (cmd !== 'si' && cmd !== 'no') { await say(ctx, p, T.rateBad(), 'bad'); return { handled: true }; }
  const voiceId = String(player.step_data?.voice ?? '');
  const roundId = String(player.step_round_id ?? '');
  const v = (await s.voices(roundId)).find((x) => x.id === voiceId);
  if (!v || v.rating) { await idle(ctx, p); await advance(ctx, p); return { handled: true }; }
  const read = cmd === 'si';
  await s.updateVoice(v.id, { rating: read ? 'read' : 'not_read', rated_at: ctx.now.toISOString() });
  if (read) await s.addPoints([{ round_id: v.round_id, member_id: v.from_member_id, reason: 'voice_read', points: R.POINTS.voiceRead }]);
  const r = await s.round(v.round_id);
  const ms = r ? await s.members(r.group_id) : [];
  const from = ms.find((x) => x.id === v.from_member_id);
  const meName = nameOf(ms, v.to_member_id);
  await s.observe({
    pseudonym_id: p.pseudonymId, instrument_type: 'amigos_rating', instrument_id: r?.question_id ?? 'unknown', kind: 'game_move',
    value: { rating: read ? 'read' : 'not_read', from_pseudonym: from?.pseudonym_id ?? null, voice_id: v.id },
    value_text: read ? 'read' : 'not_read', observed_at: ctx.now.toISOString(), session_id: v.round_id, position: r?.day ?? null,
    context: { group_id: r?.group_id, test: ctx.test }, idempotency_key: `amigos:rating:${v.id}`,
  });
  await say(ctx, p, T.rated(read), 'rated');
  if (from?.pseudonym_id) {
    const fp = await s.personByPseudonym(from.pseudonym_id);
    if (fp) await say(ctx, fp, T.ratedNotice(meName, read), 'rated_notice');
  }
  await idle(ctx, p);
  await advance(ctx, p);
  return { handled: true, reason: 'rated' };
}

// =====================================================================
// Qué le toca a cada uno ahora
// =====================================================================
type Task =
  | { kind: 'rate'; voice: Voice }
  | { kind: 'author'; group: Group; round: Round }
  | { kind: 'answer'; group: Group; round: Round; q: Question; ms: Member[] }
  | { kind: 'roster'; group: Group }
  | { kind: 'bet'; group: Group; round: Round; q: Question; ms: Member[]; target: string; first: boolean }
  | { kind: 'voice'; group: Group; round: Round; ms: Member[]; to: string }
  | { kind: 'share'; group: Group; round: Round; q: Question; ms: Member[] }
  | { kind: 'age' };

async function nextTask(ctx: Ctx, p: Person, player: Player): Promise<Task | null> {
  const s = ctx.store;
  const mine = (await s.memberships(p.pseudonymId)).filter((m) => m.status === 'active');
  const today = R.local(ctx.now).date;
  const paused = Boolean(player.paused_until && player.paused_until >= today);

  const pend = await s.pendingRatings(mine.map((m) => m.id));
  if (pend.length && !paused) return { kind: 'rate', voice: pend[0] };

  let answeredSomewhere = false;
  for (const me of mine) {
    const g = await s.group(me.group_id);
    if (!g || g.status === 'finished' || g.status === 'paused') continue;
    const r = await currentRound(ctx, g);
    if (!r) continue;
    if (r.status === 'drafting' && r.author_member_id === me.id && !r.question_id) return { kind: 'author', group: g, round: r };
    if (r.status !== 'open' || !r.question_id) continue;
    if (paused && !R.isOnboarding(r)) continue;
    const [q, ms, answers] = await Promise.all([s.question(r.question_id), s.members(g.id), s.answers(r.id)]);
    if (!q) continue;
    if (!answers.some((a) => a.member_id === me.id)) return { kind: 'answer', group: g, round: r, q, ms };
    answeredSomewhere = true;
    const founder = ms.find((x) => x.pseudonym_id === g.founder_pseudonym_id) ?? null;
    if (g.status === 'setup' && founder?.id === me.id && ms.filter((x) => x.status !== 'left').length === 1) return { kind: 'roster', group: g };
    const bets = await s.bets(r.id);
    const targets = R.betTargets({ onboarding: R.isOnboarding(r), me, founderMemberId: founder?.id ?? null, members: ms, victimId: r.victim_member_id });
    const missing = targets.filter((t) => !bets.some((b) => b.bettor_member_id === me.id && b.target_member_id === t));
    if (missing.length) return { kind: 'bet', group: g, round: r, q, ms, target: missing[0], first: missing.length === targets.length };
    const to = r.targets?.[me.id];
    if (to && !R.isOnboarding(r) && ms.find((x) => x.id === to)?.status === 'active') {
      const vs = await s.voices(r.id);
      if (!vs.some((v) => v.from_member_id === me.id)) return { kind: 'voice', group: g, round: r, ms, to };
    }
    if (g.status === 'setup' && founder?.id === me.id) return { kind: 'share', group: g, round: r, q, ms };
  }
  if (player.declared_age === null && answeredSomewhere) return { kind: 'age' };
  return null;
}

/** Le manda a la persona lo próximo que tiene que hacer. Devuelve si había algo. */
export async function advance(ctx: Ctx, p: Person, opts: { onlyIfIdle?: boolean } = {}): Promise<boolean> {
  const s = ctx.store;
  let any = false;
  for (let guard = 0; guard < 4; guard++) {
    const player = await s.player(p.pseudonymId);
    if (player.blocked_reason || p.optedOut) return any;
    if (player.step !== 'idle') {
      const stale = TASK_STEPS.includes(player.step) && player.step !== 'rate' && !(await roundIsOpen(ctx, player.step_round_id));
      if (!stale && (opts.onlyIfIdle || guard === 0)) return any;
    }
    const t = await nextTask(ctx, p, player);
    if (!t) { if (player.step !== 'idle') await idle(ctx, p); return any; }
    any = true;
    const cont = await prompt(ctx, p, t);
    if (!cont) return true;
  }
  return any;
}

/** Pregunta lo que toca. Devuelve true si no queda esperando respuesta (se puede seguir con lo próximo). */
async function prompt(ctx: Ctx, p: Person, t: Task): Promise<boolean> {
  const s = ctx.store;
  switch (t.kind) {
    case 'rate': {
      const r = await s.round(t.voice.round_id);
      const ms = r ? await s.members(r.group_id) : [];
      const from = nameOf(ms, t.voice.from_member_id);
      if (t.voice.audio_path) {
        const url = await s.audioUrl(t.voice.audio_path);
        await say(ctx, p, T.rateAudioIntro(from), 'rate_intro');
        if (url && !p.optedOut) await s.send(p, { audioUrl: url }, 'amigos_rate_audio');
      } else {
        await say(ctx, p, T.rateWritten(from, t.voice.transcript ?? ''), 'rate_intro');
      }
      await setStep(ctx, p, 'rate', { round: t.voice.round_id, data: { voice: t.voice.id }, prompt: T.rateAsk() });
      return false;
    }
    case 'author': {
      await offerPick(ctx, p, { mode: 'author', group: t.group, round: t.round.id, exclude: [] });
      return false;
    }
    case 'answer': {
      const by = byLine(t.group, t.round, t.ms);
      const victim = t.round.victim_member_id ? nameOf(t.ms, t.round.victim_member_id) : null;
      if (!p.optedOut) await s.send(p, { imageUrl: ctx.urls.question(t.q, { by }) }, 'amigos_question_image');
      await setStep(ctx, p, 'answer', { group: t.group.id, round: t.round.id, prompt: T.question(t.q, by, victim) });
      return false;
    }
    case 'roster': {
      await setStep(ctx, p, 'f_roster', { group: t.group.id, prompt: T.askRoster() });
      return false;
    }
    case 'bet': {
      const text = (t.first ? `${T.betsIntro()}\n\n` : '') + T.bet(nameOf(t.ms, t.target), t.q);
      await setStep(ctx, p, 'bet', { group: t.group.id, round: t.round.id, data: { target: t.target }, prompt: text });
      return false;
    }
    case 'voice': {
      const nudge = NUDGES[(t.round.day - 1) % NUDGES.length];
      await setStep(ctx, p, 'voice', { group: t.group.id, round: t.round.id, data: { to: t.to }, prompt: T.voice(nameOf(t.ms, t.to), nudge, t.group.reveal_hour) });
      return false;
    }
    case 'share': {
      const founder = t.ms.find((x) => x.pseudonym_id === t.group.founder_pseudonym_id)?.roster_name ?? 'vos';
      await s.updateGroup(t.group.id, { status: 'active' });
      await say(ctx, p, T.share(founder), 'share_intro');
      await show(ctx, p, ctx.urls.question(t.q, { by: `Pregunta de ${founder} · ${t.group.name}`, teaser: `${founder} ya apostó lo que vas a contestar.` }),
        T.shareText(founder, joinLink(ctx, t.group)), 'share');
      await say(ctx, p, T.shareAfter(t.group.reveal_hour), 'share_after');
      await idle(ctx, p);
      return true;
    }
    case 'age': {
      await setStep(ctx, p, 'age', { prompt: T.askAge() });
      return false;
    }
  }
}

// =====================================================================
// El reloj: abre, recuerda, revela, arranca el día siguiente
// =====================================================================
export async function tick(ctx: Ctx) {
  const out: { group: string; did: string }[] = [];
  for (const g of await ctx.store.groupsToTick()) {
    try {
      const did = await tickGroup(ctx, g);
      if (did) out.push({ group: g.name, did });
    } catch (e) {
      console.error('amigos tick', g.id, e);
      out.push({ group: g.name, did: 'error' });
    }
  }
  return out;
}

export async function tickGroup(ctx: Ctx, g: Group): Promise<string | null> {
  const s = ctx.store;
  const now = ctx.now;
  const L = R.local(now);
  const r = await currentRound(ctx, g);

  if (!r) {
    // Temporada nueva sin rondas: arranca a la hora del turno.
    if (g.status === 'active' && L.hour >= g.turn_hour && L.hour < g.open_hour) { await startDay(ctx, g, 1, L.date); return 'start_day'; }
    return null;
  }
  if (r.status === 'open') {
    const answers = await s.answers(r.id);
    if (await everyoneDone(ctx, g, r, answers)) { await reveal(ctx, g, r); return 'reveal_all_done'; }
    if (r.reveal_at && now.getTime() >= Date.parse(r.reveal_at)) {
      if (answers.length >= 2) { await reveal(ctx, g, r); return 'reveal'; }
      if (R.isOnboarding(r)) { await s.updateRound(r.id, { reveal_at: new Date(Date.parse(r.reveal_at) + 864e5).toISOString() }); return 'wait_friends'; }
      await s.updateRound(r.id, { status: 'skipped', revealed_at: now.toISOString() });
      return 'skipped';
    }
    await maybeRemind(ctx, g, r, answers);
    return null;
  }
  if (r.status === 'drafting') {
    if (now.getTime() >= R.atLocal(r.local_date, g.open_hour).getTime()) { await openRound(ctx, g, r); return 'open'; }
    return null;
  }
  if (g.status === 'setup' || g.status === 'finished' || g.status === 'paused') return null;
  if (r.day >= g.season_days) { await finishSeason(ctx, g); return 'season_over'; }
  const base = r.revealed_at ? R.local(new Date(r.revealed_at)).date : r.local_date;
  const next = R.addDays(base, 1);
  if (L.date < next || L.hour < g.turn_hour || L.hour >= g.open_hour + 2) return null;
  await startDay(ctx, g, r.day + 1, L.date);
  return 'start_day';
}

async function everyoneDone(ctx: Ctx, g: Group, r: Round, answers: Answer[]) {
  const s = ctx.store;
  const ms = await s.members(g.id);
  if (ms.some((x) => x.status === 'listed')) return false;
  const act = active(ms);
  if (act.length < 2) return false;
  if (!act.every((m) => answers.some((a) => a.member_id === m.id))) return false;
  const bets = await s.bets(r.id);
  const founder = ms.find((x) => x.pseudonym_id === g.founder_pseudonym_id) ?? null;
  for (const me of act) {
    const targets = R.betTargets({ onboarding: R.isOnboarding(r), me, founderMemberId: founder?.id ?? null, members: ms, victimId: r.victim_member_id });
    if (targets.some((t) => !bets.some((b) => b.bettor_member_id === me.id && b.target_member_id === t))) return false;
  }
  if (!R.isOnboarding(r)) {
    const vs = await s.voices(r.id);
    if (act.some((m) => r.targets?.[m.id] && !vs.some((v) => v.from_member_id === m.id))) return false;
  }
  return true;
}

async function startDay(ctx: Ctx, g: Group, day: number, date: string) {
  const s = ctx.store;
  const ms = await s.members(g.id);
  const act = active(ms);
  if (act.length < 2) return;
  const national = await s.nationalFor(date);
  if (national) {
    await s.createRound({ group_id: g.id, season: g.season, day, local_date: date, question_id: national.id, author_member_id: null, victim_member_id: null, status: 'drafting' });
    return;
  }
  const author = R.authorFor(act, day, g.season);
  await s.createRound({ group_id: g.id, season: g.season, day, local_date: date, question_id: null, author_member_id: author?.id ?? null, victim_member_id: null, status: 'drafting' });
  if (author?.pseudonym_id) {
    const ap = await s.personByPseudonym(author.pseudonym_id);
    if (ap) await advance(ctx, ap, { onlyIfIdle: true });
  }
}

export async function openRound(ctx: Ctx, g: Group, r: Round) {
  const s = ctx.store;
  const ms = await s.members(g.id);
  const patch: Partial<Round> = {};
  if (!r.question_id) {
    const used = await s.usedQuestionIds(g.id);
    const q = (await s.suggestions(1, used))[0] ?? (await s.suggestions(1, []))[0];
    if (!q) return;
    await s.bumpQuestion(q.id, 'picked');
    patch.question_id = q.id;
    patch.summary = { ...r.summary, auto_question: true };
    if (r.author_member_id) {
      const a = ms.find((x) => x.id === r.author_member_id);
      if (a?.pseudonym_id) {
        const ap = await s.personByPseudonym(a.pseudonym_id);
        if (ap) {
          await say(ctx, ap, T.authorMissed(a.roster_name), 'author_missed');
          const pl = await s.player(ap.pseudonymId);
          if (pl.step === 'pick' || pl.step === 'custom_a' || pl.step === 'custom_b' || pl.step === 'victim') await idle(ctx, ap);
        }
      }
      patch.author_member_id = null;
    }
  }
  const act = active(ms);
  patch.targets = R.assignTargets(act, r.day);
  patch.status = 'open';
  patch.opened_at = ctx.now.toISOString();
  patch.reveal_at = R.revealAtFor(ctx.now, g.reveal_hour).toISOString();
  await s.updateRound(r.id, patch);
  for (const m of act) {
    const p = await s.personByPseudonym(m.pseudonym_id!);
    if (p) await advance(ctx, p, { onlyIfIdle: true });
  }
}

async function maybeRemind(ctx: Ctx, g: Group, r: Round, answers: Answer[]) {
  const s = ctx.store;
  if (r.summary?.reminded || !r.opened_at || R.isOnboarding(r)) return;
  if (ctx.now.getTime() < Date.parse(r.opened_at) + 90 * 60_000) return;
  const ms = await s.members(g.id);
  const today = R.local(ctx.now).date;
  for (const m of active(ms)) {
    if (answers.some((a) => a.member_id === m.id)) continue;
    const p = await s.personByPseudonym(m.pseudonym_id!);
    if (!p) continue;
    const pl = await s.player(p.pseudonymId);
    if (pl.paused_until && pl.paused_until >= today) continue;
    if (pl.step === 'answer' || pl.step === 'idle') await say(ctx, p, T.reminder(answers.length), 'reminder');
  }
  await s.updateRound(r.id, { summary: { ...r.summary, reminded: true } });
}

export async function reveal(ctx: Ctx, g: Group, r: Round) {
  const s = ctx.store;
  if (!r.question_id) return;
  const [q, ms, answers, bets, voices] = await Promise.all([s.question(r.question_id), s.members(g.id), s.answers(r.id), s.bets(r.id), s.voices(r.id)]);
  if (!q) return;
  const sc = R.scoreRound({ roundId: r.id, answers, bets, authorId: r.author_member_id, victimId: r.victim_member_id });
  await s.gradeBets(r.id, sc.graded);
  await s.addPoints(sc.rows);

  const byId = new Map(ms.map((m) => [m.id, m]));
  const choice = new Map(answers.map((a) => [a.member_id, a.choice]));
  for (const b of sc.graded) {
    const bettor = byId.get(b.bettor_member_id);
    const target = byId.get(b.target_member_id);
    if (!bettor?.pseudonym_id) continue;
    await s.observe({
      pseudonym_id: bettor.pseudonym_id, instrument_type: 'amigos_bet', instrument_id: q.id, stimulus_id: q.id, stimulus: stimulus(q),
      kind: 'game_move',
      value: { guess: b.guess, guess_label: label(q, b.guess), own_choice: choice.get(bettor.id) ?? null, target_pseudonym: target?.pseudonym_id ?? null,
        target_choice: choice.get(b.target_member_id) ?? null, correct: b.correct },
      value_text: label(q, b.guess), observed_at: ctx.now.toISOString(), session_id: r.id, position: r.day,
      study_id: q.study_id, subthesis_id: q.subthesis_id, context: { ...obsContext(ctx, g, r, q, bettor), group_size: active(ms).length },
      idempotency_key: `amigos:bet:${r.id}:${b.bettor_member_id}:${b.target_member_id}`,
    });
  }

  const shown = R.byPosition(ms.filter((m) => m.status === 'active' || choice.has(m.id)));
  const names = new Map(ms.map((m) => [m.id, m.roster_name]));
  const matrix: Record<string, Record<string, boolean | null>> = {};
  for (const b of sc.graded) (matrix[b.bettor_member_id] ??= {})[b.target_member_id] = b.correct;
  const summary = {
    ...r.summary,
    split: sc.split,
    members: shown.map((m) => ({ id: m.id, name: m.roster_name, choice: choice.get(m.id) ?? null })),
    matrix,
    lines: R.headlineLines({ names, graded: sc.graded, split: sc.split, optionA: q.option_a, optionB: q.option_b }),
    points: Object.fromEntries(sc.totals),
  };
  const revealed: Round = { ...r, status: 'revealed', revealed_at: ctx.now.toISOString(), summary };
  await s.updateRound(r.id, { status: 'revealed', revealed_at: revealed.revealed_at, summary });

  // Los que no contestan tres días seguidos quedan en pausa.
  for (const m of active(ms)) {
    if (choice.has(m.id)) { if (m.missed) await s.updateMember(m.id, { missed: 0 }); continue; }
    const missed = m.missed + 1;
    await s.updateMember(m.id, { missed, ...(missed >= 3 ? { status: 'dormant' as const } : {}) });
    if (missed >= 3) {
      const p = await s.personByPseudonym(m.pseudonym_id!);
      if (p) await say(ctx, p, T.dormant(g.name), 'dormant');
    }
  }

  const standings = (await s.standings(g.id, g.season)).filter((x) => byId.get(x.member_id)?.status === 'active')
    .sort((a, b) => b.points - a.points || a.position - b.position);
  const image = ctx.urls.reveal(revealed, g, q);
  const founderId = ms.find((x) => x.pseudonym_id === g.founder_pseudonym_id)?.id;
  for (const m of active(ms)) {
    if (m.missed >= 2 && !choice.has(m.id)) continue; // recién pausado
    const p = await s.personByPseudonym(m.pseudonym_id!);
    if (!p || p.optedOut) continue;
    await show(ctx, p, image, T.revealCaption(g.name, r.day, startLink(ctx)), 'reveal');
    const pos = standings.findIndex((x) => x.member_id === m.id) + 1;
    const total = standings.find((x) => x.member_id === m.id)?.points ?? 0;
    const extra = R.isOnboarding(r) && m.id === founderId ? `\n\n${T.revealShare()}` : '';
    await say(ctx, p, T.revealPersonal(sc.totals.get(m.id) ?? 0, pos || standings.length, standings.length, total) + extra, 'reveal_personal');
    for (const v of voices.filter((x) => x.to_member_id === m.id && !x.skipped && !x.delivered_at)) await s.updateVoice(v.id, { delivered_at: ctx.now.toISOString() });
    await advance(ctx, p, { onlyIfIdle: true });
  }
  if (r.day >= g.season_days) await finishSeason(ctx, g);
}

export async function finishSeason(ctx: Ctx, g: Group) {
  const s = ctx.store;
  const ms = await s.members(g.id);
  const rounds = (await s.rounds(g.id, g.season)).filter((r) => r.status === 'revealed');
  const stats = new Map<string, R.SeasonStat>();
  for (const m of active(ms)) stats.set(m.id, { member_id: m.id, reads_hit: 0, reads_total: 0, read_hit: 0, read_total: 0, voices: 0, answered: 0 });
  for (const r of rounds) {
    const [bets, voices, answers] = await Promise.all([s.bets(r.id), s.voices(r.id), s.answers(r.id)]);
    for (const b of bets) {
      if (b.correct === null) continue;
      const by = stats.get(b.bettor_member_id); if (by) { by.reads_total++; if (b.correct) by.reads_hit++; }
      const on = stats.get(b.target_member_id); if (on) { on.read_total++; if (b.correct) on.read_hit++; }
    }
    for (const v of voices) if (!v.skipped) { const st = stats.get(v.from_member_id); if (st) st.voices++; }
    for (const a of answers) { const st = stats.get(a.member_id); if (st) st.answered++; }
  }
  const labels = R.seasonLabels([...stats.values()]);
  const standings = (await s.standings(g.id, g.season)).sort((a, b) => b.points - a.points || a.position - b.position);
  const winner = standings.find((x) => stats.has(x.member_id))?.roster_name ?? '?';
  await s.updateGroup(g.id, { status: 'finished' });
  const done: Group = { ...g, status: 'finished' };
  for (const m of active(ms)) {
    const p = await s.personByPseudonym(m.pseudonym_id!);
    if (!p) continue;
    const st = stats.get(m.id)!;
    const stat = st.reads_total ? `${st.reads_hit} de ${st.reads_total} apuestas acertadas.` : `${st.answered} preguntas contestadas.`;
    await show(ctx, p, ctx.urls.label(done, m, labels.get(m.id) ?? R.LABELS.rest, stat), undefined, 'season_label');
    await show(ctx, p, ctx.urls.table(done), T.seasonOver(winner), 'season_table');
    if (m.pseudonym_id === g.founder_pseudonym_id) await say(ctx, p, T.seasonAgain(), 'season_again');
  }
}

async function restartSeason(ctx: Ctx, p: Person) {
  const s = ctx.store;
  const mine = await s.memberships(p.pseudonymId);
  for (const m of mine) {
    const g = await s.group(m.group_id);
    if (!g || g.status !== 'finished') continue;
    if (g.founder_pseudonym_id !== p.pseudonymId) { await say(ctx, p, T.notFounder(), 'not_founder'); return { handled: true, reason: 'not_founder' }; }
    await s.updateGroup(g.id, { status: 'active', season: g.season + 1 });
    for (const x of await s.members(g.id)) if (x.status === 'dormant' || x.missed) await s.updateMember(x.id, { status: x.status === 'dormant' ? 'active' : x.status, missed: 0 });
    for (const x of await s.members(g.id)) {
      if (x.status !== 'active' || !x.pseudonym_id) continue;
      const xp = await s.personByPseudonym(x.pseudonym_id);
      if (xp) await say(ctx, xp, T.seasonRestarted(g.name, g.turn_hour), 'season_restart');
    }
    return { handled: true, reason: 'season_restart' };
  }
  await say(ctx, p, T.noTable(), 'no_group');
  return { handled: true, reason: 'nothing_to_restart' };
}

async function sendTables(ctx: Ctx, p: Person) {
  const s = ctx.store;
  const mine = (await s.memberships(p.pseudonymId)).filter((m) => m.status === 'active' || m.status === 'dormant');
  if (mine.length === 0) { await say(ctx, p, T.noTable(), 'no_group'); return; }
  for (const m of mine) {
    const g = await s.group(m.group_id);
    if (!g) continue;
    const st = (await s.standings(g.id, g.season)).sort((a, b) => b.points - a.points || a.position - b.position);
    const text = `${g.name} · temporada ${g.season}\n\n${st.map((x, i) => `${i + 1}. ${x.roster_name} · ${x.points}`).join('\n')}`;
    await show(ctx, p, ctx.urls.table(g), text, 'table');
  }
}

// ---------- Acciones del panel (saltean el reloj, para probar o destrabar) ----------
export async function forceNextDay(ctx: Ctx, g: Group) {
  const r = await currentRound(ctx, g);
  if (r && (r.status === 'open' || r.status === 'drafting')) return 'La ronda de hoy sigue en juego.';
  if (r && r.day >= g.season_days) return 'La temporada ya terminó.';
  const act = active(await ctx.store.members(g.id));
  if (act.length < 2) return 'Hacen falta al menos dos jugadores activos.';
  await startDay(ctx, g, (r?.day ?? 0) + 1, R.local(ctx.now).date);
  return null;
}
