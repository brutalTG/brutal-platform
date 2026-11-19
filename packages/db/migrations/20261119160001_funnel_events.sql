-- Embudo en vivo: pasos que no quedan en otras tablas (la placa de entrada y cada pregunta del onboarding).
-- Una fila por persona y paso (la primera vez); el resto del embudo sale de nodes, sessions, answers y web_claims.
create table drops.funnel_events (
  id bigint generated always as identity primary key,
  node_id uuid not null references core.nodes(id) on delete cascade,
  drop_slug text,
  step text not null check (step ~ '^[a-z_]{2,30}$'),
  detail text not null default '' check (length(detail) <= 60),
  created_at timestamptz not null default now(),
  unique (node_id, step, detail)
);
create index funnel_events_created_idx on drops.funnel_events (created_at);
alter table drops.funnel_events enable row level security;
revoke all on drops.funnel_events from public, anon, authenticated;
grant all on drops.funnel_events to service_role;
