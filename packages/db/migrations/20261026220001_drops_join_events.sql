-- Embudo del link de grupo: cuántos abrieron el link, cuántos pusieron apodo.
-- (Arrancar y terminar ya se ven en drops.sessions.) Un visitante anónimo = un id al azar guardado en su navegador.

create table drops.join_events (
  id bigint generated always as identity primary key,
  drop_slug text not null,
  event text not null check (event in ('open', 'joined')),
  client_id text check (client_id is null or client_id ~ '^[a-z0-9-]{8,64}$'),
  node_id uuid references core.nodes(id) on delete set null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index join_events_drop_idx on drops.join_events (drop_slug, event, created_at);
alter table drops.join_events enable row level security;
revoke all on drops.join_events from public, anon, authenticated;
grant all on drops.join_events to service_role;
