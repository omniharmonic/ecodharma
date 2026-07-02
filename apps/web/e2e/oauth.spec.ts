import { test, expect } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { uniqueEmail, signup, grantPremium } from "./helpers";

const b64url = (b: Buffer) => b.toString("base64url");

// The full OAuth 2.1 + PKCE flow a client like Claude Desktop runs to connect to
// the hosted MCP: discovery → dynamic registration → authorize (consent) → token
// exchange → authenticated tools call → refresh.
test("MCP OAuth: discovery, PKCE authorize, token, tools call, refresh", async ({ page, request }) => {
  // --- discovery metadata is public ---
  const prm = await request.get("/.well-known/oauth-protected-resource");
  expect(prm.ok()).toBeTruthy();
  const prmJson = await prm.json();
  expect(prmJson.resource).toContain("/api/mcp");
  expect(Array.isArray(prmJson.authorization_servers)).toBeTruthy();

  const asm = await request.get("/.well-known/oauth-authorization-server");
  expect(asm.ok()).toBeTruthy();
  const asmJson = await asm.json();
  expect(asmJson.authorization_endpoint).toContain("/oauth/authorize");
  expect(asmJson.token_endpoint).toContain("/api/oauth/token");
  expect(asmJson.code_challenge_methods_supported).toContain("S256");

  // --- an unauthenticated MCP call advertises the OAuth breadcrumb ---
  const anon = await request.post("/api/mcp", {
    data: { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
  });
  expect(anon.status()).toBe(401);
  expect(anon.headers()["www-authenticate"]).toContain("resource_metadata");

  // --- a premium, signed-in member (the /authorize step reuses the session) ---
  const email = uniqueEmail("oauth");
  await signup(page, email);
  await grantPremium(page, email);
  const origin = new URL(page.url()).origin;
  const redirectUri = `${origin}/login`;

  // --- dynamic client registration (RFC 7591) ---
  const reg = await page.request.post(`${origin}/api/oauth/register`, {
    data: { client_name: "Playwright MCP", redirect_uris: [redirectUri] },
  });
  expect(reg.status()).toBe(201);
  const { client_id } = await reg.json();
  expect(client_id).toBeTruthy();

  // --- PKCE + authorize (consent screen) ---
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const state = b64url(randomBytes(8));
  const authUrl =
    `/oauth/authorize?response_type=code&client_id=${encodeURIComponent(client_id)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}&scope=mcp&state=${state}` +
    `&code_challenge=${challenge}&code_challenge_method=S256`;
  await page.goto(authUrl);
  await page.getByRole("button", { name: "Authorize" }).click();
  await page.waitForURL(/code=/);

  const returned = new URL(page.url());
  expect(returned.searchParams.get("state")).toBe(state);
  const code = returned.searchParams.get("code")!;
  expect(code).toBeTruthy();

  // --- token exchange (authorization_code + PKCE verifier) ---
  const tok = await page.request.post(`${origin}/api/oauth/token`, {
    form: {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id,
      code_verifier: verifier,
    },
  });
  expect(tok.ok()).toBeTruthy();
  const tokens = await tok.json();
  expect(tokens.access_token).toBeTruthy();
  expect(tokens.token_type).toBe("Bearer");
  expect(tokens.refresh_token).toBeTruthy();

  // --- an authenticated MCP call now succeeds ---
  const call = await page.request.post(`${origin}/api/mcp`, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
    data: { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
  });
  expect(call.ok()).toBeTruthy();
  const listed = await call.json();
  const names = (listed.result?.tools || []).map((t: any) => t.name);
  expect(names).toContain("reflect");

  // --- refresh rotates to a new working access token ---
  const refreshed = await page.request.post(`${origin}/api/oauth/token`, {
    form: { grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id },
  });
  expect(refreshed.ok()).toBeTruthy();
  const next = await refreshed.json();
  expect(next.access_token).toBeTruthy();
  expect(next.access_token).not.toBe(tokens.access_token);
});
