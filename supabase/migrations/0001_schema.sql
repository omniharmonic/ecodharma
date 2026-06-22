-- 0001_schema.sql
-- EcoDharma canonical schema (Phase M2: data model + consent).
-- Applied in lexical order by `supabase db reset`.
-- RLS is enabled in 0002_rls.sql; this file only defines structure + triggers.

-- ---------------------------------------------------------------------------
-- Core identity / profile
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  bioregion text,
  pronouns text,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table birth_data (
  user_id uuid primary key references auth.users on delete cascade,
  birth_date date not null,
  birth_time time,
  lat double precision not null,
  lng double precision not null,
  tz_str text not null,
  unknown_time boolean default false
);

create table charts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  modality text not null,
  raw_json jsonb not null,
  engine_version text not null,
  computed_at timestamptz default now(),
  unique (user_id, modality)
);

create table gift_profiles (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  framework_version text not null,
  voice_version text not null,
  content_json jsonb not null,
  status text default 'ready',
  generated_at timestamptz default now()
);

create table offerings (
  user_id uuid primary key references auth.users on delete cascade,
  skills text[] default '{}',
  offerings text[] default '{}',
  availability text
);

-- ---------------------------------------------------------------------------
-- Consent + constellations (groups)
-- ---------------------------------------------------------------------------
create table consents (
  id bigint generated always as identity primary key,
  granter_id uuid not null references auth.users on delete cascade,
  grantee_id uuid references auth.users on delete cascade,
  constellation_id bigint,
  scope text not null default 'constellation',
  granted_at timestamptz default now(),
  revoked_at timestamptz
);

create table constellations (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users on delete cascade,
  name text,
  type text not null default 'group',
  created_at timestamptz default now()
);

create table constellation_members (
  constellation_id bigint references constellations on delete cascade,
  user_id uuid references auth.users on delete cascade,
  consent_id bigint references consents,
  role text,
  primary key (constellation_id, user_id)
);

create table constellation_reads (
  id bigint generated always as identity primary key,
  constellation_id bigint references constellations on delete cascade,
  framework_version text not null,
  content_json jsonb not null,
  generated_at timestamptz default now()
);

create table framework_versions (
  version text primary key,
  artifact_json jsonb not null,
  changelog text,
  published_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- Fast lookup of active (non-revoked) consent grants. Used by has_consent().
create index consents_active_grant_idx
  on consents (granter_id, grantee_id)
  where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Auto-provision a profiles row for every new auth user.
-- Standard Supabase handle_new_user() pattern.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
