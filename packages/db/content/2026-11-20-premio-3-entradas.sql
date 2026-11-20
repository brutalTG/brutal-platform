-- El premio real de "Tu tribu": 3 entradas de 1 día (no un abono de 3 días).
update drops.drops
set config = jsonb_set(config, '{reveal,prize,lines}', '["3 ENTRADAS DE 1 DÍA"]'::jsonb), updated_at = now()
where slug = 'tribu';
