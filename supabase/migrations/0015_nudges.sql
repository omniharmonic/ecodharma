-- Weekly "dharma nudges": a small, strengths-playing prompt sent to premium
-- members. Written by the weekly cron, read back on /settings. Accessed only via
-- the service role, so RLS-on-no-policy denies the authenticated role. Idempotent.
create table if not exists nudges (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users on delete cascade,
  body        text not null,
  channel     text default 'email',
  created_at  timestamptz default now()
);
create index if not exists nudges_user_idx on nudges (user_id, created_at desc);

alter table nudges enable row level security;
