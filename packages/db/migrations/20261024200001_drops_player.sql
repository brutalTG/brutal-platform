-- Drops: lo que necesita el reproductor traído del sandbox para funcionar sobre la base nueva.
-- Premios por carta, respuestas de cada partida (operativas; lo que se analiza va a signal.observations),
-- y la billetera del nodo para cobrar.

-- Premio por carta. Si el nodo es menor, nunca efectivo: se paga minor_tickets (o 1 ticket por cada premio en plata).
alter table drops.questions
  add column reward_cash_usd numeric(10,2) not null default 0 check (reward_cash_usd >= 0),
  add column reward_tickets int not null default 0 check (reward_tickets >= 0),
  add column reward_minor_tickets int check (reward_minor_tickets is null or reward_minor_tickets >= 0),
  -- Respuestas más rápidas que esto no cobran (se tocó sin leer).
  add column min_latency_ms int not null default 400 check (min_latency_ms >= 0);

-- El mismo premio, cambiado solo para un Drop.
alter table drops.drop_questions
  add column reward_cash_usd numeric(10,2) check (reward_cash_usd is null or reward_cash_usd >= 0),
  add column reward_tickets int check (reward_tickets is null or reward_tickets >= 0),
  add column reward_minor_tickets int check (reward_minor_tickets is null or reward_minor_tickets >= 0);

-- Lo que el reproductor calcula al terminar.
alter table drops.sessions
  add column traps_passed int not null default 0,
  add column traps_failed int not null default 0,
  add column avg_latency_ms int,
  add column consistency numeric,
  add column archetype jsonb,
  add column bic_scores jsonb,
  add column claimed_at timestamptz;

-- Una fila por carta contestada. Asegura el orden (sin saltos ni repetidos) y guarda el premio que corresponde.
create table drops.answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references drops.sessions(id) on delete cascade,
  position int not null check (position >= 0),
  question_id uuid not null references drops.questions(id),
  observation_id uuid references signal.observations(id),
  latency_ms int check (latency_ms is null or latency_ms >= 0),
  reward_currency text check (reward_currency is null or reward_currency in ('cash_usd', 'tickets')),
  reward_value numeric not null default 0,
  reward_granted boolean not null default false,
  trap_correct boolean,
  multiplier_at numeric not null default 1,
  created_at timestamptz not null default now(),
  unique (session_id, position)
);
create index answers_session_idx on drops.answers (session_id, position);

-- Billetera para cobrar efectivo (solo adultos; lo valida el API y el libro de movimientos).
create table economy.wallets (
  node_id uuid primary key references core.nodes(id) on delete cascade,
  alias text not null check (alias ~ '^[a-z0-9._-]{3,80}$'),
  updated_at timestamptz not null default now()
);

alter table drops.answers enable row level security;
alter table economy.wallets enable row level security;
revoke all on drops.answers, economy.wallets from public, anon, authenticated;
grant all on drops.answers, economy.wallets to service_role;
