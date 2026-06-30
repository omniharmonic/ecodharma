-- 0009_grants_prod.sql
-- Make the bare-Postgres / managed-Postgres (Neon) deploy behave like hosted
-- Supabase, where the connecting role may already assume authenticated/anon.
--
-- On a local cluster the app connects as the superuser `postgres`, which can
-- `SET ROLE` to anything without explicit membership. On managed Postgres there
-- is NO superuser — the app connects as the database owner (e.g. neondb_owner),
-- which must be granted MEMBERSHIP in these roles before `SET LOCAL ROLE
-- authenticated` (the consent gate in db.ts withUser) will succeed.
--
-- Granting to the current role is a harmless no-op locally (postgres already has
-- every privilege) and the load-bearing grant in production.
do $$
begin
  execute format('grant anon, authenticated, service_role to %I', current_user);
end $$;
