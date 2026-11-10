-- Mercados de predicción (tipo Polymarket) dentro de los Drops.
-- 1. Una apuesta queda en signal.observations como kind 'bet' (opción, tickets, precio).
-- 2. Al cerrar la partida, cada mercado se resuelve contra el club (real + simulado) y queda en drops.sessions.markets;
--    el cobro suma la ganancia o pérdida de cada apuesta.

alter table signal.observations drop constraint observations_kind_check;
alter table signal.observations add constraint observations_kind_check
  check (kind in ('choice', 'ranking', 'scale', 'text', 'voice', 'game_move', 'behavior', 'declared', 'bet'));

alter table drops.sessions add column if not exists markets jsonb;
comment on column drops.sessions.markets is 'Mercados de esta partida ya resueltos: qué compró, a qué precio, quién ganó en el club, cuánto cobró (net = cobro − apuesta).';
