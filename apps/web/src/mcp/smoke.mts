// Smoke test for the EcoDharma MCP server. Spawns it over stdio and exercises
// every tool. Run from apps/web:  npx tsx src/mcp/smoke.mts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", "src/mcp/server.ts"],
  env: { ...process.env, EPHEMERIS_URL: process.env.EPHEMERIS_URL || "http://127.0.0.1:8000" },
});
const client = new Client({ name: "smoke", version: "1.0.0" }, { capabilities: {} });
await client.connect(transport);

const tools = await client.listTools();
console.log("tools:", tools.tools.map((t) => t.name).join(", "));

const call = async (name: string, args: any) => {
  const r = await client.callTool({ name, arguments: args });
  const text = (r.content as any[]).map((c) => c.text).join("");
  if (r.isError) throw new Error(`${name} errored: ${text}`);
  return JSON.parse(text);
};

const A = { name: "Ada", date: "1988-11-12", time: "08:30", place: "Reykjavík" };
const B = { name: "Bo", date: "1991-04-03", time: "14:05", place: "Lisbon" };
const C = { name: "Cy", date: "1979-07-22", time: "19:40", place: "Nairobi" };

const fw = await call("get_framework", {});
console.log(`get_framework: v${fw.framework_version}, ${fw.gifts.length} gifts, ${fw.domains.length} domains`);

const chart = await call("compute_chart", { birth: A, systems: ["human_design", "western"] });
console.log(`compute_chart: HD type=${chart.charts.human_design?.type}, sig gates=${chart.hd_signature?.gates.length}`);

const reading = await call("gift_reading", { birth: A, ikigai: {
  love: "bringing people together around shared land",
  skill: "seeing the pattern that connects",
  world_need: "regenerative coordination",
  livelihood: "facilitation and stewardship",
} });
console.log(`gift_reading: lead gifts = ${reading.reading.gift_constellation.map((g: any) => g.gift_id).join(", ")}; threads=${reading.reading.chart_threads.length}`);

const cmp = await call("compare_people", { personA: A, personB: B });
console.log(`compare_people: composite=${cmp.connection.compositeType}; EM=${cmp.connection.stats.electromagnetic} CO=${cmp.connection.stats.companionship} CM=${cmp.connection.stats.compromise} DM=${cmp.connection.stats.dominance}`);

const team = await call("analyze_team", { members: [A, B, C] });
console.log(`analyze_team: groupType=${team.penta.groupType}, filled=${team.penta.filledRoles.length}/9, EM threads=${team.penta.stats.electromagneticCount}`);

await client.close();
console.log("\n✓ MCP smoke: all five tools responded over stdio");
