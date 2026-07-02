import { resolveMcpToken } from "@/lib/mcp-auth";
import { resolveAccessToken, originFromRequest } from "@/lib/oauth";
import { isPremium } from "@/lib/billing";
import { reflectForUser, readingSummaryForUser, constellationKinForUser } from "@/lib/bot";
import { loadFramework } from "@/lib/framework";

// A minimal hosted MCP endpoint (JSON-RPC 2.0 over HTTP POST). A premium member
// configures their MCP client with this URL + their bearer token, and can then
// reflect with THEIR reading from any MCP-capable tool. Reuses the same engine
// as the web app and the chat bots.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROTOCOL_VERSION = "2025-06-18";

const TOOLS = [
  {
    name: "my_reading",
    description: "The signed-in member's EcoDharma reading — their recognition, dominant archetypes, and portrait.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "reflect",
    description: "Reflect a thought, question, or situation back through the member's own gifts. Constellation-aware: if they name a person they're woven with (e.g. \"I'm in conflict with Josie — how do I relate to her better?\"), it draws on that person's gifts and the Human Design relational read. Returns a warm, specific reflection — never a verdict.",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string", description: "What's alive for you, or who you're trying to relate to." } },
      required: ["message"],
    },
  },
  {
    name: "my_constellations",
    description: "The people this member is woven with in their EcoDharma constellations — their kin's gifts and the relational (Human Design synastry) read beneath each connection. Consent-gated.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_framework",
    description: "The EcoDharma gift framework — the archetypes and world-work domains used as the interpretive lens.",
    inputSchema: { type: "object", properties: {} },
  },
];

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
  if (!(await isPremium(userId))) return rpcError(id, -32002, "This MCP is a premium companion.", 403);

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "ecodharma", version: "1.0.0" },
      });
    case "tools/list":
      return rpcResult(id, { tools: TOOLS });
    case "tools/call": {
      const name = params?.name as string;
      const args = (params?.arguments as any) || {};
      try {
        if (name === "my_reading") {
          const r = await readingSummaryForUser(userId);
          if (!r) return rpcResult(id, toolText("No reading yet — complete one at ecodharma first."));
          const arche = r.archetypes.map((a) => `- ${a.name}: ${a.how}`).join("\n");
          return rpcResult(id, toolText(`${r.recognition}\n\nArchetypes:\n${arche}\n\nPortrait:\n${r.portrait}`));
        }
        if (name === "reflect") {
          const message = String(args.message || "").trim();
          if (!message) return rpcResult(id, toolText("Tell me what's alive for you and I'll reflect it back."));
          return rpcResult(id, toolText(await reflectForUser(userId, message)));
        }
        if (name === "my_constellations") {
          const kin = await constellationKinForUser(userId);
          return rpcResult(id, toolText(kin || "You're not woven with anyone yet — weave a constellation at ecodharma to reflect on your relationships."));
        }
        if (name === "get_framework") {
          const fw = loadFramework();
          const gifts = fw.gifts.map((g: any) => `${g.name} — ${g.essence || g.description || ""}`).join("\n");
          return rpcResult(id, toolText(`EcoDharma gift framework (v${fw.framework_version}):\n${gifts}`));
        }
        return rpcError(id, -32602, `Unknown tool: ${name}`);
      } catch (err) {
        return rpcError(id, -32603, err instanceof Error ? err.message : "tool error");
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}
