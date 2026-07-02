import { resolveMcpToken } from "@/lib/mcp-auth";
import { isPremium } from "@/lib/billing";
import { reflectForUser, readingSummaryForUser } from "@/lib/bot";
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
    description: "Reflect a thought, question, or situation back through the member's own gifts. Returns a warm, specific reflection — never a verdict.",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string", description: "What's alive for you, or what you're wrestling with." } },
      required: ["message"],
    },
  },
  {
    name: "get_framework",
    description: "The EcoDharma gift framework — the archetypes and world-work domains used as the interpretive lens.",
    inputSchema: { type: "object", properties: {} },
  },
];

function rpcResult(id: unknown, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result });
}
function rpcError(id: unknown, code: number, message: string, status = 200) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });
}
function toolText(text: string) {
  return { content: [{ type: "text", text }] };
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
  const userId = await resolveMcpToken(token);
  if (!userId) return rpcError(id, -32001, "Unauthorized — set your EcoDharma MCP token as a Bearer credential.", 401);
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
