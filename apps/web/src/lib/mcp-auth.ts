import "server-only";
import { randomBytes } from "node:crypto";
import { withService } from "./db";

// Bearer tokens for the hosted MCP endpoint. One active token per user (issuing a
// new one revokes prior tokens).

export async function issueMcpToken(userId: string): Promise<string> {
  const token = `eco_${randomBytes(24).toString("base64url")}`;
  await withService(async (c) => {
    await c.query("update mcp_tokens set revoked_at = now() where user_id = $1 and revoked_at is null", [userId]);
    await c.query("insert into mcp_tokens (token, user_id) values ($1, $2)", [token, userId]);
  });
  return token;
}

export async function resolveMcpToken(token: string | null): Promise<string | null> {
  if (!token) return null;
  return withService(async (c) => {
    const { rows } = await c.query("select user_id from mcp_tokens where token = $1 and revoked_at is null", [token]);
    return (rows[0]?.user_id as string | undefined) ?? null;
  });
}

export async function revokeMcpTokens(userId: string): Promise<void> {
  await withService((c) => c.query("update mcp_tokens set revoked_at = now() where user_id = $1 and revoked_at is null", [userId]));
}

export async function hasActiveMcpToken(userId: string): Promise<boolean> {
  return withService(async (c) => {
    const { rows } = await c.query("select 1 from mcp_tokens where user_id = $1 and revoked_at is null limit 1", [userId]);
    return rows.length > 0;
  });
}
