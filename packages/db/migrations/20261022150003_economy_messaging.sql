-- economy: recompensas. Un solo libro de movimientos; los saldos se calculan.
-- messaging: WhatsApp.

create schema if not exists economy;
create schema if not exists messaging;

create table economy.seasons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  prizes jsonb not null default '[]',
  final_ranking jsonb,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create unique index seasons_one_active on economy.seasons ((true)) where status = 'active';

-- Cuánto paga cada actividad de cada app. Los menores cobran solo Golden Tickets.
create table economy.reward_rules (
  id uuid primary key default gen_random_uuid(),
  app_slug text not null references core.apps(slug),
  activity text not null,
  adult_currency text not null check (adult_currency in ('cash_usd', 'tickets')),
  adult_amount numeric not null check (adult_amount >= 0),
  minor_tickets int not null default 0 check (minor_tickets >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index reward_rules_one_active on economy.reward_rules (app_slug, activity) where is_active;

create table economy.ledger (
  id bigint generated always as identity primary key,
  node_id uuid not null references core.nodes(id),
  season_id uuid references economy.seasons(id),
  currency text not null check (currency in ('cash_usd', 'tickets')),
  amount numeric not null check (amount <> 0),
  app_slug text references core.apps(slug),
  activity text not null,
  source_type text,
  source_id text,
  idempotency_key text not null unique,
  created_by text not null default 'system' check (created_by in ('system', 'admin', 'claude')),
  created_at timestamptz not null default now()
);
create index ledger_node_idx on economy.ledger (node_id, currency);
create index ledger_season_idx on economy.ledger (season_id, currency);

-- Regla dura: un menor nunca recibe efectivo, ni por error.
create or replace function economy.guard_minor_cash() returns trigger
language plpgsql set search_path = '' as $$
declare
  minor boolean;
begin
  if new.currency = 'cash_usd' and new.amount > 0 then
    select f.is_minor into minor from core.node_facts f where f.id = new.node_id;
    if minor is distinct from false then
      raise exception 'cash rewards require a verified adult (node %)', new.node_id;
    end if;
  end if;
  return new;
end $$;
create trigger ledger_guard_minor before insert on economy.ledger
  for each row execute function economy.guard_minor_cash();

create or replace function economy.guard_ledger_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'ledger is append-only; write a compensating entry instead';
end $$;
create trigger ledger_append_only before update or delete on economy.ledger
  for each row execute function economy.guard_ledger_append_only();

create view economy.balances as
select
  node_id,
  coalesce(sum(amount) filter (where currency = 'cash_usd'), 0) as cash_usd,
  coalesce(sum(amount) filter (where currency = 'tickets'), 0) as tickets,
  coalesce(sum(amount) filter (where currency = 'cash_usd' and amount > 0), 0) as cash_usd_lifetime,
  coalesce(sum(amount) filter (where currency = 'tickets' and amount > 0), 0) as tickets_lifetime
from economy.ledger
group by node_id;

create view economy.season_tickets as
select season_id, node_id, sum(amount) as tickets
from economy.ledger
where currency = 'tickets' and season_id is not null
group by season_id, node_id;

create table economy.withdrawals (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references core.nodes(id),
  amount_usd numeric not null check (amount_usd > 0),
  wallet_alias text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references core.admins(id),
  notes text,
  ledger_id bigint references economy.ledger(id)
);
create index withdrawals_status_idx on economy.withdrawals (status, requested_at);

-- Cada número que escribió, aunque no sea nodo. Se guarda para poder respetar una baja.
create table messaging.contacts (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  wa_id text unique,
  node_id uuid references core.nodes(id) on delete set null,
  display_name text,
  opted_out_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger contacts_touch before update on messaging.contacts for each row execute function core.touch_updated_at();

create table messaging.templates (
  key text primary key,
  purpose text not null,
  provider_name text not null,
  language text not null default 'es_AR',
  category text not null check (category in ('utility', 'marketing', 'authentication')),
  body text not null,
  button_text text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected', 'paused')),
  provider_template_id text,
  synced_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger templates_touch before update on messaging.templates for each row execute function core.touch_updated_at();

create table messaging.campaigns (
  id uuid primary key default gen_random_uuid(),
  app_slug text references core.apps(slug),
  name text not null,
  template_key text not null references messaging.templates(key),
  target jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'done', 'cancelled')),
  audience_count int,
  sent_count int not null default 0,
  delivered_count int not null default 0,
  read_count int not null default 0,
  failed_count int not null default 0,
  created_by uuid references core.admins(id),
  created_at timestamptz not null default now(),
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
);

create table messaging.messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references messaging.contacts(id),
  node_id uuid references core.nodes(id) on delete set null,
  campaign_id uuid references messaging.campaigns(id),
  direction text not null check (direction in ('in', 'out')),
  purpose text,
  command text,
  template_key text references messaging.templates(key),
  provider_message_id text unique,
  status text not null check (status in ('queued', 'sent', 'delivered', 'read', 'failed', 'received')),
  idempotency_key text unique,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz
);
create index messages_contact_idx on messaging.messages (contact_id, created_at desc);
create index messages_campaign_idx on messaging.messages (campaign_id, status);
