-- 0008_entitlements.sql
-- Tiered access: everyone gets the free deterministic (fixture) reading; friends
-- who redeem an unlock code are upgraded to the Claude-powered interpreter.
--
-- The cost gate lives here, not in env alone: real Claude is available in the
-- deployed env, but only a user whose profiles.tier = 'claude' (or an explicit
-- admin) triggers it — so anonymous public signups stay free and $0.

-- profiles.tier: 'free' (default) | 'claude'
alter table profiles add column if not exists tier text not null default 'free';

-- Shareable unlock codes. max_redemptions null = unlimited; active=false disables.
create table if not exists unlock_codes (
  code text primary key,
  note text,
  active boolean not null default true,
  max_redemptions int,
  redeemed_count int not null default 0,
  created_at timestamptz default now()
);

-- One redemption per user (redeeming again just keeps the upgrade).
create table if not exists code_redemptions (
  user_id uuid primary key references auth.users on delete cascade,
  code text not null references unlock_codes(code),
  redeemed_at timestamptz default now()
);

alter table unlock_codes     enable row level security;
alter table code_redemptions enable row level security;

-- unlock_codes are operated on only by the service role (which bypasses RLS):
-- no policy => no authenticated/anon access. A user may read their own redemption.
create policy own_redemption on code_redemptions
  for select using (auth.uid() = user_id);

-- Grants (0005's blanket grant ran before these tables existed, mirroring 0006/0007).
grant select on code_redemptions to authenticated, service_role;
grant select, insert, update, delete on unlock_codes     to service_role;
grant select, insert, update, delete on code_redemptions to service_role;
