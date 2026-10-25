// Lo que el motor necesita de la base. Hay dos implementaciones: Supabase (de verdad) y memoria (pruebas).
import type { Answer, Bet, Group, Inbound, Member, Observation, Outbound, Person, Player, PointRow, Question, Round, Standing, Voice } from './types.ts';

export interface Store {
  // Personas y mensajes
  seenInbound(providerId: string): Promise<boolean>;
  ensurePerson(phone: string, displayName: string | null): Promise<Person>;
  personByPseudonym(pseudonymId: string): Promise<Person | null>;
  logInbound(person: Person, m: Inbound, mediaPath?: string | null): Promise<void>;
  setOptOut(person: Person, out: boolean): Promise<void>;
  grantConsent(person: Person, purpose: 'whatsapp_messages' | 'research_use' | 'voice_recording', evidence: string, ref?: string | null): Promise<void>;
  touchNode(person: Person, patch: { nickname?: string | null; referredBy?: string | null }): Promise<void>;

  player(pseudonymId: string): Promise<Player>;
  savePlayer(pseudonymId: string, patch: Partial<Omit<Player, 'pseudonym_id'>>): Promise<void>;

  // Grupos
  createGroup(input: { name: string; founderPseudonymId: string; test: boolean }): Promise<Group>;
  group(id: string): Promise<Group | null>;
  groupByCode(code: string): Promise<Group | null>;
  groupsToTick(): Promise<Group[]>;
  updateGroup(id: string, patch: Partial<Group>): Promise<void>;

  members(groupId: string): Promise<Member[]>;
  memberships(pseudonymId: string): Promise<Member[]>;
  addMember(input: { groupId: string; name: string; pseudonymId: string | null; status: Member['status'] }): Promise<Member>;
  updateMember(id: string, patch: Partial<Member>): Promise<void>;

  // Rondas
  rounds(groupId: string, season: number): Promise<Round[]>;
  round(id: string): Promise<Round | null>;
  createRound(input: Omit<Round, 'id' | 'opened_at' | 'revealed_at' | 'summary' | 'targets' | 'reveal_at'> & Partial<Pick<Round, 'opened_at' | 'reveal_at' | 'targets' | 'summary'>>): Promise<Round>;
  updateRound(id: string, patch: Partial<Round>): Promise<void>;

  answers(roundId: string): Promise<Answer[]>;
  saveAnswer(a: Answer): Promise<boolean>;
  bets(roundId: string): Promise<Bet[]>;
  saveBet(b: Bet): Promise<void>;
  gradeBets(roundId: string, graded: Bet[]): Promise<void>;
  voices(roundId: string): Promise<Voice[]>;
  saveVoice(v: Omit<Voice, 'id' | 'rating' | 'delivered_at' | 'rated_at'>): Promise<Voice>;
  updateVoice(id: string, patch: Partial<Voice>): Promise<void>;
  pendingRatings(memberIds: string[]): Promise<Voice[]>;
  addPoints(rows: PointRow[]): Promise<void>;
  standings(groupId: string, season: number): Promise<Standing[]>;

  // Preguntas
  question(id: string): Promise<Question | null>;
  suggestions(n: number, exclude: string[], preferTag?: string): Promise<Question[]>;
  nationalFor(date: string): Promise<Question | null>;
  createQuestion(q: Pick<Question, 'prompt' | 'detail' | 'option_a' | 'option_b'> & { authorPseudonymId: string }): Promise<Question>;
  bumpQuestion(id: string, field: 'offered' | 'picked'): Promise<void>;
  usedQuestionIds(groupId: string): Promise<string[]>;

  // Señal, audios y borrado
  observe(o: Observation): Promise<void>;
  uploadAudio(path: string, data: Uint8Array, mime: string): Promise<string>;
  audioUrl(path: string): Promise<string | null>;
  erasePerson(person: Person): Promise<void>;

  // Lo que sale (queda registrado en messaging.messages)
  send(person: Person, out: Outbound, purpose: string): Promise<void>;
}
