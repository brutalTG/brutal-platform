-- La máquina dentro de un Drop: cartas de voz donde el jugador marca en secreto si dice la verdad o miente,
-- y al cerrar la partida la máquina acusa. El resultado queda en la sesión.
-- Además: el aviso por WhatsApp al terminar un Drop (plantilla drop_result).

alter table drops.sessions add column if not exists detector jsonb;
comment on column drops.sessions.detector is 'Resultado de la máquina en esta partida: en qué cartas mintió, a cuál acusó, veredicto y tickets.';

insert into messaging.templates (key, purpose, provider_name, category, body, status)
select 'drop_result', 'Resultado y recompensas al terminar un Drop', 'brutal_drop_result', 'utility',
  'Terminaste {drop}. {verdict}' || E'\n' || 'Ganaste {tickets} Golden Tickets y US$ {usd}.' || E'\n\n' || 'Tu perfil, tus tickets y la tabla:' || E'\n' || '{link}' || E'\n\n' || 'El link es tuyo, no lo pases.', 'draft'
where not exists (select 1 from messaging.templates where key = 'drop_result');
