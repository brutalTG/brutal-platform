-- Mensajes de WhatsApp para la entrada real (landing → bot → perfil → Drop → ranking).
-- 1. El aviso al terminar un Drop deja de mencionar plata: BRUTAL paga solo con Golden Tickets.
-- 2. Plantillas que el bot usa y que producción no tenía (la base de test las tenía cargadas a mano):
--    sin ellas, "BAJA" o "RANKING" fallaban.

update messaging.templates
set body = 'Terminaste {drop}. {verdict}' || E'\n' || 'Sumaste {tickets} Golden Tickets.' || E'\n\n' || 'Tu perfil y el ranking:' || E'\n' || '{link}' || E'\n\n' || 'El link es tuyo, no lo pases.'
where key = 'drop_result';

insert into messaging.templates (key, purpose, provider_name, category, body, status)
select 'drop_result', 'Resultado y recompensas al terminar un Drop', 'brutal_drop_result', 'utility',
  'Terminaste {drop}. {verdict}' || E'\n' || 'Sumaste {tickets} Golden Tickets.' || E'\n\n' || 'Tu perfil y el ranking:' || E'\n' || '{link}' || E'\n\n' || 'El link es tuyo, no lo pases.', 'draft'
where not exists (select 1 from messaging.templates where key = 'drop_result');

insert into messaging.templates (key, purpose, provider_name, category, body, status)
select 'opt_out', 'Confirmación de baja', 'brutal_opt_out', 'utility',
  'Listo, no te escribimos más. Si querés volver, mandá DROP.', 'approved'
where not exists (select 1 from messaging.templates where key = 'opt_out');

insert into messaging.templates (key, purpose, provider_name, category, body, status)
select 'ranking', 'Tabla de la temporada', 'brutal_ranking', 'utility', '{table}', 'approved'
where not exists (select 1 from messaging.templates where key = 'ranking');
