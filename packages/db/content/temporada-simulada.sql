-- Tabla simulada para la primera prueba: 30 jugadores que no existen, con puntajes creíbles (nadie arriba de 700).
-- Son nodos archivados (no aparecen en el listado ni reciben lanzamientos) y sus tickets entran a la temporada activa.
-- Se borran con: delete from economy.ledger where activity = 'simulado'; delete from core.nodes where acquisition_channel = 'simulado';

begin;

create temp table sim_players (n int, nick text, tickets int) on commit drop;
insert into sim_players values
  (1, 'fede.exe', 690), (2, 'lu_', 655), (3, 'valen', 610), (4, 'joaco', 580), (5, 'pipi', 540),
  (6, 'martu', 520), (7, 'tomi.k', 495), (8, 'sofiwww', 470), (9, 'elnegro', 450), (10, 'ramaaa', 430),
  (11, 'cande', 410), (12, 'mili_b', 395), (13, 'franco_', 370), (14, 'agus', 350), (15, 'flor.v', 330),
  (16, 'juanse', 310), (17, 'lolo', 295), (18, 'iñaki', 280), (19, 'maite', 260), (20, 'benja', 240),
  (21, 'delfi', 225), (22, 'pilu', 210), (23, 'santi.g', 190), (24, 'gonza', 170), (25, 'cata', 150),
  (26, 'vicky', 130), (27, 'lauti', 110), (28, 'nico.p', 90), (29, 'mora', 65), (30, 'tute', 40);

insert into core.nodes (phone_e164, status, nickname, birth_date, province, acquisition_channel, archived_at, created_at, last_active_at)
select '+549000000' || lpad((1000 + n)::text, 4, '0'), 'archived', nick, date '2003-06-01' + (n * 37), 'CABA', 'simulado', now(),
  now() - ((n % 9) + 1) * interval '1 day', now() - (n % 5) * interval '1 day'
from sim_players
on conflict (phone_e164) do nothing;

insert into economy.ledger (node_id, season_id, currency, amount, app_slug, activity, source_type, source_id, idempotency_key, created_by)
select nd.id, s.id, 'tickets', p.tickets, 'drops', 'simulado', 'seed', 'temporada-simulada', 'sim:' || s.slug || ':' || p.n, 'admin'
from sim_players p
join core.nodes nd on nd.phone_e164 = '+549000000' || lpad((1000 + p.n)::text, 4, '0')
join economy.seasons s on s.status = 'active'
on conflict (idempotency_key) do nothing;

commit;
