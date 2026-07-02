import { authServerMetadata, originFromRequest } from "@/lib/oauth";

// RFC 8414 — OAuth 2.0 Authorization Server Metadata. Served at
// /.well-known/oauth-authorization-server (via a rewrite).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "*",
};

export async function GET(req: Request) {
  return Response.json(authServerMetadata(originFromRequest(req)), { headers: CORS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
