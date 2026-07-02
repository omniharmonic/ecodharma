-- Reflection bot: link an external chat account (Telegram now, Slack later) to an
-- EcoDharma user, and keep a short conversation memory. All rows are accessed
-- only via the service role (the bot is keyed by platform id, not auth.uid()),
-- so RLS is enabled with NO policies → denied to the `authenticated` role, while
-- withService (table owner) bypasses it. Idempotent.

create table if not exists bot_accounts (
  platform          text not null,
  platform_user_id  text not null,
  user_id           uuid not null references auth.users on delete cascade,
  created_at        timestamptz default now(),
  primary key (platform, platform_user_id)
);

create table if not exists bot_link_codes (
  code        text primary key,
  user_id     uuid not null references auth.users on delete cascade,
  created_at  timestamptz default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);

create table if not exists bot_messages (
  id                bigint generated always as identity primary key,
  platform          text not null,
  platform_user_id  text not null,
  role              text not null,        -- 'user' | 'assistant'
  content           text not null,
  created_at        timestamptz default now()
);
create index if not exists bot_messages_thread_idx on bot_messages (platform, platform_user_id, created_at);

alter table bot_accounts   enable row level security;
alter table bot_link_codes enable row level security;
alter table bot_messages   enable row level security;
