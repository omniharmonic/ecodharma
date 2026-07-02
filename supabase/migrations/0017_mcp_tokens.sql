-- Per-user tokens for the hosted MCP endpoint (/api/mcp), so a premium member can
-- reflect with their own reading from any MCP client (Claude, etc.). Bearer-token
-- auth; accessed via the service role only → RLS-on-no-policy. Idempotent.
create table if not exists mcp_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users on delete cascade,
  created_at  timestamptz default now(),
  revoked_at  timestamptz
);
create index if not exists mcp_tokens_user_idx on mcp_tokens (user_id);

alter table mcp_tokens enable row level security;
