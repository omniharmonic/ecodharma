-- The growing trim-tab commons. SEEDS come from the curated framework artifact;
-- the running system accretes GENERATED trim-tabs on cache-miss for new gift x domain
-- intersections. Generic patterns (reusable, promotable to canon); the runtime
-- personalizes phrasing per person. Not user data — shared library, like
-- framework_versions: world-readable, written only by the service role.

create table if not exists trim_tabs (
  id bigint generated always as identity primary key,
  gift_id text not null,
  domain_id text not null,
  pattern text not null,
  upward_spiral_logic text not null,
  source text not null default 'generated',        -- seed | generated | fixture
  status text not null default 'candidate',         -- candidate | curated
  framework_version text not null,
  usage_count int not null default 0,
  resonance_up int not null default 0,
  resonance_down int not null default 0,
  created_at timestamptz default now()
);

-- Multiple trim-tabs per cell are allowed (variety + post-merge seeds); the
-- resolver picks the best per cell and only GENERATES on a true miss.
create index if not exists trim_tabs_cell on trim_tabs (gift_id, domain_id, status);

alter table trim_tabs enable row level security;
do $$ begin
  if not exists (select from pg_policies where tablename='trim_tabs' and policyname='trim_tabs_public_read') then
    create policy trim_tabs_public_read on trim_tabs for select using (true);
  end if;
end $$;

-- Local-dev grants (0005 ran before this table existed).
grant select on trim_tabs to anon, authenticated, service_role;
grant insert, update, delete on trim_tabs to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
