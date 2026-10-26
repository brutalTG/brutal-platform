-- Datos sintéticos SOLO para el entorno de test. Nunca correr en producción.
-- Todos los teléfonos son +54 9 11 5550 xxxx y los apodos empiezan con "test-".

do $$
begin
  if exists (select 1 from core.nodes where phone_e164 not like '+54911555%') then
    raise exception 'la base tiene nodos reales; este seed es solo para test';
  end if;
end $$;

-- Nodos
insert into core.nodes (phone_e164, phone_verified_at, status, nickname, birth_date, gender, province, city, acquisition_channel, created_at, last_active_at)
select
  '+54911555' || lpad(g::text, 5, '0'),
  now() - (g || ' days')::interval,
  (array['active','active','active','active','pending','waitlisted','blocked'])[1 + (g % 7)],
  'test-' || g,
  date '2002-01-01' + ((g * 97) % 3600),
  (array['mujer','varón','no binario','mujer','varón'])[1 + (g % 5)],
  (array['CABA','Buenos Aires','Córdoba','Santa Fe','Mendoza','Tucumán'])[1 + (g % 6)],
  (array['Palermo','La Matanza','Córdoba','Rosario','Godoy Cruz','San Miguel'])[1 + (g % 6)],
  (array['whatsapp','referido','tiktok','instagram'])[1 + (g % 4)],
  now() - ((90 - g % 90) || ' days')::interval,
  now() - ((g % 20) || ' hours')::interval
from generate_series(1, 120) g
on conflict (phone_e164) do nothing;

insert into core.consents (node_id, purpose, evidence_source)
select id, 'whatsapp_messages', 'seed' from core.nodes where status = 'active'
on conflict do nothing;

-- Estudio
insert into signal.studies (slug, name, thesis, status) values
  ('arriba-o-al-lado', 'Arriba o al lado', 'Lo que ordena la percepción no es de quién es una organización, sino si adentro hay alguien que decide si entrás.', 'field'),
  ('cultura', 'Cultura', 'Estudio permanente para lo que no responde a una tesis puntual.', 'field')
on conflict (slug) do nothing;

insert into signal.subtheses (study_id, code, statement, position)
select s.id, x.code, x.statement, x.pos from signal.studies s,
  (values ('ST1', 'La libertad sin tutela se vive como abandono', 1),
          ('ST2', 'El precio de la autonomía es visible y alto', 2),
          ('ST3', 'El juez invisible pesa más que el jefe visible', 3),
          ('ST4', 'Nadie ataja cuando algo sale mal', 4)) as x(code, statement, pos)
where s.slug = 'arriba-o-al-lado'
on conflict do nothing;

-- Perfil
insert into profile.dimensions (slug, name, description, value_type, categories, stability) values
  ('preferencia_estructura', 'Libertad o estructura', 'Hacia dónde se inclina cuando tiene que elegir.', 'category', '["libertad","estructura","depende"]', 'evolving'),
  ('red_de_contencion', 'Quién lo ataja', 'A quién nombra cuando algo sale mal.', 'category', '["familia","estado","nadie","uno mismo"]', 'evolving'),
  ('modelo_heredado', 'Trabajo de los padres', 'Estado, empresa, por su cuenta o changas.', 'category', '["estado","empresa","propia","changas"]', 'stable')
on conflict (slug) do nothing;

-- Economía
insert into economy.seasons (slug, name, starts_at, ends_at, status, prizes) values
  ('t1-2026', 'Temporada 1 · 2026', now() - interval '20 days', now() + interval '40 days', 'active',
   '[{"rank":1,"prize":"USD 100"},{"rank":2,"prize":"USD 50"},{"rank":3,"prize":"USD 25"},{"rank":4,"prize":"Entradas"},{"rank":5,"prize":"Merch"}]')
on conflict (slug) do nothing;

insert into economy.reward_rules (app_slug, activity, adult_currency, adult_amount, minor_tickets) values
  ('drops', 'question_answered', 'tickets', 10, 10),
  ('drops', 'drop_completed', 'cash_usd', 0.5, 50),
  ('pressure', 'session_completed', 'tickets', 80, 80)
on conflict do nothing;

-- Drops
insert into drops.drops (slug, name, study_id, season_id, status, opens_at, closes_at, published_at)
select 'drop-025', 'Drop 025 · Arriba o al lado', s.id, se.id, 'live', now() - interval '3 days', now() + interval '4 days', now() - interval '3 days'
from signal.studies s, economy.seasons se where s.slug = 'arriba-o-al-lado' and se.slug = 't1-2026'
on conflict (slug) do nothing;

insert into drops.questions (format, label, content, card_type, status, timer_s)
select 'binary', 'Carta ' || g,
  jsonb_build_object('prompt', 'Pregunta de prueba ' || g, 'options', jsonb_build_array('A', 'B')),
  case when g = 6 then 'trap' else 'culture' end, 'active', 15
from generate_series(1, 12) g;

insert into drops.drop_questions (drop_id, question_id, position)
select d.id, q.id, row_number() over (order by q.label) - 1
from drops.drops d, drops.questions q where d.slug = 'drop-025';

insert into drops.sessions (pseudonym_id, drop_id, drop_version, status, position, started_at, completed_at, total_ms)
select p.pseudonym_id, d.id, 1,
  case when n.nickname ~ '[05]$' then 'abandoned' else 'completed' end,
  case when n.nickname ~ '[05]$' then 7 else 12 end,
  now() - interval '2 days', case when n.nickname ~ '[05]$' then null else now() - interval '2 days' + interval '4 minutes' end, 240000
from core.nodes n join core.node_pseudonyms p on p.node_id = n.id, drops.drops d
where d.slug = 'drop-025' and n.status = 'active'
on conflict do nothing;

insert into signal.observations (pseudonym_id, app_slug, instrument_type, instrument_id, instrument_version, stimulus_id, stimulus, kind, value, value_text, latency_ms, observed_at, session_id, position, study_id, quality, idempotency_key)
select s.pseudonym_id, 'drops', 'drop', 'drop-025', '1', q.id::text, q.content, 'choice',
  jsonb_build_object('option', case when (hashtext(s.id::text || q.id::text) % 2) = 0 then 'A' else 'B' end),
  case when (hashtext(s.id::text || q.id::text) % 2) = 0 then 'A' else 'B' end,
  2000 + abs(hashtext(q.id::text || s.id::text)) % 6000,
  s.started_at + (dq.position || ' seconds')::interval * 20,
  s.id, dq.position, d.study_id,
  case when q.card_type = 'trap' and (hashtext(s.id::text) % 9) = 0 then 'trap_failed' else 'valid' end,
  'seed:' || s.id || ':' || q.id
from drops.sessions s
join drops.drops d on d.id = s.drop_id
join drops.drop_questions dq on dq.drop_id = d.id and dq.position < s.position
join drops.questions q on q.id = dq.question_id
on conflict (idempotency_key) do nothing;

-- Pressure
insert into pressure.experiments (slug, name, series, format, study_id, status, max_duration_s, definition)
select 'poligrafo-futuro-laboral', 'Polígrafo · Futuro laboral', 'Pressure', 'polygraph', s.id, 'testing', 240,
  '{"personality":{"name":"La máquina","tone":"seca, irónica, nunca cálida"},"phases":["calibración","preguntas","acusación","revelación"]}'
from signal.studies s where s.slug = 'arriba-o-al-lado'
on conflict (slug) do nothing;

insert into pressure.sessions (pseudonym_id, experiment_id, status, started_at, ended_at, duration_s, outcome)
select p.pseudonym_id, e.id,
  case when g % 5 = 0 then 'interrupted' else 'completed' end,
  now() - (g || ' hours')::interval, now() - (g || ' hours')::interval + interval '4 minutes',
  case when g % 5 = 0 then 70 else 200 + g end,
  jsonb_build_object('caught', g % 3 = 0)
from generate_series(1, 18) g
join core.nodes n on n.nickname = 'test-' || g
join core.node_pseudonyms p on p.node_id = n.id
cross join pressure.experiments e where e.slug = 'poligrafo-futuro-laboral';

-- Ledger
insert into economy.ledger (node_id, season_id, currency, amount, app_slug, activity, source_type, source_id, idempotency_key)
select n.id, se.id, 'tickets', 10 * s.position, 'drops', 'question_answered', 'drop_session', s.id::text, 'seed-ledger:' || s.id
from drops.sessions s join core.node_pseudonyms p on p.pseudonym_id = s.pseudonym_id join core.nodes n on n.id = p.node_id, economy.seasons se
where se.slug = 't1-2026'
on conflict (idempotency_key) do nothing;

-- Mensajería
insert into messaging.templates (key, purpose, provider_name, category, body, button_text, status) values
  ('drop_invitation', 'Invitar a un Drop', 'brutal_drop_invitation', 'marketing', 'Hay un Drop nuevo esperándote. Tenés hasta {{1}}.', 'Entrar', 'approved'),
  ('drop_reminder', 'Recordar un Drop sin terminar', 'brutal_drop_reminder', 'marketing', 'Te quedaste en la carta {{1}}. Seguís?', 'Seguir', 'submitted'),
  ('pressure_invitation', 'Invitar a un juego de Pressure', 'brutal_pressure_invitation', 'marketing', 'Una máquina quiere saber si podés engañarla.', 'Jugar', 'draft'),
  ('onboarding_access', 'Link de entrada al onboarding', 'brutal_onboarding_access', 'utility', 'Tu link para entrar a BRUTAL: {{1}}', 'Entrar', 'rejected')
on conflict (key) do nothing;

-- Bitácora
insert into core.audit_log (actor_type, actor_id, action, entity_type, entity_id, details, created_at) values
  ('claude', 'claude', 'propuso reemplazar una carta', 'drop', 'drop-025', '{"summary":"La carta 7 pierde al 31% de los nodos. Propongo reemplazarla por un dilema con costo explícito."}', now() - interval '2 hours'),
  ('claude', 'claude', 'detectó conversaciones cortadas', 'experiment', 'poligrafo-futuro-laboral', '{"summary":"4 de 18 conversaciones se cortaron en la misma fase: acusación."}', now() - interval '5 hours'),
  ('claude', 'claude', 'trajo frases culturales de la semana', 'study', 'cultura', '{"summary":"15 frases nuevas con fuente y fecha, listas para elegir."}', now() - interval '1 day'),
  ('system', 'system', 'plantilla rechazada por Meta', 'template', 'onboarding_access', '{"summary":"Meta rechazó la plantilla de acceso. Motivo: categoría."}', now() - interval '6 hours');
