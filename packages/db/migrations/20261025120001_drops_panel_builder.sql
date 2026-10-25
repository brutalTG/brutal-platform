-- Armador de experimentos del panel: guarda un Drop con su orden de cartas en un solo paso.
-- Mueve posiciones sin chocar (la unicidad de posición se verifica al final de la transacción)
-- y conserva los premios cambiados solo para este Drop.

create or replace function drops.panel_save_drop(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d uuid := (p->>'id')::uuid;
  ids uuid[] := coalesce(array(select (jsonb_array_elements_text(coalesce(p->'question_ids', '[]'::jsonb)))::uuid), '{}');
  off uuid[] := coalesce(array(select (jsonb_array_elements_text(coalesce(p->'disabled_ids', '[]'::jsonb)))::uuid), '{}');
  segs uuid[] := coalesce(array(select (jsonb_array_elements_text(coalesce(p->'segment_ids', '[]'::jsonb)))::uuid), '{}');
begin
  if d is null or coalesce(p->>'slug', '') = '' or coalesce(p->>'name', '') = '' then
    raise exception 'faltan id, slug o nombre';
  end if;
  if (select count(*) from unnest(ids)) <> (select count(distinct x) from unnest(ids) x) then
    raise exception 'una carta no puede estar dos veces en el mismo Drop';
  end if;

  insert into drops.drops (id, slug, name, status, config, segment_ids)
  values (d, p->>'slug', p->>'name', coalesce(p->>'status', 'draft'), coalesce(p->'config', '{}'::jsonb), segs)
  on conflict (id) do update
    set name = excluded.name, config = excluded.config, segment_ids = excluded.segment_ids, updated_at = now();

  delete from drops.drop_questions where drop_id = d and not (question_id = any(ids));

  insert into drops.drop_questions (drop_id, question_id, position, enabled)
  select d, q, (o - 1)::int, not (q = any(off))
  from unnest(ids) with ordinality as t(q, o)
  on conflict (drop_id, question_id) do update set position = excluded.position, enabled = excluded.enabled;
end;
$$;

revoke all on function drops.panel_save_drop(jsonb) from public, anon, authenticated;
grant execute on function drops.panel_save_drop(jsonb) to service_role;

-- Ajustes de cada app editables desde el panel. Para Drops: los textos del onboarding (config.onboarding).
alter table core.apps add column if not exists config jsonb not null default '{}';
