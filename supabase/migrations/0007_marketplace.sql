-- Marketplace v1 (PRD §9 / Journey D). Projects express needs in FRAMEWORK terms
-- (gift ids + domain ids) — no parallel ontology. Matching reuses the distilled
-- taxonomy. A person is only matched if they have opted in (profiles.settings.discoverable),
-- which is their marketplace-scoped consent; matching surfaces only display_name + gift
-- names + offerings, never birth data or charts.

create table if not exists projects (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users on delete cascade,
  title text not null,
  description text not null default '',
  needed_gifts text[] not null default '{}',     -- framework gift ids
  needed_domains text[] not null default '{}',    -- framework domain ids
  place text,
  status text not null default 'open',            -- open | closed
  created_at timestamptz default now()
);
create index if not exists projects_status on projects (status, created_at desc);

create table if not exists project_interests (
  id bigint generated always as identity primary key,
  project_id bigint not null references projects on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  message text,
  created_at timestamptz default now(),
  unique (project_id, user_id)
);

alter table projects enable row level security;
alter table project_interests enable row level security;

do $$ begin
  -- Open projects are a public board: any authenticated user can read.
  if not exists (select from pg_policies where tablename='projects' and policyname='projects_read') then
    create policy projects_read on projects for select to authenticated using (true);
  end if;
  if not exists (select from pg_policies where tablename='projects' and policyname='projects_owner_write') then
    create policy projects_owner_write on projects for all to authenticated
      using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
  end if;
  -- Interests: the interested user manages their own; the project owner can read them.
  if not exists (select from pg_policies where tablename='project_interests' and policyname='interests_self') then
    create policy interests_self on project_interests for all to authenticated
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select from pg_policies where tablename='project_interests' and policyname='interests_owner_read') then
    create policy interests_owner_read on project_interests for select to authenticated
      using (exists (select 1 from projects p where p.id = project_id and p.owner_id = auth.uid()));
  end if;
end $$;

grant select, insert, update, delete on projects, project_interests to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
