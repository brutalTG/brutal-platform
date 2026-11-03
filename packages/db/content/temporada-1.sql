-- Temporada 1 de producción: el ranking se cierra cada dos semanas.
-- Del 3 al 17 de noviembre de 2026 (cierra el 17 a las 23:59, hora de Buenos Aires). Sin premios cargados.
-- Idempotente: si ya existe, no hace nada. Correr antes de cargar el contenido de un Drop.

insert into economy.seasons (slug, name, starts_at, ends_at, status, prizes)
select 'temporada-1', 'Temporada 1', '2026-11-03T00:00:00-03:00', '2026-11-17T23:59:59-03:00', 'active', '[]'::jsonb
where not exists (select 1 from economy.seasons where slug = 'temporada-1')
  and not exists (select 1 from economy.seasons where status = 'active');
