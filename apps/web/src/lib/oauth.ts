import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { withService } from "./db";

// A compact OAuth 2.1 authorization server backing the hosted MCP endpoint. Public
// clients only (PKCE, no client secret) — which is what MCP clients like Claude
// Desktop use. Everything is stored via the service role (RLS-on-no-policy).

export const OAUTH_SCOPE = "mcp";
const ACCESS_TTL_S = 60 * 60; // 1h access tokens; refresh tokens are long-lived
const CODE_TTL_S = 60 * 5; // authorization codes expire fast

const rand = (n = 32) => randomBytes(n).toString("base64url");

/** Resolve the public origin behind Vercel's proxy (falls back to the site env). */
export function originFromRequest(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL || "https://ecodharma.vercel.app";
}

// ---- discovery metadata ------------------------------------------------------

export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ["header"],
  };
}

export function authServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    scopes_supported: [OAUTH_SCOPE],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  };
}

// ---- dynamic client registration (RFC 7591) ----------------------------------

export type OAuthClient = { client_id: string; client_name: string | null; redirect_uris: string[] };

export async function registerClient(input: {
  client_name?: string | null;
  redirect_uris: string[];
}): Promise<OAuthClient> {
  const client_id = `emcp_client_${rand(16)}`;
  const redirect_uris = input.redirect_uris;
  await withService((c) =>
    c.query(
      "insert into oauth_clients (client_id, client_name, redirect_uris) values ($1, $2, $3)",
      [client_id, input.client_name ?? null, redirect_uris],
    ),
  );
  return { client_id, client_name: input.client_name ?? null, redirect_uris };
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  return withService(async (c) => {
    const { rows } = await c.query(
      "select client_id, client_name, redirect_uris from oauth_clients where client_id = $1",
      [clientId],
    );
    return (rows[0] as OAuthClient | undefined) ?? null;
  });
}

/** A registered client may only redirect to a URI it registered (exact match). */
export function redirectAllowed(client: OAuthClient, redirectUri: string): boolean {
  return client.redirect_uris.includes(redirectUri);
}

// ---- authorization codes -----------------------------------------------------

export async function createAuthCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge?: string | null;
  codeChallengeMethod?: string | null;
  scope?: string | null;
  resource?: string | null;
}): Promise<string> {
  const code = `emcp_code_${rand(24)}`;
  await withService((c) =>
    c.query(
      `insert into oauth_codes
         (code, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, scope, resource, expires_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8, now() + interval '${CODE_TTL_S} seconds')`,
      [
        code,
        input.clientId,
        input.userId,
        input.redirectUri,
        input.codeChallenge ?? null,
        input.codeChallengeMethod ?? null,
        input.scope ?? OAUTH_SCOPE,
        input.resource ?? null,
      ],
    ),
  );
  return code;
}

function verifyPkce(verifier: string, challenge: string | null, method: string | null): boolean {
  if (!challenge) return true; // no PKCE bound at authorize time
  if (!verifier) return false;
  if (method === "S256" || !method) {
    const hashed = createHash("sha256").update(verifier).digest("base64url");
    return hashed === challenge;
  }
  return verifier === challenge; // "plain"
}

export type TokenSet = {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
};

async function issueTokens(clientId: string, userId: string, scope: string): Promise<TokenSet> {
  const access_token = `emcp_at_${rand(32)}`;
  const refresh_token = `emcp_rt_${rand(32)}`;
  await withService((c) =>
    c.query(
      `insert into oauth_tokens (access_token, refresh_token, client_id, user_id, scope, expires_at)
       values ($1,$2,$3,$4,$5, now() + interval '${ACCESS_TTL_S} seconds')`,
      [access_token, refresh_token, clientId, userId, scope],
    ),
  );
  return { access_token, refresh_token, token_type: "Bearer", expires_in: ACCESS_TTL_S, scope };
}

export class OAuthError extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
  }
}

/** Exchange an authorization code (+ PKCE verifier) for tokens. One-time use. */
export async function exchangeAuthCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier?: string;
}): Promise<TokenSet> {
  const row = await withService(async (c) => {
    const { rows } = await c.query(
      `delete from oauth_codes where code = $1
       returning client_id, user_id, redirect_uri, code_challenge, code_challenge_method, scope,
                 (expires_at < now()) as expired`,
      [input.code],
    );
    return rows[0];
  });
  if (!row) throw new OAuthError("invalid_grant");
  if (row.expired) throw new OAuthError("invalid_grant");
  if (row.client_id !== input.clientId) throw new OAuthError("invalid_grant");
  if (row.redirect_uri !== input.redirectUri) throw new OAuthError("invalid_grant");
  if (!verifyPkce(input.codeVerifier ?? "", row.code_challenge, row.code_challenge_method)) {
    throw new OAuthError("invalid_grant");
  }
  return issueTokens(row.client_id, row.user_id, row.scope || OAUTH_SCOPE);
}

/** Rotate a refresh token → a fresh token set (old refresh token is revoked). */
export async function refreshTokens(input: { refreshToken: string; clientId: string }): Promise<TokenSet> {
  const row = await withService(async (c) => {
    const { rows } = await c.query(
      `update oauth_tokens set revoked_at = now()
       where refresh_token = $1 and revoked_at is null
       returning client_id, user_id, scope`,
      [input.refreshToken],
    );
    return rows[0];
  });
  if (!row) throw new OAuthError("invalid_grant");
  if (row.client_id !== input.clientId) throw new OAuthError("invalid_grant");
  return issueTokens(row.client_id, row.user_id, row.scope || OAUTH_SCOPE);
}

/** Resolve an OAuth access token → user id (null if unknown/expired/revoked). */
export async function resolveAccessToken(token: string | null): Promise<string | null> {
  if (!token) return null;
  return withService(async (c) => {
    const { rows } = await c.query(
      "select user_id from oauth_tokens where access_token = $1 and revoked_at is null and expires_at > now()",
      [token],
    );
    return (rows[0]?.user_id as string | undefined) ?? null;
  });
}
