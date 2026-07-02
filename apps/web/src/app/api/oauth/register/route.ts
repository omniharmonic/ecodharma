import { registerClient } from "@/lib/oauth";

// RFC 7591 — OAuth 2.0 Dynamic Client Registration. An MCP client self-registers
// its redirect URIs and gets back a client_id (public client; PKCE, no secret).
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

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_client_metadata" }, { status: 400, headers: CORS });
  }

  const redirectUris = Array.isArray(body?.redirect_uris)
    ? body.redirect_uris.filter((u: unknown): u is string => typeof u === "string")
    : [];
  if (redirectUris.length === 0) {
    return Response.json(
      { error: "invalid_redirect_uri", error_description: "at least one redirect_uri is required" },
      { status: 400, headers: CORS },
    );
  }

  const client = await registerClient({
    client_name: typeof body?.client_name === "string" ? body.client_name : null,
    redirect_uris: redirectUris,
  });

  // Echo back the registration (RFC 7591 §3.2.1). Public client → no secret.
  return Response.json(
    {
      client_id: client.client_id,
      client_name: client.client_name ?? undefined,
      redirect_uris: client.redirect_uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201, headers: CORS },
  );
}
