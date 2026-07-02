import { protectedResourceMetadata, originFromRequest } from "@/lib/oauth";

// RFC 9728 — OAuth 2.0 Protected Resource Metadata. Served at
// /.well-known/oauth-protected-resource (via a rewrite). Tells an MCP client
// which authorization server guards /api/mcp.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "*",
};

export async function GET(req: Request) {
  return Response.json(protectedResourceMetadata(originFromRequest(req)), { headers: CORS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
