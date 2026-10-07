import { resolveMcpToken } from "@/lib/mcp-auth";
import { resolveAccessToken, originFromRequest } from "@/lib/oauth";
import { isPremium } from "@/lib/billing";
import { canUseAltar } from "@/lib/altar/access";
import { runTool, toolList } from "@/lib/mcp-tools";

// A minimal hosted MCP endpoint (JSON-RPC 2.0 over HTTP POST). A premium member
// configures their MCP client with this URL + their bearer token, and can then
// reflect with THEIR reading from any MCP-capable tool. Reuses the same engine
// as the web app and the chat bots.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROTOCOL_VERSION = "2025-06-18";

// Tools live in lib/mcp-tools.ts (v3 reading tools + the v4 Living Altar).
const INSTRUCTIONS =
  "EcoDharma — the Living Altar. Start with get_altar (and get_ritual if a reflection is due). " +
  "Ground reflections in evidence from the person's other sources when you can (calendar, notes, projects). " +
  "The person holds the pen: log their reflections in THEIR words, confirm strands only with their say-so, " +
  "and PROPOSE (never apply) changes to their prayer, roots, or measures.";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version",
};

function rpcResult(id: unknown, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result }, { headers: CORS });
}
function rpcError(id: unknown, code: number, message: string, status = 200) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status, headers: CORS });
}
function toolText(text: string) {
  return { content: [{ type: "text", text }] };
}

/** 401 that points OAuth-capable clients (Claude, etc.) at our resource metadata. */
function unauthorized(req: Request, id: unknown) {
  const origin = originFromRequest(req);
  return Response.json(
    { jsonrpc: "2.0", id, error: { code: -32001, message: "Unauthorized — connect via OAuth or set your EcoDharma MCP token." } },
    {
      status: 401,
      headers: {
        ...CORS,
        "www-authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
      },
    },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// Some MCP clients probe GET before authenticating — answer with the 401 breadcrumb.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const userId = (await resolveAccessToken(token)) || (await resolveMcpToken(token));
  if (!userId) return unauthorized(req, null);
  return new Response(null, { status: 405, headers: { ...CORS, allow: "POST" } });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }
  const { id, method, params } = body || {};

  // Notifications (no id) — acknowledge with 202, no body.
  if (method === "notifications/initialized" || (method?.startsWith?.("notifications/") && id == null)) {
    return new Response(null, { status: 202 });
  }

  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  // Accept either an OAuth access token (Claude Desktop / claude.ai) or a legacy
  // hand-issued bearer token (manual MCP clients).
  const userId = (await resolveAccessToken(token)) || (await resolveMcpToken(token));
  if (!userId) return unauthorized(req, id);
  if (!(await isPremium(userId)) && !(await canUseAltar(userId))) return rpcError(id, -32002, "This MCP is a premium companion.", 403);

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "ecodharma", version: "2.0.0" },
        instructions: INSTRUCTIONS,
      });
    case "tools/list":
      return rpcResult(id, { tools: toolList() });
    case "tools/call": {
      const name = params?.name as string;
      const args = (params?.arguments as any) || {};
      try {
        return rpcResult(id, toolText(await runTool(userId, name, args)));
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("Unknown tool")) return rpcError(id, -32602, err.message);
        return rpcError(id, -32603, err instanceof Error ? err.message : "tool error");
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}
