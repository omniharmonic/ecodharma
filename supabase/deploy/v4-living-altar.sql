-- EcoDharma v4 — The Living Altar: production migration bundle.
-- Paste into the Supabase SQL editor and run once. Safe to re-run (idempotent).
-- Contains 0020_living_altar, 0021_dharma_constellations, 0022_dharma_inquiry.
begin;

-- ===== supabase/migrations/0020_living_altar.sql =====
-- 0020_living_altar.sql — EcoDharma v4 "The Living Altar".
-- See docs/v4-living-altar/TECHNICAL_ARCHITECTURE.md §3.
--
-- The altar (prayer, devotions, roots, paths, measures, inquiries, threads) is
-- typed + VERSIONED: a revision appends a new row with the same lineage_id and
-- marks the old one superseded — tree rings, never overwrites. Reflections and
-- every intimate free-text field are ENCRYPTED at rest by the app (bytea
-- envelopes, lib/crypto.ts); titles stay plaintext for display/matching.
--
-- RLS: strictly OWNER-ONLY on every table here. Cross-person visibility
-- (constellation offerings) arrives in 0021 via explicit consent-gated copies.
-- Idempotent.

-- ---------------------------------------------------------------- the altar --
create table if not exists altar_elements (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references auth.users on delete cascade,
  kind              text not null check (kind in
                    ('prayer','devotion','root','work','practice','measure','inquiry','thread')),
  lineage_id        bigint,                       -- = id of the first version
  version           int  not null default 1,
  title             text not null,
  body_enc          bytea,
  facets            jsonb not null default '{}'::jsonb,
  status            text not null default 'active',
  constitution_refs jsonb not null default '[]'::jsonb,
  external_refs     jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  superseded_at     timestamptz,
  retired_at        timestamptz
);
create index if not exists altar_elements_live_idx
  on altar_elements (user_id, kind) where superseded_at is null;
create index if not exists altar_elements_lineage_idx on altar_elements (lineage_id, version);

create table if not exists element_links (
  user_id      uuid not null references auth.users on delete cascade,
  from_lineage bigint not null,
  to_lineage   bigint not null,
  relation     text not null,                      -- serves | grounds | uses | measures | questions
  created_at   timestamptz not null default now(),
  primary key (from_lineage, to_lineage, relation)
);

create table if not exists element_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users on delete cascade,
  lineage_id bigint not null,
  event      text not null,                        -- created | revised | status:<s> | composted | renewed
  note_enc   bytea,
  at         timestamptz not null default now()
);
create index if not exists element_events_idx on element_events (user_id, lineage_id, at);

-- Proposed changes to core elements (from Claude/MCP). The person accepts in the
-- app — "the person holds the pen".
create table if not exists altar_proposals (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users on delete cascade,
  lineage_id  bigint,                               -- null = propose a NEW element
  kind        text not null,
  change      jsonb not null,                       -- {title?, body?, status?, facets?}
  rationale   text,
  source      text not null default 'mcp',
  status      text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);

-- ------------------------------------------------------------------ journal --
create table if not exists reflections (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users on delete cascade,
  cadence     text not null default 'spontaneous',
  depth       smallint not null default 1 check (depth between 1 and 3),
  source      text not null default 'web',          -- web | telegram | mcp | email
  body_enc    bytea not null,
  evidence    jsonb not null default '[]'::jsonb,
  ritual_id   bigint,
  created_at  timestamptz not null default now()
);
create index if not exists reflections_user_idx on reflections (user_id, created_at desc);

create table if not exists strands (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users on delete cascade,
  reflection_id bigint not null references reflections on delete cascade,
  lineage_id    bigint not null,
  relation      text not null check (relation in
                ('embodies','strains','questions','evidences','nourishes','releases','discovers')),
  charge        smallint not null default 0 check (charge between -2 and 2),
  quote_enc     bytea,
  proposed_by   text not null default 'det',        -- claude | det | person
  status        text not null default 'proposed' check (status in ('proposed','confirmed','rejected')),
  created_at    timestamptz not null default now()
);
create index if not exists strands_user_idx on strands (user_id, status, created_at);
create index if not exists strands_lineage_idx on strands (lineage_id);

create table if not exists alignment_readings (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users on delete cascade,
  reflection_id bigint not null references reflections on delete cascade,
  lineage_id    bigint,                              -- null = overall
  lens          text not null,                       -- aliveness|fidelity|constitution|reciprocity|fruit|measure:<lineage>
  value         smallint check (value between 1 and 5),
  note_enc      bytea,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------------- cycles --
create table if not exists ritual_prefs (
  user_id     uuid primary key references auth.users on delete cascade,
  weekly_dow  smallint not null default 0 check (weekly_dow between 0 and 6),  -- 0 = Sunday
  local_hour  smallint not null default 18 check (local_hour between 0 and 23),
  tz          text not null default 'UTC',
  channels    text[] not null default '{email}',
  lunar       boolean not null default false,
  hemisphere  text not null default 'N' check (hemisphere in ('N','S')),
  updated_at  timestamptz not null default now()
);

create table if not exists rituals (
  id                      bigint generated always as identity primary key,
  user_id                 uuid not null references auth.users on delete cascade,
  cadence                 text not null,
  depth                   smallint not null,
  due_at                  timestamptz not null,
  threshold_label         text,
  invited_at              timestamptz,
  completed_reflection_id bigint,
  created_at              timestamptz not null default now(),
  unique (user_id, cadence, due_at)
);
create index if not exists rituals_due_idx on rituals (user_id, due_at desc);

create table if not exists ritual_thresholds (
  year        int  not null,
  hemisphere  text not null,
  kind        text not null,                          -- season | new_moon | full_moon
  label       text not null,
  at          timestamptz not null,
  primary key (year, hemisphere, kind, at)
);

-- Invitations replace `nudges` (kept read-only for history).
create table if not exists invitations (
  id                   bigint generated always as identity primary key,
  user_id              uuid not null references auth.users on delete cascade,
  ritual_id            bigint,
  cadence              text not null default 'weekly',
  channel              text not null,                 -- email | telegram | web
  body                 text not null,
  refs                 jsonb not null default '[]'::jsonb,
  engine               text not null,                 -- claude | det
  contract             jsonb,
  platform_message_id  text,
  delivered            boolean not null default false,
  sent_at              timestamptz not null default now(),
  reply_reflection_id  bigint
);
create index if not exists invitations_user_idx on invitations (user_id, sent_at desc);
create index if not exists invitations_platform_idx on invitations (channel, platform_message_id);

-- ---------------------------------------------------------------------- RLS --
do $$
declare t text;
begin
  foreach t in array array['altar_elements','element_links','element_events','altar_proposals',
                           'reflections','strands','alignment_readings','ritual_prefs','rituals','invitations']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_owner', t);
    execute format(
      'create policy %I on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_owner', t);
  end loop;
end $$;

-- Thresholds are public astronomical facts.
alter table ritual_thresholds enable row level security;
drop policy if exists ritual_thresholds_read on ritual_thresholds;
create policy ritual_thresholds_read on ritual_thresholds for select to authenticated, anon using (true);

grant select, insert, update, delete on
  altar_elements, element_links, element_events, altar_proposals, reflections, strands,
  alignment_readings, ritual_prefs, rituals, invitations
  to authenticated, service_role;
grant select on ritual_thresholds to authenticated, anon;
grant select, insert, update, delete on ritual_thresholds to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- ===== supabase/migrations/0021_dharma_constellations.sql =====
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

-- ===== supabase/migrations/0022_dharma_inquiry.sql =====
-- 0022_dharma_inquiry.sql — v4.1: the Dharma Inquiry (after Daniel Schmachtenberger)
-- and the Dharma Journey. Answers are SEALED (encrypted by the app) like the
-- journal. Adds the 'capacity' element kind (Becoming). Element MODE (being /
-- doing / becoming) and root SCOPE (universal / unique) live in facets. Idempotent.

create table if not exists dharma_inquiry (
  user_id     uuid not null references auth.users on delete cascade,
  chamber     text not null,
  question_id text not null,
  answer_enc  bytea not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, question_id)
);

create table if not exists journey_progress (
  user_id      uuid not null references auth.users on delete cascade,
  stage        text not null,
  completed_at timestamptz not null default now(),
  note_enc     bytea,
  primary key (user_id, stage)
);

alter table altar_elements drop constraint if exists altar_elements_kind_check;
alter table altar_elements add constraint altar_elements_kind_check
  check (kind in ('prayer','devotion','root','work','practice','measure','inquiry','thread','capacity'));

do $$
declare t text;
begin
  foreach t in array array['dharma_inquiry','journey_progress'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_owner', t);
    execute format('create policy %I on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_owner', t);
  end loop;
end $$;

grant select, insert, update, delete on dharma_inquiry, journey_progress to authenticated, service_role;

commit;
