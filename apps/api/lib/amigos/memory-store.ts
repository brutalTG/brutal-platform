// Store en memoria: el juego entero sin base, para pruebas. Imita las reglas de la migración.
import type { Store } from './store.ts';
import type { Answer, Bet, Group, Inbound, Member, Observation, Outbound, Person, Player, PointRow, Question, Round, Standing, Voice } from './types.ts';
import { newGroupCode } from './rules.ts';

let seq = 0;
const id = (p: string) => `${p}-${(++seq).toString(36).padStart(4, '0')}`;

export type Sent = { phone: string; purpose: string } & Outbound;

export class MemoryStore implements Store {
  persons = new Map<string, Person & { nickname: string | null; referredBy: string | null }>();
  players = new Map<string, Player>();
  groupsM = new Map<string, Group>();
  membersM = new Map<string, Member>();
  roundsM = new Map<string, Round>();
  answersL: Answer[] = [];
  betsL: Bet[] = [];
  voicesL: Voice[] = [];
  pointsL: PointRow[] = [];
  questionsM = new Map<string, Question>();
  observations: Observation[] = [];
  consents: { pseudonymId: string; purpose: string }[] = [];
  seen = new Set<string>();
  sent: Sent[] = [];
  inbound: { phone: string; text: string }[] = [];
  audio = new Map<string, Uint8Array>();
  groupNumber = 0;

  constructor(questions: Partial<Question>[] = []) {
    for (const q of questions) {
      const full: Question = {
        id: id('q'), prompt: 'Pregunta', detail: null, option_a: 'A', option_b: 'B', origin: 'house', tone: 'fun',
        study_id: null, subthesis_id: null, tags: [], status: 'active', scheduled_for: null, offered: 0, picked: 0, ...q,
      };
      this.questionsM.set(full.id, full);
    }
  }

  async seenInbound(providerId: string) { if (this.seen.has(providerId)) return true; this.seen.add(providerId); return false; }
  async ensurePerson(phone: string) {
    const existing = this.persons.get(phone);
    if (existing) return existing;
    const p = { nodeId: id('n'), pseudonymId: id('p'), phone, contactId: id('c'), optedOut: false, nickname: null, referredBy: null };
    this.persons.set(phone, p);
    return p;
  }
  async personByPseudonym(pid: string) { return [...this.persons.values()].find((p) => p.pseudonymId === pid) ?? null; }
  async logInbound(p: Person, m: Inbound) { this.inbound.push({ phone: p.phone, text: m.text }); }
  async setOptOut(p: Person, out: boolean) { const x = this.persons.get(p.phone); if (x) x.optedOut = out; p.optedOut = out; }
  async grantConsent(p: Person, purpose: string) {
    if (!this.consents.some((c) => c.pseudonymId === p.pseudonymId && c.purpose === purpose)) this.consents.push({ pseudonymId: p.pseudonymId, purpose });
  }
  async touchNode(p: Person, patch: { nickname?: string | null; referredBy?: string | null }) {
    const x = this.persons.get(p.phone)!;
    if (patch.nickname && !x.nickname) x.nickname = patch.nickname;
    if (patch.referredBy && !x.referredBy) x.referredBy = patch.referredBy;
  }

  async player(pid: string) {
    let p = this.players.get(pid);
    if (!p) {
      p = { pseudonym_id: pid, step: 'idle', step_group_id: null, step_round_id: null, step_data: {}, prompted_at: null, declared_age: null, paused_until: null, blocked_reason: null };
      this.players.set(pid, p);
    }
    return structuredClone(p);
  }
  async savePlayer(pid: string, patch: Partial<Player>) { const p = await this.player(pid); this.players.set(pid, { ...p, ...patch }); }

  async createGroup(input: { name: string; founderPseudonymId: string; test: boolean }) {
    const g: Group = {
      id: id('g'), number: ++this.groupNumber, code: newGroupCode(), name: input.name, founder_pseudonym_id: input.founderPseudonymId,
      status: 'setup', season: 1, season_days: 14, turn_hour: 18, open_hour: 21, reveal_hour: 23, test: input.test, created_at: new Date().toISOString(),
    };
    this.groupsM.set(g.id, g);
    return { ...g };
  }
  async group(gid: string) { const g = this.groupsM.get(gid); return g ? { ...g } : null; }
  async groupByCode(code: string) { const g = [...this.groupsM.values()].find((x) => x.code === code); return g ? { ...g } : null; }
  async groupsToTick() { return [...this.groupsM.values()].filter((g) => g.status === 'setup' || g.status === 'active').map((g) => ({ ...g })); }
  async updateGroup(gid: string, patch: Partial<Group>) { this.groupsM.set(gid, { ...this.groupsM.get(gid)!, ...patch }); }

  async members(gid: string) { return [...this.membersM.values()].filter((m) => m.group_id === gid).map((m) => ({ ...m })); }
  async memberships(pid: string) { return [...this.membersM.values()].filter((m) => m.pseudonym_id === pid).map((m) => ({ ...m })); }
  async addMember(input: { groupId: string; name: string; pseudonymId: string | null; status: Member['status'] }) {
    const ms = await this.members(input.groupId);
    if (ms.some((m) => m.roster_name.toLowerCase() === input.name.toLowerCase())) throw new Error('duplicate name');
    const m: Member = {
      id: id('m'), group_id: input.groupId, roster_name: input.name, pseudonym_id: input.pseudonymId,
      position: ms.length ? Math.max(...ms.map((x) => x.position)) + 1 : 0, status: input.status, missed: 0,
      joined_at: input.status === 'active' ? new Date().toISOString() : null,
    };
    this.membersM.set(m.id, m);
    return { ...m };
  }
  async updateMember(mid: string, patch: Partial<Member>) { this.membersM.set(mid, { ...this.membersM.get(mid)!, ...patch }); }

  async rounds(gid: string, season: number) { return [...this.roundsM.values()].filter((r) => r.group_id === gid && r.season === season).sort((a, b) => a.day - b.day).map((r) => structuredClone(r)); }
  async round(rid: string) { const r = this.roundsM.get(rid); return r ? structuredClone(r) : null; }
  async createRound(input: any) {
    if ([...this.roundsM.values()].some((r) => r.group_id === input.group_id && r.season === input.season && r.day === input.day)) throw new Error('duplicate round');
    const r: Round = { id: id('r'), targets: {}, reveal_at: null, opened_at: null, revealed_at: null, summary: {}, ...input };
    this.roundsM.set(r.id, r);
    return structuredClone(r);
  }
  async updateRound(rid: string, patch: Partial<Round>) { this.roundsM.set(rid, { ...this.roundsM.get(rid)!, ...structuredClone(patch) }); }

  async answers(rid: string) { return this.answersL.filter((a) => a.round_id === rid).map((a) => ({ ...a })); }
  async saveAnswer(a: Answer) {
    if (this.answersL.some((x) => x.round_id === a.round_id && x.member_id === a.member_id)) return false;
    this.answersL.push({ ...a });
    return true;
  }
  async bets(rid: string) { return this.betsL.filter((b) => b.round_id === rid).map((b) => ({ ...b })); }
  async saveBet(b: Bet) {
    if (b.bettor_member_id === b.target_member_id) throw new Error('self bet');
    const i = this.betsL.findIndex((x) => x.round_id === b.round_id && x.bettor_member_id === b.bettor_member_id && x.target_member_id === b.target_member_id);
    if (i >= 0) this.betsL[i] = { ...b }; else this.betsL.push({ ...b });
  }
  async gradeBets(rid: string, graded: Bet[]) {
    for (const g of graded) {
      const b = this.betsL.find((x) => x.round_id === rid && x.bettor_member_id === g.bettor_member_id && x.target_member_id === g.target_member_id);
      if (b) b.correct = g.correct;
    }
  }
  async voices(rid: string) { return this.voicesL.filter((v) => v.round_id === rid).map((v) => ({ ...v })); }
  async saveVoice(v: Omit<Voice, 'id' | 'rating' | 'delivered_at' | 'rated_at'>) {
    if (this.voicesL.some((x) => x.round_id === v.round_id && x.from_member_id === v.from_member_id)) throw new Error('duplicate voice');
    const full: Voice = { id: id('v'), rating: null, delivered_at: null, rated_at: null, ...v };
    this.voicesL.push(full);
    return { ...full };
  }
  async updateVoice(vid: string, patch: Partial<Voice>) { const v = this.voicesL.find((x) => x.id === vid); if (v) Object.assign(v, patch); }
  async pendingRatings(memberIds: string[]) {
    return this.voicesL.filter((v) => memberIds.includes(v.to_member_id) && v.delivered_at && !v.rating && !v.skipped).map((v) => ({ ...v }));
  }
  async addPoints(rows: PointRow[]) {
    for (const r of rows) if (!this.pointsL.some((x) => x.round_id === r.round_id && x.member_id === r.member_id && x.reason === r.reason)) this.pointsL.push({ ...r });
  }
  async standings(gid: string, season: number): Promise<Standing[]> {
    const rids = new Set((await this.rounds(gid, season)).map((r) => r.id));
    return (await this.members(gid)).filter((m) => m.status !== 'left').map((m) => ({
      member_id: m.id, roster_name: m.roster_name, position: m.position,
      points: this.pointsL.filter((p) => p.member_id === m.id && rids.has(p.round_id)).reduce((s, p) => s + p.points, 0),
    }));
  }

  async question(qid: string) { const q = this.questionsM.get(qid); return q ? { ...q } : null; }
  async suggestions(n: number, exclude: string[], preferTag?: string) {
    const all = [...this.questionsM.values()].filter((q) => q.origin === 'house' && q.status === 'active' && !exclude.includes(q.id));
    all.sort((a, b) => Number(preferTag ? b.tags.includes(preferTag) : 0) - Number(preferTag ? a.tags.includes(preferTag) : 0) || a.offered - b.offered);
    return all.slice(0, n).map((q) => ({ ...q }));
  }
  async nationalFor(date: string) { return [...this.questionsM.values()].find((q) => q.origin === 'national' && q.status === 'active' && q.scheduled_for === date) ?? null; }
  async createQuestion(q: Pick<Question, 'prompt' | 'detail' | 'option_a' | 'option_b'> & { authorPseudonymId: string }) {
    const full: Question = { id: id('q'), prompt: q.prompt, detail: q.detail, option_a: q.option_a, option_b: q.option_b, origin: 'player', tone: 'fun',
      study_id: null, subthesis_id: null, tags: [], status: 'active', scheduled_for: null, offered: 0, picked: 1 };
    this.questionsM.set(full.id, full);
    return { ...full };
  }
  async bumpQuestion(qid: string, field: 'offered' | 'picked') { const q = this.questionsM.get(qid); if (q) q[field]++; }
  async usedQuestionIds(gid: string) { return [...this.roundsM.values()].filter((r) => r.group_id === gid && r.question_id).map((r) => r.question_id!); }

  async observe(o: Observation) { if (!this.observations.some((x) => x.idempotency_key === o.idempotency_key)) this.observations.push(o); }
  async uploadAudio(path: string, data: Uint8Array) { this.audio.set(path, data); return path; }
  async audioUrl(path: string) { return `https://audio.test/${path}`; }
  async erasePerson(p: Person) {
    const ms = await this.memberships(p.pseudonymId);
    const ids = new Set(ms.map((m) => m.id));
    this.answersL = this.answersL.filter((a) => !ids.has(a.member_id));
    this.betsL = this.betsL.filter((b) => !ids.has(b.bettor_member_id));
    this.voicesL = this.voicesL.filter((v) => !ids.has(v.from_member_id));
    for (const m of ms) await this.updateMember(m.id, { status: 'left' });
    await this.setOptOut(p, true);
  }

  async send(p: Person, out: Outbound, purpose: string) { this.sent.push({ phone: p.phone, purpose, ...out }); }

  // Ayudas para las pruebas
  inbox(phone: string) { return this.sent.filter((s) => s.phone === phone); }
  last(phone: string) { const box = this.inbox(phone).filter((s) => s.text); return box.at(-1)?.text ?? ''; }
}
