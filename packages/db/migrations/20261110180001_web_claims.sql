-- Entrada desde anuncios: se juega en la web sin WhatsApp y los tickets se reclaman mandando un código al bot.
-- Cada partida terminada de un invitado web deja un código; al mandarlo por WhatsApp el nodo toma ese número
-- (o se une al nodo que ya tenía ese número) y recién ahí se acreditan los tickets.

create table drops.web_claims (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  node_id uuid not null references core.nodes(id) on delete cascade,
  drop_id uuid not null references drops.drops(id),
  session_id uuid not null unique references drops.sessions(id) on delete cascade,
  tickets integer not null default 0,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_node_id uuid references core.nodes(id) on delete set null
);
create index web_claims_node_idx on drops.web_claims (node_id);
alter table drops.web_claims enable row level security;
grant all on drops.web_claims to service_role;

-- Embudo de la entrada web.
alter table drops.join_events drop constraint join_events_event_check;
alter table drops.join_events add constraint join_events_event_check
  check (event in ('open', 'joined', 'shared', 'web_start', 'web_claimed'));
