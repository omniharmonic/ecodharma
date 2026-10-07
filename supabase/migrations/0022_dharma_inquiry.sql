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
