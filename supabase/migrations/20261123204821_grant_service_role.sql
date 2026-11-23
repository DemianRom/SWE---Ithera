-- =============================================================================
-- Traveling · privilegios de tablas
--
-- En los proyectos nuevos de Supabase las tablas creadas por migraciones no reciben
-- privilegios automáticos para los roles de la Data API (anon, authenticated,
-- service_role). La pila local de la CLI sí los otorga, así que aquí se dejan
-- explícitos para que ambos entornos se comporten igual:
--
--   * service_role (secret key, solo el backend): lectura y escritura.
--   * anon y authenticated (publishable key / sesión del navegador): sin acceso.
--     Además de RLS sin políticas, ni siquiera tienen privilegios sobre las tablas.
-- =============================================================================

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Tablas y secuencias que creen migraciones futuras (ejecutadas como postgres).
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
alter default privileges in schema public
  revoke all on tables from anon, authenticated;
alter default privileges in schema public
  revoke all on sequences from anon, authenticated;
