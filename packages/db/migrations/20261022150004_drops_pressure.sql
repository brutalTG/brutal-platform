-- drops y pressure: solo lo que cada app necesita para funcionar.
-- Lo que sirve para analizar va a signal.observations.

create schema if not exists drops;
create schema if not exists pressure;

create table drops.questions (
  id uuid primary key default gen_random_uuid(),
  format text not null,
  label text not null,
  content jsonb not null,
  card_type text not null default 'culture' check (card_type in ('brand', 'culture', 'trap', 'dead_drop')),
  signal_pair_id text,
  signal_pair_role text check (signal_pair_role is null or signal_pair_role in ('explorer', 'validator')),
  tags text[] not null default '{}',
  timer_s int check (timer_s is null or timer_s > 0),
  dimension_id uuid references profile.dimensions(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger questions_touch before update on drops.questions for each row execute function core.touch_updated_at();

create table drops.drops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  study_id uuid references signal.studies(id) on delete set null,
  season_id uuid references economy.seasons(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'live', 'closed', 'archived')),
  config jsonb not null default '{}',
  segment_ids uuid[] not null default '{}',
  version int not null default 1,
  opens_at timestamptz,
  closes_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at is null or opens_at is null or closes_at > opens_at)
);
create trigger drops_touch before update on drops.drops for each row execute function core.touch_updated_at();

create table drops.drop_questions (
  drop_id uuid not null references drops.drops(id) on delete cascade,
  question_id uuid not null references drops.questions(id),
  position int not null check (position >= 0),
  enabled boolean not null default true,
  primary key (drop_id, question_id),
  unique (drop_id, position) deferrable initially deferred
);

create table drops.sessions (
  id uuid primary key default gen_random_uuid(),
  pseudonym_id uuid not null references core.node_pseudonyms(pseudonym_id),
  drop_id uuid not null references drops.drops(id),
  drop_version int not null,
  status text not null default 'started' check (status in ('started', 'completed', 'abandoned')),
  position int not null default 0,
  multiplier numeric not null default 1,
  device jsonb not null default '{}',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  total_ms int
);
create unique index drop_sessions_one_per_node on drops.sessions (pseudonym_id, drop_id);

-- Experimentos: cada juego. La definición (personalidad, reglas, banco de preguntas) vive acá, no en el código.
create table pressure.experiments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  series text,
  episode int,
  format text not null default 'conversation',
  definition jsonb not null default '{}',
  study_id uuid references signal.studies(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'testing', 'live', 'retired')),
  max_duration_s int not null default 300 check (max_duration_s between 30 and 1800),
  cover_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger experiments_touch before update on pressure.experiments for each row execute function core.touch_updated_at();

-- Qué agente del proveedor usa cada experimento en cada entorno. Saca los IDs del código.
create table pressure.agents (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references pressure.experiments(id) on delete cascade,
  environment text not null check (environment in ('test', 'production')),
  provider text not null default 'elevenlabs',
  provider_agent_id text not null,
  provider_branch_id text,
  provider_version_id text,
  config_fingerprint text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (experiment_id, environment)
);

create table pressure.sessions (
  id uuid primary key default gen_random_uuid(),
  pseudonym_id uuid not null references core.node_pseudonyms(pseudonym_id),
  experiment_id uuid not null references pressure.experiments(id),
  agent_id uuid references pressure.agents(id),
  agent_version_id text,
  access_link_id uuid references core.access_links(id),
  status text not null default 'started' check (status in ('started', 'completed', 'interrupted', 'failed')),
  provider_conversation_id text unique,
  outcome jsonb not null default '{}',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_s int
);
create index pressure_sessions_experiment_idx on pressure.sessions (experiment_id, started_at desc);

create table pressure.events (
  id bigint generated always as identity primary key,
  session_id uuid not null references pressure.sessions(id) on delete cascade,
  seq int not null,
  type text not null,
  payload jsonb not null default '{}',
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  unique (session_id, seq)
);

-- Audio y transcripción. El audio vence a los 12 meses; la transcripción queda sin datos de identidad.
create table pressure.recordings (
  session_id uuid primary key references pressure.sessions(id) on delete cascade,
  audio_path text,
  transcript jsonb,
  retain_audio_until date not null default (current_date + interval '12 months')::date,
  audio_deleted_at timestamptz,
  created_at timestamptz not null default now()
);
