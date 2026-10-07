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
