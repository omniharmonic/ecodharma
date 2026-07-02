import { exchangeAuthCode, refreshTokens, OAuthError } from "@/lib/oauth";

// OAuth 2.1 token endpoint. Accepts form-encoded bodies (per spec):
//   grant_type=authorization_code  → code + code_verifier (PKCE) + redirect_uri
//   grant_type=refresh_token       → refresh_token (rotated)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function fail(code: string, status = 400, description?: string) {
  return Response.json(
    { error: code, ...(description ? { error_description: description } : {}) },
    { status, headers: { ...CORS, "cache-control": "no-store" } },
  );
}

export async function POST(req: Request) {
  // Tokens are requested with application/x-www-form-urlencoded bodies.
  let form: URLSearchParams;
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = await req.json();
      form = new URLSearchParams(j as Record<string, string>);
    } else {
      form = new URLSearchParams(await req.text());
    }
  } catch {
    return fail("invalid_request");
  }

  const grantType = form.get("grant_type");
  const clientId = form.get("client_id") || "";
  if (!clientId) return fail("invalid_client", 401, "client_id is required");

  try {
    if (grantType === "authorization_code") {
      const code = form.get("code");
      const redirectUri = form.get("redirect_uri");
      if (!code || !redirectUri) return fail("invalid_request", 400, "code and redirect_uri are required");
      const tokens = await exchangeAuthCode({
        code,
        clientId,
        redirectUri,
        codeVerifier: form.get("code_verifier") ?? undefined,
      });
      return Response.json(tokens, { headers: { ...CORS, "cache-control": "no-store" } });
    }

    if (grantType === "refresh_token") {
      const refreshToken = form.get("refresh_token");
      if (!refreshToken) return fail("invalid_request", 400, "refresh_token is required");
      const tokens = await refreshTokens({ refreshToken, clientId });
      return Response.json(tokens, { headers: { ...CORS, "cache-control": "no-store" } });
    }

    return fail("unsupported_grant_type");
  } catch (err) {
    if (err instanceof OAuthError) return fail(err.code, err.status);
    return fail("server_error", 500);
  }
}
