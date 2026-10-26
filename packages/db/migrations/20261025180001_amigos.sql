-- AMIGOS DE MIERDA: un juego para gente que no quiere tanto a sus amigos.
-- Una pregunta por día al grupo; cada uno contesta y apuesta qué contestó cada amigo.
-- Todo pasa por WhatsApp (un número propio del juego). Lo que sirve para analizar va a signal.observations;
-- acá queda solo lo que el juego necesita para funcionar.

create schema if not exists amigos;

insert into core.apps (slug, name, description, prod_domain, test_domain, observation_kinds)
values ('amigos', 'Amigos de mierda', 'Juego de WhatsApp: una pregunta por día y apostás qué contestó cada amigo.',
        'amigos.brutal.lat', 'test-amigos.brutal.lat', array['choice', 'game_move', 'voice', 'text', 'declared'])
on conflict (slug) do nothing;

-- Lo que manda el bot con imagen o audio (el panel lo muestra en modo simulado).
alter table messaging.messages
  add column if not exists media_url text check (media_url is null or media_url ~ '^https?://'),
  add column if not exists media_kind text check (media_kind is null or media_kind in ('image', 'audio'));

-- ---------- Preguntas ----------
-- house: las escribe BRUTAL (biblioteca y sugerencias). player: las escribe un jugador en su turno.
-- national: la misma para todos los grupos en una fecha (la que da el dato del país).
create table amigos.questions (
  id uuid primary key default gen_random_uuid(),
  prompt text not null check (length(prompt) between 8 and 280),
  detail text check (detail is null or length(detail) <= 200),
  option_a text not null check (length(option_a) between 1 and 40),
  option_b text not null check (length(option_b) between 1 and 40),
  origin text not null default 'house' check (origin in ('house', 'player', 'national')),
  tone text not null default 'fun' check (tone in ('fun', 'signal')),
  study_id uuid references signal.studies(id) on delete set null,
  subthesis_id uuid references signal.subtheses(id) on delete set null,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  scheduled_for date,
  author_pseudonym_id uuid references core.node_pseudonyms(pseudonym_id) on delete set null,
  offered int not null default 0 check (offered >= 0),   -- cuántas veces el bot la sugirió
  picked int not null default 0 check (picked >= 0),     -- cuántas veces la eligieron (el "Lab")
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origin <> 'national' or scheduled_for is not null),
  check (tone <> 'signal' or subthesis_id is not null)
);
create unique index questions_one_national_per_day on amigos.questions (scheduled_for) where origin = 'national' and status = 'active';
create index questions_pick_idx on amigos.questions (origin, status, picked desc);
create trigger questions_touch before update on amigos.questions for each row execute function core.touch_updated_at();

-- ---------- Grupos ----------
create sequence amigos.group_number_seq start 1;

create table amigos.groups (
  id uuid primary key default gen_random_uuid(),
  number int not null unique default nextval('amigos.group_number_seq'),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{5}$'),
  name text not null check (length(name) between 1 and 40),
  founder_pseudonym_id uuid not null references core.node_pseudonyms(pseudonym_id),
  status text not null default 'setup' check (status in ('setup', 'active', 'paused', 'finished')),
  season int not null default 1 check (season > 0),
  season_days int not null default 14 check (season_days between 3 and 60),
  turn_hour int not null default 18 check (turn_hour between 0 and 23),
  open_hour int not null default 21 check (open_hour between 0 and 23),
  reveal_hour int not null default 23 check (reveal_hour between 0 and 23),
  test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  check (turn_hour < open_hour and open_hour < reveal_hour)
);
create index groups_status_idx on amigos.groups (status);
create trigger groups_touch before update on amigos.groups for each row execute function core.touch_updated_at();

-- Cada amigo del grupo. Nace "listado" cuando el fundador escribe su nombre; pasa a activo cuando entra.
create table amigos.members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references amigos.groups(id) on delete cascade,
  roster_name text not null check (length(roster_name) between 1 and 30),
  pseudonym_id uuid references core.node_pseudonyms(pseudonym_id) on delete set null,
  position int not null check (position >= 0),
  status text not null default 'listed' check (status in ('listed', 'active', 'dormant', 'left')),
  missed int not null default 0 check (missed >= 0),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (group_id, position),
  unique (group_id, pseudonym_id)
);
create unique index members_name_idx on amigos.members (group_id, lower(roster_name));
create index members_pseudonym_idx on amigos.members (pseudonym_id);

-- ---------- Rondas: un día del grupo ----------
create table amigos.rounds (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references amigos.groups(id) on delete cascade,
  season int not null check (season > 0),
  day int not null check (day > 0),
  local_date date not null,
  question_id uuid references amigos.questions(id),
  author_member_id uuid references amigos.members(id) on delete set null,   -- null = pregunta de BRUTAL
  victim_member_id uuid references amigos.members(id) on delete set null,
  status text not null default 'drafting' check (status in ('drafting', 'open', 'revealed', 'skipped')),
  targets jsonb not null default '{}',   -- miembro -> a quién le manda el audio ese día
  reveal_at timestamptz,
  opened_at timestamptz,
  revealed_at timestamptz,
  summary jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (group_id, season, day),
  check (status in ('drafting', 'skipped') or question_id is not null)
);
create index rounds_status_idx on amigos.rounds (status, reveal_at);

create table amigos.answers (
  round_id uuid not null references amigos.rounds(id) on delete cascade,
  member_id uuid not null references amigos.members(id) on delete cascade,
  choice text not null check (choice in ('a', 'b')),
  latency_ms int check (latency_ms is null or latency_ms >= 0),
  answered_at timestamptz not null default now(),
  primary key (round_id, member_id)
);

create table amigos.bets (
  round_id uuid not null references amigos.rounds(id) on delete cascade,
  bettor_member_id uuid not null references amigos.members(id) on delete cascade,
  target_member_id uuid not null references amigos.members(id) on delete cascade,
  guess text not null check (guess in ('a', 'b')),
  correct boolean,
  created_at timestamptz not null default now(),
  primary key (round_id, bettor_member_id, target_member_id),
  check (bettor_member_id <> target_member_id)
);

-- El audio del día: lo que un jugador le dice a su objetivo. Puede ser audio o texto, o saltearlo.
create table amigos.voices (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references amigos.rounds(id) on delete cascade,
  from_member_id uuid not null references amigos.members(id) on delete cascade,
  to_member_id uuid not null references amigos.members(id) on delete cascade,
  audio_path text,
  mime text,
  duration_s int check (duration_s is null or duration_s >= 0),
  transcript text check (transcript is null or length(transcript) <= 4000),
  skipped boolean not null default false,
  rating text check (rating is null or rating in ('read', 'not_read')),
  delivered_at timestamptz,
  rated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (round_id, from_member_id),
  check (skipped or audio_path is not null or transcript is not null)
);

-- Puntos por ronda y motivo. La tabla del grupo se calcula sumando.
create table amigos.points (
  id bigint generated always as identity primary key,
  round_id uuid not null references amigos.rounds(id) on delete cascade,
  member_id uuid not null references amigos.members(id) on delete cascade,
  reason text not null check (reason in ('bet', 'voice_read', 'author_split', 'victim_safe')),
  points int not null,
  created_at timestamptz not null default now(),
  unique (round_id, member_id, reason)
);

create view amigos.standings with (security_invoker = true) as
select g.id as group_id, g.season, m.id as member_id, m.roster_name, m.status, m.position,
       coalesce(sum(p.points), 0)::int as points
from amigos.groups g
join amigos.members m on m.group_id = g.id
left join amigos.rounds r on r.group_id = g.id and r.season = g.season
left join amigos.points p on p.round_id = r.id and p.member_id = m.id
where m.status <> 'left'
group by g.id, g.season, m.id, m.roster_name, m.status, m.position;

-- ---------- Jugadores: en qué paso de la conversación está cada número ----------
create table amigos.players (
  pseudonym_id uuid primary key references core.node_pseudonyms(pseudonym_id) on delete cascade,
  step text not null default 'idle',
  step_group_id uuid references amigos.groups(id) on delete set null,
  step_round_id uuid references amigos.rounds(id) on delete set null,
  step_data jsonb not null default '{}',
  prompted_at timestamptz,
  declared_age int check (declared_age is null or declared_age between 10 and 99),
  paused_until date,
  blocked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger players_touch before update on amigos.players for each row execute function core.touch_updated_at();

-- Para el panel: un renglón por grupo.
create view amigos.group_overview with (security_invoker = true) as
select g.id, g.number, g.code, g.name, g.status, g.season, g.season_days, g.test, g.created_at,
       (select count(*) from amigos.members m where m.group_id = g.id and m.status = 'active') as active_members,
       (select count(*) from amigos.members m where m.group_id = g.id and m.status = 'listed') as listed_members,
       (select max(r.day) from amigos.rounds r where r.group_id = g.id and r.season = g.season) as day,
       (select count(*) from amigos.answers a join amigos.rounds r on r.id = a.round_id where r.group_id = g.id) as answers,
       (select count(*) from amigos.voices v join amigos.rounds r on r.id = v.round_id where r.group_id = g.id and not v.skipped) as voices,
       (select max(a.answered_at) from amigos.answers a join amigos.rounds r on r.id = a.round_id where r.group_id = g.id) as last_answer_at
from amigos.groups g;

-- ---------- Seguridad: igual que el resto ----------
revoke all on schema amigos from public, anon, authenticated;
grant usage on schema amigos to service_role;
revoke all on all tables in schema amigos from public, anon, authenticated;
revoke all on all sequences in schema amigos from public, anon, authenticated;
grant all on all tables in schema amigos to service_role;
grant all on all sequences in schema amigos to service_role;
alter default privileges in schema amigos revoke all on tables from public, anon, authenticated;
alter default privileges in schema amigos grant all on tables to service_role;
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'amigos' loop
    execute format('alter table amigos.%I enable row level security', t.tablename);
  end loop;
end $$;

-- ---------- Biblioteca inicial ----------
insert into amigos.questions (prompt, detail, option_a, option_b, origin, tone, status, tags) values
  ('Podés saber con certeza si tus amigos te quieren o solo te aguantan.', 'Después no podés fingir que no sabés.', 'Quiero saber', 'No quiero saber', 'house', 'fun', 'active', '{apertura,grupo}'),
  ('Tu mejor amigo le está arruinando la vida a alguien que vos también querés. Te pide que no digas nada.', null, 'Me callo', 'Hablo', 'house', 'fun', 'active', '{apertura,grupo,lealtad}'),
  ('Te garantizan una vida extraordinaria: famoso, importante, la que soñás. Morís a los 45.', 'O una vida normal y tranquila hasta los 85.', 'A los 45', 'A los 85', 'house', 'fun', 'active', '{apertura,vida}'),
  ('Hay un botón. Lo apretás y tus viejos pierden todo, pero vos sos exactamente quien querés ser a los 40.', 'No lo apretás y seguís con su plata sin saber nunca si lo que sos es tuyo.', 'Lo aprieto', 'No lo aprieto', 'house', 'fun', 'active', '{familia,plata}'),
  ('La beca en la mejor universidad del mundo. Condición: 10 años sin pisar Argentina.', 'Ni casamientos, ni velorios. Ni el de tu viejo.', 'Me voy', 'Me quedo', 'house', 'fun', 'active', '{irse}'),
  ('Tu viejo te confiesa que la plata de la familia salió de algo turbio en los 90. Nadie lo sabe ni lo va a saber.', null, 'Sigo usándola', 'Me corto solo', 'house', 'fun', 'active', '{familia,plata}'),
  ('Tu pareja de 5 años: o nos casamos y tenemos un hijo este año, o cortamos. Tenés 24.', null, 'Me caso', 'Corto', 'house', 'fun', 'active', '{pareja}'),
  ('Te ofrecen el laburo de tu vida en el gobierno que más odiás. Si decís que no, lo agarra el peor tipo que conocés.', null, 'Agarro', 'No agarro', 'house', 'fun', 'active', '{laburo,politica}'),
  ('Podés leer una sola vez todo lo que dijeron de vos en los grupos donde no estás.', null, 'Leo todo', 'Prefiero no saber', 'house', 'fun', 'active', '{grupo}'),
  ('A los 23 te sale un cargo por acomodo de un tío. Buena plata, no laburás. Todo este grupo se entera.', null, 'Agarro y me río', 'No, y lo digo', 'house', 'fun', 'active', '{laburo,acomodo}'),
  ('Uno de este grupo va a ser millonario y el resto no. Podés elegir que no sea nadie.', null, 'Que sea uno', 'Que no sea nadie', 'house', 'fun', 'active', '{grupo,plata}'),
  ('Tu mejor amigo se pone de novio con tu ex. Te lo cuenta antes que nadie y te pide la bendición.', null, 'Se la doy', 'Se termina la amistad', 'house', 'fun', 'active', '{grupo,pareja}');
