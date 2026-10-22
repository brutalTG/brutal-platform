-- SOLO TEST (brutal-sandbox). Borra los datos simulados y deja el contenido real del detector.
-- No correr nunca en producción.
-- Se pega en Supabase → SQL Editor del proyecto brutal-sandbox y se ejecuta entero.

begin;

-- Guardia: si esta base tiene números que no son de prueba, no hace nada.
do $$
begin
  if exists (select 1 from core.nodes where phone_e164 not like '+54911555%') then
    raise exception 'Hay nodos que no son de prueba. No borro nada.';
  end if;
end $$;

-- Personas y todo lo que hicieron (sesiones, observaciones, tickets, mensajes, links).
truncate core.nodes cascade;
truncate core.audit_log;

-- Contenido simulado.
truncate drops.drop_questions, drops.drops, drops.questions cascade;
delete from pressure.experiments where slug <> 'detector-001';
delete from signal.studies where slug <> 'libertad-estructura';
truncate profile.dimensions cascade;
truncate economy.reward_rules;
delete from messaging.templates where key not in ('pressure_invite', 'pressure_result', 'ranking', 'opt_out');

commit;

select
  (select count(*) from core.nodes) as nodos,
  (select count(*) from signal.observations) as observaciones,
  (select count(*) from pressure.items) as preguntas_detector,
  (select count(*) from economy.seasons where status = 'active') as temporada_activa;
