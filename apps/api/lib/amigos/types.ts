// AMIGOS DE MIERDA: tipos del juego. Sin dependencias, para que el motor se pruebe sin base.

export type Choice = 'a' | 'b';

export type Question = {
  id: string;
  prompt: string;
  detail: string | null;
  option_a: string;
  option_b: string;
  origin: 'house' | 'player' | 'national';
  tone: 'fun' | 'signal';
  study_id: string | null;
  subthesis_id: string | null;
  tags: string[];
  status: 'draft' | 'active' | 'retired';
  scheduled_for: string | null;
  offered: number;
  picked: number;
};

export type Group = {
  id: string;
  number: number;
  code: string;
  name: string;
  founder_pseudonym_id: string;
  status: 'setup' | 'active' | 'paused' | 'finished';
  season: number;
  season_days: number;
  turn_hour: number;
  open_hour: number;
  reveal_hour: number;
  test: boolean;
  created_at: string;
};

export type Member = {
  id: string;
  group_id: string;
  roster_name: string;
  pseudonym_id: string | null;
  position: number;
  status: 'listed' | 'active' | 'dormant' | 'left';
  missed: number;
  joined_at: string | null;
};

export type RoundSummary = {
  split?: { a: number; b: number };
  members?: { id: string; name: string; choice: Choice | null }[];
  // apostador -> objetivo -> acertó (null: el objetivo no contestó)
  matrix?: Record<string, Record<string, boolean | null>>;
  lines?: string[];
  points?: Record<string, number>;
  reminded?: boolean;
  auto_question?: boolean;
};

export type Round = {
  id: string;
  group_id: string;
  season: number;
  day: number;
  local_date: string;
  question_id: string | null;
  author_member_id: string | null;
  victim_member_id: string | null;
  status: 'drafting' | 'open' | 'revealed' | 'skipped';
  targets: Record<string, string>;
  reveal_at: string | null;
  opened_at: string | null;
  revealed_at: string | null;
  summary: RoundSummary;
};

export type Answer = { round_id: string; member_id: string; choice: Choice; latency_ms: number | null; answered_at: string };
export type Bet = { round_id: string; bettor_member_id: string; target_member_id: string; guess: Choice; correct: boolean | null };

export type Voice = {
  id: string;
  round_id: string;
  from_member_id: string;
  to_member_id: string;
  audio_path: string | null;
  mime: string | null;
  duration_s: number | null;
  transcript: string | null;
  skipped: boolean;
  rating: 'read' | 'not_read' | null;
  delivered_at: string | null;
  rated_at: string | null;
};

export type Step =
  | 'idle'
  | 'f_name' | 'f_me' | 'pick' | 'custom_a' | 'custom_b' | 'f_roster'
  | 'j_who'
  | 'answer' | 'bet' | 'voice' | 'rate'
  | 'victim' | 'age';

export type Player = {
  pseudonym_id: string;
  step: Step;
  step_group_id: string | null;
  step_round_id: string | null;
  step_data: Record<string, any>;
  prompted_at: string | null;
  declared_age: number | null;
  paused_until: string | null;
  blocked_reason: string | null;
};

export type Person = { nodeId: string; pseudonymId: string; phone: string; contactId: string; optedOut: boolean };

export type Inbound = {
  id: string;
  phone: string;
  name: string | null;
  text: string;
  audio: { data: Uint8Array; mime: string; seconds: number | null } | null;
  at: Date;
};

export type Outbound = { text?: string; imageUrl?: string; audioUrl?: string };

export type Observation = {
  pseudonym_id: string;
  instrument_type: string;
  instrument_id: string;
  stimulus_id?: string | null;
  stimulus?: Record<string, unknown>;
  kind: 'choice' | 'game_move' | 'voice' | 'text' | 'declared';
  value: Record<string, unknown>;
  value_text?: string | null;
  value_number?: number | null;
  latency_ms?: number | null;
  observed_at: string;
  session_id?: string | null;
  position?: number | null;
  study_id?: string | null;
  subthesis_id?: string | null;
  context?: Record<string, unknown>;
  idempotency_key: string;
};

export type PointRow = { round_id: string; member_id: string; reason: 'bet' | 'voice_read' | 'author_split' | 'victim_safe'; points: number };
export type Standing = { member_id: string; roster_name: string; points: number; position: number };
