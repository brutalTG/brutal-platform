-- PRESSURE · Detector de mentiras.
-- El contenido del juego (preguntas, reglas, frases de la máquina) se arma desde el panel.
-- Cada partida deja: la sesión con su resultado, una observación por respuesta y los tickets en el libro.

-- Preguntas del juego. Cada una tiene una sección (calibración o juego) y un tipo.
create table pressure.items (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references pressure.experiments(id) on delete cascade,
  section text not null check (section in ('calibration', 'game')),
  position int not null default 0,
  kind text not null check (kind in ('calibration', 'obvious_lie', 'fun', 'signal')),
  -- Lo que dice la máquina, en voz alta.
  prompt text not null check (length(prompt) between 3 and 400),
  -- Lo que se lee en pantalla. Si está vacío se muestra el prompt.
  screen_text text check (screen_text is null or length(screen_text) <= 200),
  answer_type text not null check (answer_type in ('yes_no', 'agree', 'number', 'open')),
  -- Repregunta opcional. Se responde con el mismo estado (verdad o mentira) que la pregunta.
  follow_up text check (follow_up is null or length(follow_up) between 3 and 300),
  subthesis_id uuid references signal.subtheses(id) on delete set null,
  -- De dónde sale el dato real que usa la pregunta (noticia, fecha). Solo para el equipo.
  source_note text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (section = 'calibration' or kind in ('fun', 'signal')),
  check (section = 'game' or kind in ('calibration', 'obvious_lie'))
);
create index items_experiment_idx on pressure.items (experiment_id, section, position);
create trigger items_touch before update on pressure.items for each row execute function core.touch_updated_at();

-- Cada cambio de contenido sube la versión del experimento. Las partidas guardan con qué versión se jugaron.
alter table pressure.experiments add column content_version int not null default 1;

create or replace function pressure.bump_content_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  update pressure.experiments
     set content_version = content_version + 1
   where id = coalesce(new.experiment_id, old.experiment_id);
  return null;
end $$;
create trigger items_bump_version after insert or update or delete on pressure.items
  for each row execute function pressure.bump_content_version();

-- Resultado de cada partida en columnas, para ranking y panel.
alter table pressure.sessions
  add column content_version int,
  add column replay boolean not null default false,
  add column lies int,
  add column caught int,
  add column verdict text check (verdict in ('caught', 'escaped')),
  add column tickets int not null default 0 check (tickets >= 0);

-- Una sola partida que cobra por nodo y experimento. Las demás son revanchas sin premio.
create unique index pressure_sessions_one_rewarded on pressure.sessions (pseudonym_id, experiment_id)
  where not replay;

-- Alias público: nunca el nombre ni el teléfono.
create or replace function core.public_alias(p uuid) returns text
language sql immutable set search_path = '' as $$
  select 'NODO-' || upper(substr(md5(p::text), 1, 4))
$$;

-- Ranking de la temporada activa, por tickets.
create view economy.season_ranking with (security_invoker = true) as
select
  s.id as season_id,
  st.node_id,
  core.public_alias(p.pseudonym_id) as alias,
  st.tickets,
  rank() over (partition by s.id order by st.tickets desc) as position,
  count(*) over (partition by s.id) as players
from economy.seasons s
join economy.season_tickets st on st.season_id = s.id
join core.node_pseudonyms p on p.node_id = st.node_id
where st.tickets > 0;

-- Ranking del detector: quién le ganó a la máquina y cuántas mentiras le pasó.
create view pressure.detector_ranking with (security_invoker = true) as
select
  ps.experiment_id,
  ps.pseudonym_id,
  core.public_alias(ps.pseudonym_id) as alias,
  count(*) filter (where ps.status = 'completed') as plays,
  count(*) filter (where ps.verdict = 'escaped') as wins,
  sum(ps.lies - ps.caught) filter (where ps.status = 'completed') as lies_passed,
  max(ps.tickets) as best_tickets,
  max(ps.ended_at) as last_played_at
from pressure.sessions ps
group by ps.experiment_id, ps.pseudonym_id;

alter table pressure.items enable row level security;
revoke all on pressure.items from public, anon, authenticated;
grant all on pressure.items to service_role;
grant select on economy.season_ranking, pressure.detector_ranking to service_role;
revoke all on function core.public_alias(uuid) from public, anon, authenticated;
grant execute on function core.public_alias(uuid), pressure.bump_content_version() to service_role;
