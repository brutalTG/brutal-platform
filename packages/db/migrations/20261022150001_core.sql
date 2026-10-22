-- core: identidad del nodo y plataforma.
-- Lo único permanente es el nodo. Todo lo demás apunta acá.

create schema if not exists core;

create or replace function core.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Webapps registradas. El panel arma su menú y sus formularios con esto.
create table core.apps (
  slug text primary key check (slug ~ '^[a-z][a-z0-9-]{1,30}$'),
  name text not null,
  description text,
  prod_domain text,
  test_domain text,
  observation_kinds text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'paused', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger apps_touch before update on core.apps for each row execute function core.touch_updated_at();

-- La persona. Identificada por su teléfono verificado.
create table core.nodes (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  phone_verified_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'active', 'waitlisted', 'blocked', 'archived')),
  nickname text,
  birth_date date check (birth_date > date '1940-01-01'),
  gender text,
  province text,
  city text,
  referral_code text unique,
  referred_by uuid references core.nodes(id) on delete set null,
  acquisition_channel text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_active_at timestamptz,
  archived_at timestamptz
);
create index nodes_status_idx on core.nodes (status);
create trigger nodes_touch before update on core.nodes for each row execute function core.touch_updated_at();

-- Edad y minoría calculadas, nunca guardadas: un menor pasa a mayor solo.
create view core.node_facts as
select
  n.id,
  n.status,
  n.birth_date,
  case when n.birth_date is null then null
       else extract(year from age(current_date, n.birth_date))::int end as age,
  case when n.birth_date is null then null
       else age(current_date, n.birth_date) < interval '18 years' end as is_minor,
  n.gender,
  n.province,
  n.city,
  n.created_at,
  n.last_active_at
from core.nodes n;

-- Cruce privado nodo ↔ seudónimo. Las observaciones solo conocen el seudónimo.
create table core.node_pseudonyms (
  node_id uuid primary key references core.nodes(id) on delete cascade,
  pseudonym_id uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create or replace function core.ensure_pseudonym() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into core.node_pseudonyms (node_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger nodes_pseudonym after insert on core.nodes for each row execute function core.ensure_pseudonym();

-- Permisos por propósito. Uno vigente por nodo y propósito.
create table core.consents (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references core.nodes(id) on delete cascade,
  purpose text not null check (purpose in ('whatsapp_messages', 'voice_recording', 'research_use', 'marketing')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  evidence_source text not null,
  evidence_reference text,
  check (revoked_at is null or revoked_at >= granted_at)
);
create unique index consents_one_active on core.consents (node_id, purpose) where revoked_at is null;

-- Grupos de nodos definidos por filtros. Los usan todas las apps para invitar.
create table core.segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  filters jsonb not null default '{}',
  node_count int,
  refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger segments_touch before update on core.segments for each row execute function core.touch_updated_at();

-- Personas del equipo. El id coincide con el usuario de Supabase Auth.
create table core.admins (
  id uuid primary key,
  email text not null unique check (email = lower(email)),
  name text,
  role text not null default 'operator' check (role in ('owner', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  disabled_at timestamptz
);

-- Única puerta de entrada a cualquier app. Solo se guarda el hash del código.
create table core.access_links (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  app_slug text not null references core.apps(slug),
  purpose text not null check (purpose in ('onboarding', 'activity', 'test')),
  node_id uuid references core.nodes(id) on delete cascade,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  target_type text,
  target_id text,
  max_uses int not null default 1 check (max_uses > 0),
  uses int not null default 0 check (uses >= 0),
  expires_at timestamptz not null,
  created_by uuid references core.admins(id) on delete set null,
  created_at timestamptz not null default now(),
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  revoked_at timestamptz,
  check (node_id is not null or phone_e164 is not null or purpose = 'test'),
  check (expires_at > created_at)
);
create index access_links_node_idx on core.access_links (node_id);
create index access_links_target_idx on core.access_links (app_slug, target_type, target_id);

-- Quién hizo qué. Incluye a Claude como actor.
create table core.audit_log (
  id bigint generated always as identity primary key,
  actor_type text not null check (actor_type in ('admin', 'claude', 'system')),
  actor_id text,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on core.audit_log (created_at desc);
create index audit_log_entity_idx on core.audit_log (entity_type, entity_id);

insert into core.apps (slug, name, description, prod_domain, test_domain, observation_kinds) values
  ('drops', 'Drops', 'Cartas gamificadas que capturan señal comportamental.', 'drops.brutal.lat', 'test-drops.brutal.lat',
   array['choice', 'ranking', 'scale', 'text', 'game_move', 'behavior', 'declared']),
  ('pressure', 'Pressure', 'Juegos de voz con agentes conversacionales.', 'pressure.brutal.lat', 'test-pressure.brutal.lat',
   array['voice', 'choice', 'scale', 'game_move', 'behavior', 'declared']);
