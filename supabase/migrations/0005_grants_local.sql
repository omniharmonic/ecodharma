-- LOCAL-DEV ONLY. Grants table privileges to the authenticated/anon/service_role
-- roles so the app can `SET ROLE authenticated` and have RLS apply (RLS still
-- constrains rows; grants only allow the role to attempt access). On real Supabase
-- these grants are managed by the platform.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to authenticated, service_role;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public
  to authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
