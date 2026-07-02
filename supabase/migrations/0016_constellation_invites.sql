-- Shareable constellation join links. An owner mints a link (optionally capped by
-- max_uses / expiry); anyone signed in who opens /invite/<token> is added as a
-- pending member (still consent-gated before their gifts are woven). Accessed via
-- the service role only, so RLS-on-no-policy denies the authenticated role.
create table if not exists constellation_invites (
  token             text primary key,
  constellation_id  bigint not null references constellations on delete cascade,
  created_by        uuid not null references auth.users on delete cascade,
  max_uses          int,                    -- null = unlimited
  uses              int not null default 0,
  expires_at        timestamptz,
  created_at        timestamptz default now()
);
create index if not exists constellation_invites_cid_idx on constellation_invites (constellation_id);

alter table constellation_invites enable row level security;
