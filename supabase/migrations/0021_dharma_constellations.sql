-- 0021_dharma_constellations.sql — EcoDharma v4: Dharma Constellations.
-- Constellations become co-arising bodies: typed roles (kin, witness,
-- accountability, mentor, collaborator), a SHARED prayer and works, reflections
-- OFFERED (as revocable excerpt copies — never pointers to the private journal),
-- witness notes, and accountability visibility (ritual completion, not content).
--
-- Everything cross-person is gated on ACTIVE CONSENT inside the constellation
-- (is_consented_member), reusing the 0019 model. Idempotent.

-- True iff `viewer` is an actively-consented (non-revoked) member of `cid`.
create or replace function public.is_consented_member(cid bigint, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from constellation_members m
    join consents c on c.id = m.consent_id and c.revoked_at is null
    where m.constellation_id = cid and m.user_id = viewer
  );
$$;

alter table constellation_members add column if not exists dharma_role text not null default 'kin';
alter table constellations add column if not exists kind text not null default 'pod';  -- pod | dharma

-- A member sets their OWN role (RLS on constellation_members is owner-write in
-- 0002), so expose a narrow definer function instead of widening the policy.
drop function if exists public.set_my_dharma_role(bigint, text);
create or replace function public.set_my_dharma_role(cid bigint, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_role not in ('kin','witness','accountability','mentor','collaborator') then
    raise exception 'invalid role %', new_role;
  end if;
  update constellation_members set dharma_role = new_role
   where constellation_id = cid and user_id = auth.uid();
end $$;

create table if not exists offerings_shared (
  id               bigint generated always as identity primary key,
  reflection_id    bigint not null references reflections on delete cascade,
  user_id          uuid not null references auth.users on delete cascade,
  constellation_id bigint not null references constellations on delete cascade,
  excerpt_enc      bytea not null,
  offered_at       timestamptz not null default now(),
  revoked_at       timestamptz
);
create index if not exists offerings_shared_c_idx on offerings_shared (constellation_id, offered_at desc);

create table if not exists witness_notes (
  id               bigint generated always as identity primary key,
  from_user        uuid not null references auth.users on delete cascade,
  to_user          uuid not null references auth.users on delete cascade,
  constellation_id bigint not null references constellations on delete cascade,
  offering_id      bigint references offerings_shared on delete cascade,
  body_enc         bytea not null,
  created_at       timestamptz not null default now()
);
create index if not exists witness_to_idx on witness_notes (to_user, created_at desc);

create table if not exists constellation_altar (
  id               bigint generated always as identity primary key,
  constellation_id bigint not null references constellations on delete cascade,
  kind             text not null check (kind in ('prayer','work')),
  lineage_id       bigint,
  version          int not null default 1,
  title            text not null,
  created_by       uuid not null references auth.users on delete cascade,
  created_at       timestamptz not null default now(),
  superseded_at    timestamptz
);
create index if not exists constellation_altar_idx on constellation_altar (constellation_id, kind) where superseded_at is null;

alter table offerings_shared    enable row level security;
alter table witness_notes       enable row level security;
alter table constellation_altar enable row level security;

drop policy if exists offerings_owner on offerings_shared;
create policy offerings_owner on offerings_shared for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_consented_member(constellation_id, auth.uid()));
drop policy if exists offerings_members_read on offerings_shared;
create policy offerings_members_read on offerings_shared for select to authenticated
  using (revoked_at is null
         and public.is_consented_member(constellation_id, auth.uid())
         and public.is_consented_member(constellation_id, user_id));

drop policy if exists witness_write on witness_notes;
create policy witness_write on witness_notes for insert to authenticated
  with check (from_user = auth.uid()
              and public.is_consented_member(constellation_id, auth.uid())
              and public.is_consented_member(constellation_id, to_user));
drop policy if exists witness_read on witness_notes;
create policy witness_read on witness_notes for select to authenticated
  using (to_user = auth.uid() or from_user = auth.uid());

drop policy if exists calt_read on constellation_altar;
create policy calt_read on constellation_altar for select to authenticated
  using (public.is_consented_member(constellation_id, auth.uid()));
drop policy if exists calt_write on constellation_altar;
create policy calt_write on constellation_altar for insert to authenticated
  with check (created_by = auth.uid() and public.is_consented_member(constellation_id, auth.uid()));
drop policy if exists calt_supersede on constellation_altar;
create policy calt_supersede on constellation_altar for update to authenticated
  using (public.is_consented_member(constellation_id, auth.uid()));

-- Accountability: partners (both role 'accountability', both consented in the
-- same constellation) may see each other's ritual COMPLETIONS — cadence + when,
-- never content.
-- (Uses auth.uid() — a caller can only ever see their OWN partners.)
drop function if exists public.accountability_completions(uuid, timestamptz);
create or replace function public.accountability_completions(since timestamptz)
returns table (user_id uuid, display_name text, constellation_id bigint, cadence text, completed_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.user_id, p.display_name, mv.constellation_id, r.cadence, refl.created_at
    from constellation_members mv
    join consents cv on cv.id = mv.consent_id and cv.revoked_at is null
    join constellation_members mt on mt.constellation_id = mv.constellation_id and mt.user_id <> mv.user_id
    join consents ct on ct.id = mt.consent_id and ct.revoked_at is null
    join rituals r on r.user_id = mt.user_id and r.completed_reflection_id is not null
    join reflections refl on refl.id = r.completed_reflection_id
    join profiles p on p.id = mt.user_id
   where mv.user_id = auth.uid()
     and mv.dharma_role = 'accountability' and mt.dharma_role = 'accountability'
     and refl.created_at >= since
   order by refl.created_at desc;
$$;

grant select, insert, update, delete on offerings_shared, witness_notes, constellation_altar to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on function public.is_consented_member(bigint, uuid) to authenticated, service_role;
grant execute on function public.set_my_dharma_role(bigint, text) to authenticated, service_role;
grant execute on function public.accountability_completions(timestamptz) to authenticated, service_role;
