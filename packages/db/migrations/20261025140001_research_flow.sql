-- Del estudio al informe: estudios armables desde el panel, resultados por experimento,
-- lanzamientos por WhatsApp, informes (hallazgos, Black Brief, piezas) y piezas nuevas de Drops (voz y mayor o menor).

-- ---------- Estudios ----------
alter table signal.studies
  add column if not exists question text,          -- la pregunta en criollo: qué queremos saber
  add column if not exists audience text,          -- a quién le importa (marcas, prensa, política)
  add column if not exists decision_rule text;     -- qué tendría que pasar para confirmarla o refutarla

alter table signal.subtheses
  add column if not exists expected text;          -- qué esperamos ver si es cierta

-- ---------- Resultados: un renglón por experimento con observaciones ----------
create or replace view signal.instrument_overview with (security_invoker = true) as
select
  o.app_slug,
  o.instrument_type,
  o.instrument_id,
  count(*) as observations,
  count(distinct o.pseudonym_id) as nodes,
  count(*) filter (where o.quality = 'trap_failed') as trap_failed,
  count(*) filter (where o.quality = 'declared_lie') as declared_lies,
  min(o.observed_at) as first_at,
  max(o.observed_at) as last_at,
  (array_agg(o.study_id) filter (where o.study_id is not null))[1] as study_id
from signal.observations o
where coalesce((o.context->>'test')::boolean, false) = false
group by o.app_slug, o.instrument_type, o.instrument_id;

-- ---------- Informes ----------
create table signal.reports (
  id uuid primary key default gen_random_uuid(),
  study_id uuid references signal.studies(id) on delete set null,
  app_slug text,
  instrument_id text,
  kind text not null check (kind in ('findings', 'black_brief', 'post', 'note')),
  title text not null check (length(title) between 1 and 200),
  body text not null default '',
  data_snapshot jsonb not null default '{}',     -- los números con los que se escribió (para poder revisarlo después)
  status text not null default 'draft' check (status in ('draft', 'final', 'published', 'archived')),
  author text not null default 'panel' check (author in ('panel', 'claude')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reports_study_idx on signal.reports (study_id, created_at desc);
create index reports_instrument_idx on signal.reports (app_slug, instrument_id, created_at desc);
create trigger reports_touch before update on signal.reports for each row execute function core.touch_updated_at();
alter table signal.reports enable row level security;
revoke all on signal.reports from public, anon, authenticated;
grant all on signal.reports to service_role;

-- ---------- Lanzar: invitación a un Drop por WhatsApp ----------
insert into messaging.templates (key, purpose, provider_name, category, body, status)
select 'drop_invite', 'Invitación a un experimento desde el panel', 'brutal_drop_invite', 'marketing',
  'Hay algo nuevo en BRUTAL: {drop}. Son unos minutos y suma Golden Tickets. Entrá acá: {link}', 'draft'
where not exists (select 1 from messaging.templates where key = 'drop_invite');

-- ---------- Mayor o menor dentro de un Drop ----------
-- La mano la reparte el servidor (el teléfono no conoce la próxima carta). Una por carta del Drop.
create table drops.hilo_hands (
  session_id uuid not null references drops.sessions(id) on delete cascade,
  position int not null check (position >= 0),
  question_id uuid not null references drops.questions(id),
  cards int[] not null,
  decisions text[] not null default '{}',
  status text not null default 'playing' check (status in ('playing', 'stood', 'busted', 'timeout')),
  multiplier numeric not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, position)
);
alter table drops.hilo_hands enable row level security;
revoke all on drops.hilo_hands from public, anon, authenticated;
grant all on drops.hilo_hands to service_role;
