-- Vistas de lectura para el panel. Agregan sin duplicar datos.

create view core.node_overview with (security_invoker = true) as
select
  n.id,
  n.nickname,
  n.phone_e164,
  n.status,
  f.age,
  f.is_minor,
  n.gender,
  n.province,
  n.city,
  n.acquisition_channel,
  n.created_at,
  n.last_active_at,
  p.pseudonym_id,
  coalesce(b.tickets, 0) as tickets,
  coalesce(b.cash_usd, 0) as cash_usd,
  (select count(*) from drops.sessions s where s.pseudonym_id = p.pseudonym_id) as drop_sessions,
  (select count(*) from pressure.sessions s where s.pseudonym_id = p.pseudonym_id) as pressure_sessions,
  (select count(*) from signal.observations o where o.pseudonym_id = p.pseudonym_id) as observations,
  (select count(*) from profile.traits t where t.node_id = n.id) as traits
from core.nodes n
join core.node_facts f on f.id = n.id
left join core.node_pseudonyms p on p.node_id = n.id
left join economy.balances b on b.node_id = n.id;

create view drops.drop_overview with (security_invoker = true) as
select
  d.id,
  d.slug,
  d.name,
  d.status,
  d.version,
  d.opens_at,
  d.closes_at,
  d.published_at,
  st.name as study_name,
  st.slug as study_slug,
  (select count(*) from drops.drop_questions dq where dq.drop_id = d.id and dq.enabled) as questions,
  count(s.id) as sessions,
  count(s.id) filter (where s.status = 'completed') as completed,
  count(s.id) filter (where s.status = 'abandoned') as abandoned,
  case when count(s.id) = 0 then null
       else round(100.0 * count(s.id) filter (where s.status = 'completed') / count(s.id), 1) end as completion_rate,
  round(avg(s.total_ms) filter (where s.status = 'completed')) as avg_total_ms
from drops.drops d
left join signal.studies st on st.id = d.study_id
left join drops.sessions s on s.drop_id = d.id
group by d.id, st.name, st.slug;

-- Embudo por carta: cuántos llegaron a responder cada posición.
create view drops.card_funnel with (security_invoker = true) as
select
  dq.drop_id,
  dq.position,
  q.id as question_id,
  q.label,
  q.format,
  q.card_type,
  count(o.id) as answered,
  round(avg(o.latency_ms)) as avg_latency_ms,
  count(o.id) filter (where o.quality = 'trap_failed') as trap_failed
from drops.drop_questions dq
join drops.questions q on q.id = dq.question_id
join drops.drops d on d.id = dq.drop_id
left join signal.observations o
  on o.app_slug = 'drops' and o.instrument_id = d.slug and o.stimulus_id = q.id::text
group by dq.drop_id, dq.position, q.id;

create view pressure.experiment_overview with (security_invoker = true) as
select
  e.id,
  e.slug,
  e.name,
  e.series,
  e.format,
  e.status,
  e.max_duration_s,
  st.name as study_name,
  st.slug as study_slug,
  (select count(*) from pressure.agents a where a.experiment_id = e.id) as agents,
  count(s.id) as sessions,
  count(s.id) filter (where s.status = 'completed') as completed,
  count(s.id) filter (where s.status = 'interrupted') as interrupted,
  round(avg(s.duration_s) filter (where s.status = 'completed')) as avg_duration_s,
  max(s.started_at) as last_session_at
from pressure.experiments e
left join signal.studies st on st.id = e.study_id
left join pressure.sessions s on s.experiment_id = e.id
group by e.id, st.name, st.slug;

create view signal.study_overview with (security_invoker = true) as
select
  st.id,
  st.slug,
  st.name,
  st.thesis,
  st.status,
  st.updated_at,
  (select count(*) from signal.subtheses x where x.study_id = st.id) as subtheses,
  (select count(*) from drops.drops d where d.study_id = st.id) as drops,
  (select count(*) from pressure.experiments e where e.study_id = st.id) as experiments,
  (select count(*) from signal.observations o where o.study_id = st.id) as observations,
  (select count(distinct o.pseudonym_id) from signal.observations o where o.study_id = st.id) as nodes_reached
from signal.studies st;

-- Una fila con los números de la pantalla Hoy.
create view core.ops_kpis with (security_invoker = true) as
select
  (select count(*) from core.nodes where status = 'active') as active_nodes,
  (select count(*) from core.nodes where created_at > now() - interval '7 days') as new_nodes_7d,
  (select count(*) from core.nodes where status = 'pending') as pending_nodes,
  (select count(*) from signal.observations where observed_at > now() - interval '7 days') as observations_7d,
  (select count(*) from drops.drops where status = 'live') as live_drops,
  (select count(*) from pressure.sessions where started_at > now() - interval '7 days') as pressure_sessions_7d,
  (select count(*) from pressure.sessions where status = 'interrupted' and started_at > now() - interval '7 days') as pressure_interrupted_7d,
  (select count(*) from economy.withdrawals where status = 'pending') as pending_withdrawals,
  (select count(*) from messaging.templates where status = 'rejected') as rejected_templates;

grant select on core.node_overview, drops.drop_overview, drops.card_funnel, pressure.experiment_overview,
  signal.study_overview, core.ops_kpis to service_role;
