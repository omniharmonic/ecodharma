-- 0010_app_config.sql
-- Admin-flippable GLOBAL runtime config (no redeploy). Two knobs:
--   interpreter_mode   'claude' (default) | 'fixture' — the reading engine
--   access_password_*  a single shared site password gating signup in claude mode
--
-- Singleton: the `id boolean primary key default true check (id)` trick allows
-- exactly one row (id can only ever be true). Read/written via the service role
-- only (like unlock_codes) — never exposed to authenticated users directly.

create table if not exists app_config (
  id boolean primary key default true check (id),
  interpreter_mode text not null default 'claude' check (interpreter_mode in ('claude','fixture')),
  access_password_hash text,
  updated_at timestamptz not null default now()
);

insert into app_config (id) values (true) on conflict (id) do nothing;

alter table app_config enable row level security;
-- No policies => only the service role (bypasses RLS via ownership) touches it.
grant select, insert, update on app_config to service_role;
