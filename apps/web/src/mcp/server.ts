/**
 * EcoDharma MCP server — exposes OUR reading engine over the Model Context
 * Protocol (stdio), so any MCP client (Claude Desktop, Claude Code, …) can
 * compute charts, generate a gift reading, and analyze a constellation/team
 * using the same engine the web app uses.
 *
 * Built ON our stack (ephemeris service + framework.json + the deterministic
 * fixture interpreter + the HD relational engine). It does NOT reproduce
 * natalengine's chart math — we have our own (pyswisseph). The tool *surface*
 * is inspired by open-human-design's MCP (compute_chart / compare / team /
 * descriptions), but every tool returns an EcoDharma gift reading, not a
 * generic Human Design dump.
 *
 * Run:  EPHEMERIS_URL=http://127.0.0.1:8000 npx tsx src/mcp/server.ts
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Charts, Framework, Ikigai } from "../lib/types";
import { fixtureCore } from "../lib/interpret-fixture";
import { analyzePenta, compareHumanDesign, extractHdSignature, type HdSignature, type PentaMember } from "../lib/hd-relational";

// ---------------------------------------------------------------------------
// Config + shared loaders (no `server-only` deps — this runs as a plain script)
// ---------------------------------------------------------------------------
const HERE = dirname(fileURLToPath(import.meta.url));
const EPHEMERIS = process.env.EPHEMERIS_URL || "http://127.0.0.1:8000";
const MODALITIES = ["western", "vedic", "human_design", "gene_keys"] as const;
const ROUTE: Record<string, string> = {
  western: "western", vedic: "vedic", human_design: "human-design", gene_keys: "gene-keys",
};

let _framework: Framework | null = null;
function framework(): Framework {
  if (_framework) return _framework;
  const candidates = [
    process.env.FRAMEWORK_PATH,
    resolve(process.cwd(), "framework/framework.json"),
    resolve(process.cwd(), "../../framework/framework.json"),
    resolve(HERE, "../../../../framework/framework.json"),
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    try {
      _framework = JSON.parse(readFileSync(p, "utf8")) as Framework;
      return _framework;
    } catch { /* try next */ }
  }
  throw new Error(`framework.json not found (looked in: ${candidates.join(", ")})`);
}

type BirthInput = {
  name?: string; year: number; month: number; day: number;
  hour: number | null; minute: number | null;
  lat: number; lng: number; tz_str: string; unknown_time: boolean;
};

// Geocode a place name to lat/lng/tz via Open-Meteo (same source the web app uses).
async function geocode(place: string): Promise<{ lat: number; lng: number; tz: string } | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = (await res.json()) as any;
    const r = j?.results?.[0];
    if (!r) return null;
    return { lat: r.latitude, lng: r.longitude, tz: r.timezone || "UTC" };
  } catch {
    return null;
  }
}

// Resolve a flexible birth spec into the ephemeris BirthInput.
async function resolveBirth(b: any, label = "birth"): Promise<BirthInput> {
  if (!b || typeof b !== "object") throw new Error(`${label}: expected an object`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || "")) throw new Error(`${label}.date must be YYYY-MM-DD`);
  const [year, month, day] = (b.date as string).split("-").map(Number);
  let { lat, lng, tz } = b as { lat?: number; lng?: number; tz?: string };
  if ((lat == null || lng == null || !tz) && b.place) {
    const g = await geocode(String(b.place));
    if (!g) throw new Error(`${label}: couldn't geocode "${b.place}" — pass lat/lng/tz instead`);
    lat = g.lat; lng = g.lng; tz = g.tz;
  }
  if (lat == null || lng == null || !tz) throw new Error(`${label}: need a place, or lat+lng+tz`);
  const unknown = !b.time;
  let hour: number | null = null, minute: number | null = null;
  if (!unknown) { const [h, m] = String(b.time).split(":").map(Number); hour = h; minute = m; }
  return { name: b.name, year, month, day, hour, minute, lat, lng, tz_str: tz, unknown_time: unknown };
}

async function computeChart(modality: string, birth: BirthInput): Promise<any> {
  const res = await fetch(`${EPHEMERIS}/charts/${ROUTE[modality]}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(birth),
  });
  if (!res.ok) throw new Error(`ephemeris ${modality} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function computeAllCharts(birth: BirthInput): Promise<Charts> {
  const charts: Charts = {};
  for (const m of MODALITIES) charts[m] = (await computeChart(m, birth)).data;
  return charts;
}

async function hdSignature(birth: BirthInput): Promise<HdSignature> {
  const hd = (await computeChart("human_design", birth)).data;
  const sig = extractHdSignature(hd);
  if (!sig) throw new Error("could not derive a Human Design signature");
  return sig;
}

// ---------------------------------------------------------------------------
// Tool schemas
// ---------------------------------------------------------------------------
const BIRTH_SCHEMA = {
  type: "object",
  description: "A birth moment. Give a place name (geocoded server-side) OR explicit lat/lng/tz.",
  properties: {
    name: { type: "string", description: "Optional label for this person." },
    date: { type: "string", description: "YYYY-MM-DD (local birth date)." },
    time: { type: "string", description: "HH:MM 24h local. Omit if unknown (noon used; line-level detail held lightly)." },
    place: { type: "string", description: 'e.g. "Boulder, Colorado". Geocoded to lat/lng + IANA timezone.' },
    lat: { type: "number" }, lng: { type: "number" },
    tz: { type: "string", description: "IANA tz (e.g. America/Denver) — only if place is not given." },
  },
  required: ["date"],
};

const IKIGAI_SCHEMA = {
  type: "object",
  description: "The four ikigai prompts — weighted ABOVE chart signals in the reading.",
  properties: {
    love: { type: "string", description: "What do you love? What makes you feel alive?" },
    skill: { type: "string", description: "What are you genuinely good at?" },
    world_need: { type: "string", description: "What does the world (your place, now) most need?" },
    livelihood: { type: "string", description: "What could sustain you materially?" },
  },
  required: ["love", "skill", "world_need", "livelihood"],
};

const TOOLS = [
  {
    name: "get_framework",
    description: "The EcoDharma gift framework — the 10 archetypes (with what each is FOR, strengths, and soft chart signatures), the world-work domains, and the Great Turning dimensions. Use this as the lens for interpreting any chart.",
    inputSchema: {
      type: "object",
      properties: { gift_id: { type: "string", description: "Optional — return one archetype in full (portrait, strengths, shadow, signatures)." } },
    },
  },
  {
    name: "compute_chart",
    description: "Compute a person's charts across four lenses (western tropical, vedic sidereal, Human Design, Gene Keys) from birth data, plus a compact HD signature. Structure only — no proprietary descriptive text.",
    inputSchema: {
      type: "object",
      properties: {
        birth: BIRTH_SCHEMA,
        systems: { type: "array", items: { type: "string", enum: [...MODALITIES] }, description: "Subset of lenses. Default: all four." },
      },
      required: ["birth"],
    },
  },
  {
    name: "gift_reading",
    description: "THE EcoDharma reading: compute the four charts, then reflect the person through the gift framework + their ikigai — recognition, a chart-grounded portrait, their 2–3 dominant archetypes, chart-thread bridges, and gift×domain pairings. Deterministic (no LLM required).",
    inputSchema: {
      type: "object",
      properties: { birth: BIRTH_SCHEMA, ikigai: IKIGAI_SCHEMA },
      required: ["birth", "ikigai"],
    },
  },
  {
    name: "compare_people",
    description: "The Human Design connection chart between two people: electromagnetic / companionship / compromise / dominance channels, centre conditioning (who conditions whom), composite type, and type/authority/profile dynamics. Invites reflection — never a verdict.",
    inputSchema: {
      type: "object",
      properties: { personA: BIRTH_SCHEMA, personB: BIRTH_SCHEMA },
      required: ["personA", "personB"],
    },
  },
  {
    name: "analyze_team",
    description: "Penta / group analysis for 2–9 people: group type, which centre-roles are held vs. open (Communicator, Worker, Director, Guide…), electromagnetic threads across the group, and recommendations. The structural substrate beneath a constellation read.",
    inputSchema: {
      type: "object",
      properties: {
        members: { type: "array", minItems: 2, maxItems: 9, items: BIRTH_SCHEMA, description: "2–9 people (3–5 is an optimal penta)." },
      },
      required: ["members"],
    },
  },
];

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
const server = new Server(
  { name: "ecodharma", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

function gift(id: string) {
  return framework().gifts.find((g) => g.id === id);
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params as { name: string; arguments?: any };
  try {
    const result = await dispatch(name, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error in ${name}: ${err instanceof Error ? err.message : String(err)}` }],
    };
  }
});

async function dispatch(name: string, args: any): Promise<unknown> {
  switch (name) {
    case "get_framework": {
      const fw = framework();
      if (args.gift_id) {
        const g = gift(args.gift_id);
        if (!g) throw new Error(`unknown gift_id "${args.gift_id}"`);
        return g;
      }
      return {
        framework_version: fw.framework_version,
        dimensions: (fw.dimensions || []).map((d) => ({ id: d.id, name: d.name, description: d.description })),
        domains: fw.domains.map((d) => ({ id: d.id, name: d.name, dimension: d.dimension, gist: d.description })),
        gifts: fw.gifts.map((g) => ({
          id: g.id, name: g.name, essence: g.essence || g.description,
          strengths: g.strengths, shadow: g.shadow,
          what_its_for: g.great_turning_contribution?.what_its_for || g.great_turning_contribution?.summary,
          chart_signatures: g.chart_signatures, serves_domains: g.great_turning_contribution?.domains,
        })),
      };
    }
    case "compute_chart": {
      const birth = await resolveBirth(args.birth);
      const systems: string[] = Array.isArray(args.systems) && args.systems.length ? args.systems : [...MODALITIES];
      const charts: Charts = {};
      for (const m of systems) charts[m] = (await computeChart(m, birth)).data;
      return { birth: { date: args.birth.date, time: birth.unknown_time ? "unknown" : args.birth.time, place: args.birth.place }, charts, hd_signature: extractHdSignature(charts["human_design"]) };
    }
    case "gift_reading": {
      const birth = await resolveBirth(args.birth);
      const ikigai = args.ikigai as Ikigai;
      for (const k of ["love", "skill", "world_need", "livelihood"]) if (!ikigai?.[k as keyof Ikigai]) throw new Error(`ikigai.${k} is required`);
      const charts = await computeAllCharts(birth);
      const core = fixtureCore(framework(), charts, ikigai);
      return {
        engine: "fixture-interpreter@2.0.0",
        framework_version: framework().framework_version,
        note: "Deterministic reading from charts + ikigai through the EcoDharma framework. Reflective, never a verdict.",
        reading: core,
        hd_signature: extractHdSignature(charts["human_design"]),
      };
    }
    case "compare_people": {
      const [a, b] = await Promise.all([resolveBirth(args.personA, "personA"), resolveBirth(args.personB, "personB")]);
      const [sa, sb] = await Promise.all([hdSignature(a), hdSignature(b)]);
      return {
        engine: "hd-relational@1.0.0",
        note: "A connection chart, not a compatibility score. Read it as a map of pulls.",
        connection: compareHumanDesign(sa, sb, a.name || "A", b.name || "B"),
      };
    }
    case "analyze_team": {
      const births: BirthInput[] = await Promise.all((args.members as any[]).map((m, i) => resolveBirth(m, `members[${i}]`)));
      const sigs = await Promise.all(births.map((b) => hdSignature(b)));
      const members: PentaMember[] = sigs.map((sig, i) => ({ name: births[i].name || `Person ${i + 1}`, sig }));
      return {
        engine: "hd-relational@1.0.0",
        note: "The structural substrate beneath a constellation — the gift framework is the headline; this is the engine room.",
        penta: analyzePenta(members),
      };
    }
    default:
      throw new Error(`unknown tool "${name}"`);
  }
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is the JSON-RPC channel.
  console.error(`[ecodharma-mcp] ready · ephemeris=${EPHEMERIS} · framework v${framework().framework_version}`);
}

main().catch((err) => {
  console.error("[ecodharma-mcp] fatal:", err);
  process.exit(1);
});
