-- OAuth 2.1 authorization server for the hosted MCP endpoint (/api/mcp), so
-- clients that only speak OAuth (Claude Desktop, claude.ai) can connect — they
-- refuse hand-entered bearer tokens. PKCE + dynamic client registration; all
-- accessed via the service role only → RLS-on-no-policy. Idempotent.

-- Clients self-register (RFC 7591). Public clients (PKCE, no secret).
create table if not exists oauth_clients (
  client_id      text primary key,
  client_name    text,
  redirect_uris  text[] not null default '{}',
  created_at     timestamptz not null default now()
);

-- Short-lived authorization codes (one-time, PKCE-bound).
create table if not exists oauth_codes (
  code                  text primary key,
  client_id             text not null references oauth_clients on delete cascade,
  user_id               uuid not null references auth.users on delete cascade,
  redirect_uri          text not null,
  code_challenge        text,
  code_challenge_method text,
  scope                 text,
  resource              text,
  expires_at            timestamptz not null,
  created_at            timestamptz not null default now()
);

-- Access + refresh tokens. Refresh tokens rotate; old rows keep revoked_at set.
create table if not exists oauth_tokens (
  access_token   text primary key,
  refresh_token  text unique,
  client_id      text not null references oauth_clients on delete cascade,
  user_id        uuid not null references auth.users on delete cascade,
  scope          text,
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now(),
  revoked_at     timestamptz
);
create index if not exists oauth_tokens_user_idx on oauth_tokens (user_id);
create index if not exists oauth_tokens_refresh_idx on oauth_tokens (refresh_token);

alter table oauth_clients enable row level security;
alter table oauth_codes enable row level security;
alter table oauth_tokens enable row level security;
