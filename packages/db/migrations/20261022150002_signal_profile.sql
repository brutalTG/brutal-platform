-- signal: lo que entregan las webapps. profile: el nodo enriquecido.
-- Lo crudo (observations) nunca se edita. Lo interpretado (codings, traits) se puede rehacer.

create schema if not exists signal;
create schema if not exists profile;

-- Estudios: preguntas sobre la Gen Z con tesis y sub-tesis.
create table signal.studies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null,
  thesis text,
  status text not null default 'draft' check (status in ('draft', 'design', 'field', 'analysis', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger studies_touch before update on signal.studies for each row execute function core.touch_updated_at();

create table signal.subtheses (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references signal.studies(id) on delete cascade,
  code text not null,
  statement text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (study_id, code)
);

-- Cada cosa que un nodo eligió, escribió, dijo o hizo, en cualquier app.
create table signal.observations (
  id uuid primary key default gen_random_uuid(),
  pseudonym_id uuid not null references core.node_pseudonyms(pseudonym_id),
  app_slug text not null references core.apps(slug),
  instrument_type text not null,
  instrument_id text not null,
  instrument_version text,
  stimulus_id text,
  stimulus jsonb not null default '{}',
  kind text not null check (kind in ('choice', 'ranking', 'scale', 'text', 'voice', 'game_move', 'behavior', 'declared')),
  value jsonb not null,
  value_text text,
  value_number numeric,
  latency_ms int check (latency_ms is null or latency_ms >= 0),
  observed_at timestamptz not null,
  session_id uuid,
  position int,
  study_id uuid references signal.studies(id) on delete set null,
  subthesis_id uuid references signal.subtheses(id) on delete set null,
  context jsonb not null default '{}',
  quality text not null default 'valid' check (quality in ('valid', 'trap_failed', 'automatic', 'declared_lie', 'excluded')),
  quality_note text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index observations_pseudonym_idx on signal.observations (pseudonym_id, observed_at desc);
create index observations_instrument_idx on signal.observations (app_slug, instrument_id, instrument_version);
create index observations_study_idx on signal.observations (study_id, subthesis_id);
create index observations_session_idx on signal.observations (session_id);

-- Lo observado no se reescribe: solo puede cambiar su calidad.
create or replace function signal.guard_observation() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'observations are append-only';
  end if;
  if (new.pseudonym_id, new.app_slug, new.instrument_id, new.stimulus, new.kind, new.value, new.observed_at)
     is distinct from
     (old.pseudonym_id, old.app_slug, old.instrument_id, old.stimulus, old.kind, old.value, old.observed_at) then
    raise exception 'observations are immutable; only quality may change';
  end if;
  return new;
end $$;
create trigger observations_guard before update or delete on signal.observations
  for each row execute function signal.guard_observation();

-- Rúbricas para leer observaciones, versionadas.
create table signal.codebooks (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9-]{2,60}$'),
  version int not null default 1 check (version > 0),
  name text not null,
  description text,
  codes jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  created_at timestamptz not null default now(),
  unique (slug, version)
);

-- Cada lectura de una observación con una rúbrica.
create table signal.codings (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references signal.observations(id),
  codebook_id uuid not null references signal.codebooks(id),
  code text not null,
  value jsonb not null default 'true',
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  rationale text,
  coder_type text not null check (coder_type in ('claude', 'admin')),
  coder_ref text,
  created_at timestamptz not null default now(),
  superseded_at timestamptz
);
create unique index codings_current on signal.codings (observation_id, codebook_id, code) where superseded_at is null;
create index codings_codebook_idx on signal.codings (codebook_id, code);

-- Rasgos que BRUTAL aprende de los nodos.
create table profile.dimensions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_]{2,60}$'),
  name text not null,
  description text,
  value_type text not null check (value_type in ('category', 'scale', 'boolean', 'text')),
  categories jsonb,
  scale_min numeric,
  scale_max numeric,
  stability text not null default 'evolving' check (stability in ('stable', 'evolving')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (value_type <> 'scale' or (scale_min is not null and scale_max is not null and scale_min < scale_max))
);
create trigger dimensions_touch before update on profile.dimensions for each row execute function core.touch_updated_at();

-- Valor actual de cada rasgo de cada nodo.
create table profile.traits (
  node_id uuid not null references core.nodes(id) on delete cascade,
  dimension_id uuid not null references profile.dimensions(id) on delete cascade,
  value jsonb not null,
  value_text text,
  value_number numeric,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  evidence_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (node_id, dimension_id)
);
create index traits_dimension_idx on profile.traits (dimension_id, value_text);

-- Qué sostiene cada rasgo.
create table profile.trait_evidence (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references core.nodes(id) on delete cascade,
  dimension_id uuid not null references profile.dimensions(id) on delete cascade,
  observation_id uuid not null references signal.observations(id),
  coding_id uuid references signal.codings(id),
  contribution jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index trait_evidence_node_idx on profile.trait_evidence (node_id, dimension_id);
