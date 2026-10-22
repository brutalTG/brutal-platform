-- Seguridad: el navegador nunca habla con la base. Todo pasa por un servidor con service_role.
-- RLS activado en todas las tablas y sin políticas para anon/authenticated = sin acceso.

do $$
declare
  s text;
  t record;
begin
  foreach s in array array['core', 'signal', 'profile', 'economy', 'messaging', 'drops', 'pressure'] loop
    execute format('revoke all on schema %I from public, anon, authenticated', s);
    execute format('grant usage on schema %I to service_role', s);
    execute format('revoke all on all tables in schema %I from public, anon, authenticated', s);
    execute format('revoke all on all sequences in schema %I from public, anon, authenticated', s);
    execute format('revoke all on all functions in schema %I from public, anon, authenticated', s);
    execute format('grant all on all tables in schema %I to service_role', s);
    execute format('grant all on all sequences in schema %I to service_role', s);
    execute format('grant execute on all functions in schema %I to service_role', s);
    execute format('alter default privileges in schema %I revoke all on tables from public, anon, authenticated', s);
    execute format('alter default privileges in schema %I grant all on tables to service_role', s);
    for t in select tablename from pg_tables where schemaname = s loop
      execute format('alter table %I.%I enable row level security', s, t.tablename);
    end loop;
  end loop;
end $$;

-- Las vistas corren con los permisos de quien consulta, no de su dueño.
alter view core.node_facts set (security_invoker = true);
alter view economy.balances set (security_invoker = true);
alter view economy.season_tickets set (security_invoker = true);
