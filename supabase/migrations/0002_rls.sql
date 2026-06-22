-- 0002_rls.sql
-- Row-Level Security: consent is enforced in the DATABASE, not just app code.
--
-- Policy summary:
--   birth_data, charts          -> strictly owner-only (most sensitive raw data)
--   gift_profiles, profiles,    -> owner can do everything; others can SELECT
--   offerings                      only with an active consent grant from the owner
--   consents                    -> a user manages only the grants they granted
--   constellations / members /  -> visible to the constellation owner and its members
--     reads                        (owner writes)
--   framework_versions          -> world-readable reference; writable by service role only
--
-- Note: PostgreSQL permissive policies are OR'd together. Helper functions used
-- inside policies are SECURITY DEFINER so they bypass RLS and cannot recurse.

-- ---------------------------------------------------------------------------
-- Helper functions (defined BEFORE any policy references them)
-- ---------------------------------------------------------------------------

-- True iff `target` has an active (non-revoked) consent grant to `viewer`.
create or replace function public.has_consent(target uuid, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from consents c
    where c.granter_id = target
      and c.grantee_id = viewer
      and c.revoked_at is null
  );
$$;

-- True iff `viewer` is the owner of constellation `cid`.
create or replace function public.is_constellation_owner(cid bigint, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from constellations c
    where c.id = cid and c.owner_id = viewer
  );
$$;

-- True iff `viewer` is a member of constellation `cid`.
-- SECURITY DEFINER avoids infinite recursion when used in a policy ON
-- constellation_members itself.
create or replace function public.is_constellation_member(cid bigint, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from constellation_members m
    where m.constellation_id = cid and m.user_id = viewer
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS on every sensitive table
-- ---------------------------------------------------------------------------
alter table profiles               enable row level security;
alter table birth_data             enable row level security;
alter table charts                 enable row level security;
alter table gift_profiles          enable row level security;
alter table offerings              enable row level security;
alter table consents               enable row level security;
alter table constellations         enable row level security;
alter table constellation_members  enable row level security;
alter table constellation_reads    enable row level security;
alter table framework_versions     enable row level security;

-- ---------------------------------------------------------------------------
-- birth_data: strictly owner-only
-- ---------------------------------------------------------------------------
create policy owner_birth on birth_data
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- charts: strictly owner-only
-- ---------------------------------------------------------------------------
create policy owner_charts on charts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- gift_profiles: owner full access; consented viewers may SELECT
-- ---------------------------------------------------------------------------
create policy own_or_consented_profile on gift_profiles
  for select
  using (auth.uid() = user_id or has_consent(user_id, auth.uid()));

create policy owner_insert_gift on gift_profiles
  for insert with check (auth.uid() = user_id);
create policy owner_update_gift on gift_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy owner_delete_gift on gift_profiles
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- profiles: self + anyone with active consent may SELECT (so constellations
-- can show member display names); owner writes their own row.
-- ---------------------------------------------------------------------------
create policy own_or_consented_profile_row on profiles
  for select
  using (auth.uid() = id or has_consent(id, auth.uid()));

create policy owner_insert_profile on profiles
  for insert with check (auth.uid() = id);
create policy owner_update_profile on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy owner_delete_profile on profiles
  for delete using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- offerings: self + consented viewers may SELECT; owner writes
-- ---------------------------------------------------------------------------
create policy own_or_consented_offerings on offerings
  for select
  using (auth.uid() = user_id or has_consent(user_id, auth.uid()));

create policy owner_insert_offerings on offerings
  for insert with check (auth.uid() = user_id);
create policy owner_update_offerings on offerings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy owner_delete_offerings on offerings
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- consents: a user manages only the grants where they are the granter
-- ---------------------------------------------------------------------------
create policy manage_own_consent on consents
  for all
  using (auth.uid() = granter_id)
  with check (auth.uid() = granter_id);

-- ---------------------------------------------------------------------------
-- constellations: visible to owner + members; owner writes
-- ---------------------------------------------------------------------------
create policy read_constellation on constellations
  for select
  using (auth.uid() = owner_id or is_constellation_member(id, auth.uid()));

create policy owner_insert_constellation on constellations
  for insert with check (auth.uid() = owner_id);
create policy owner_update_constellation on constellations
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy owner_delete_constellation on constellations
  for delete using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- constellation_members: readable by the constellation owner and by members;
-- the constellation owner manages membership rows.
-- ---------------------------------------------------------------------------
create policy read_constellation_members on constellation_members
  for select
  using (
    auth.uid() = user_id
    or is_constellation_owner(constellation_id, auth.uid())
    or is_constellation_member(constellation_id, auth.uid())
  );

create policy owner_insert_members on constellation_members
  for insert with check (is_constellation_owner(constellation_id, auth.uid()));
create policy owner_update_members on constellation_members
  for update
  using (is_constellation_owner(constellation_id, auth.uid()))
  with check (is_constellation_owner(constellation_id, auth.uid()));
create policy owner_delete_members on constellation_members
  for delete using (is_constellation_owner(constellation_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- constellation_reads: readable by owner + members; owner writes
-- ---------------------------------------------------------------------------
create policy read_constellation_reads on constellation_reads
  for select
  using (
    is_constellation_owner(constellation_id, auth.uid())
    or is_constellation_member(constellation_id, auth.uid())
  );

create policy owner_insert_reads on constellation_reads
  for insert with check (is_constellation_owner(constellation_id, auth.uid()));
create policy owner_update_reads on constellation_reads
  for update
  using (is_constellation_owner(constellation_id, auth.uid()))
  with check (is_constellation_owner(constellation_id, auth.uid()));
create policy owner_delete_reads on constellation_reads
  for delete using (is_constellation_owner(constellation_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- framework_versions: public reference data.
-- World-readable; NO insert/update/delete policy => only the service_role
-- (which bypasses RLS) can write. The M0 loader uses the service key.
-- ---------------------------------------------------------------------------
create policy public_read_framework on framework_versions
  for select
  using (true);
