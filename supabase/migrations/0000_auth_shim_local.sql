-- LOCAL-DEV ONLY shim. On real Supabase the `auth` schema, `auth.users`,
-- `auth.uid()`, and the anon/authenticated/service_role roles already exist —
-- this file is a no-op there (all guarded with IF NOT EXISTS / OR REPLACE).
-- It lets the same RLS migrations run against a bare local Postgres cluster,
-- with the app setting `request.jwt.claims` per request (as PostgREST does).

create extension if not exists pgcrypto;
create schema if not exists auth;

-- Columns mirror the real Supabase auth.users (subset) so the app and tests
-- insert the same shape and migration to hosted Supabase is frictionless.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid default '00000000-0000-0000-0000-000000000000',
  aud text default 'authenticated',
  role text default 'authenticated',
  email text unique,
  encrypted_password text,        -- local app-level credential (scrypt)
  email_confirmed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb
);

create or replace function auth.uid() returns uuid
  language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant usage on schema auth to anon, authenticated, service_role;
grant select, insert, update, delete on auth.users to authenticated, service_role;
