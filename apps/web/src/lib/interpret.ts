import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Charts, CoreProfile, Framework, Gift, GiftProfile, Ikigai, Pairing } from "./types";
import { loadFramework } from "./framework";
import { loadVoice, VOICE_VERSION } from "./voice";
import { useClaude } from "./llm";
import { setInterpreterMode } from "./config";
import { personalizeTrimTab, resolveTrimTab } from "./trimtabs";
import { extractHdSignature } from "./hd-relational";
// Chart signal extraction + the deterministic fixture interpreter live in
// interpret-fixture.ts (pure, no `server-only`) so the MCP server can reuse them.
import { fixtureCore, clip } from "./interpret-fixture";

export { useClaude };

const ENGINE_FIXTURE = "fixture-interpreter@2.0.0";
// Opus for maximum depth. A full reading runs ~90–120s, which fits the serverless
// budget on Fluid Compute (the routes set maxDuration=300). Set ECODHARMA_PROFILE_MODEL=
// claude-sonnet-4-6 for a faster (~50–70s), slightly lighter reading if preferred.
const MODEL = process.env.ECODHARMA_PROFILE_MODEL || "claude-opus-4-8";
// Safety net: abort well before the function's own limit so a genuinely hung call
// still falls back to the (rich, deterministic) fixture instead of a blank profile.
const CLAUDE_TIMEOUT_MS = Number(process.env.ECODHARMA_CLAUDE_TIMEOUT_MS || 240_000);
const MAX_PAIRINGS = 3; // a lead + two — not a pile of "highest-leverage" moves

// An Anthropic failure that means "out of credits / quota / rate limit" — the
// signal to stop hitting a dead API and drop the whole app to the fixture engine.
function isCreditError(err: unknown): boolean {
  const e = err as { status?: number; message?: string; error?: { type?: string; message?: string } };
  const status = e?.status;
  if (status === 402 || status === 429 || status === 529) return true;
  const msg = `${e?.message || ""} ${e?.error?.message || ""} ${e?.error?.type || ""}`.toLowerCase();
  return /credit|quota|billing|balance|insufficient|payment/.test(msg);
}

// On a credit/quota failure, flip the global mode to fixture so subsequent
// readings skip the dead API entirely (the admin flips it back after topping up).
async function tripIfCreditError(err: unknown): Promise<void> {
  if (!isCreditError(err)) return;
  try {
    await setInterpreterMode("fixture");
    console.error("[interpret] credit/quota error — global mode tripped to 'fixture'.");
  } catch (e) {
    console.error("[interpret] failed to trip mode to fixture:", e);
  }
}

// ---------- compress the framework so the model reasons with it, not recites it ----------
function slimFramework(fw: Framework) {
  return {
    great_turning_dimensions: (fw.dimensions || []).map((d) => ({ id: d.id, name: d.name, description: d.description })),
    domains: fw.domains.map((d) => ({ id: d.id, name: d.name, dimension: d.dimension, gist: d.description })),
    // Gifts now carry their thorough archetype: what each is FOR, its strengths, and
    // soft chart signatures — so the model can RECOGNIZE and REASON without reciting.
    gifts: fw.gifts.map((g) => ({
      id: g.id,
      name: g.name,
      gist: g.essence || g.description,
      strengths: g.strengths,
      signatures: g.chart_signatures,
      what_its_for: g.great_turning_contribution?.what_its_for || g.great_turning_contribution?.summary,
      serves_domains: g.great_turning_contribution?.domains,
    })),
    ikigai_lens: fw.ikigai_lens,
  };
}

const PROFILE_TOOL = {
  name: "gift_profile",
  description: "A thorough, chart-grounded reflection of one person. Recognition leads; the deep reading weaves all four charts; the framework stays invisible scaffolding.",
  input_schema: {
    type: "object",
    properties: {
      recognition: { type: "string", description: "SHORT warm opener: 1–3 plain sentences that make THIS person feel seen. No jargon, no metadata." },
      portrait: { type: "string", description: "The DEEP reading: 250–500 words weaving western + vedic + human design + gene keys + their ikigai into a single, warm, plain portrait of their background, psychology, gifts, and orientation. Specific, never generic. No theory recitation, no proprietary HD/Gene-Keys text." },
      chart_threads: {
        type: "array",
        description: "8–14 interpretive bridges, spanning ALL FOUR lenses. Each ties ONE specific placement to how they can take part. These attach to the drawn charts, so name placements precisely and set `ref` to a token the chart can resolve.",
        items: {
          type: "object",
          properties: {
            modality: { type: "string", enum: ["western", "vedic", "human_design", "gene_keys"] },
            ref: { type: "string", description: "anchor the chart resolves. western/vedic: a body ('Sun','Moon','Venus','North_Node') or angle ('Ascendant','Midheaven'). human_design: a center ('Sacral'), a channel ('34-20'), or a gate ('34'). gene_keys: a sphere id ('lifes_work','evolution','radiance','purpose','attraction','iq','eq','sq','vocation','culture','brand')." },
            placement: { type: "string", description: "human-readable, e.g. 'Sun in Scorpio in the 8th house' or 'Channel 37-40, Throat to Solar Plexus'." },
            plain_meaning: { type: "string", description: "1–2 plain sentences about the person (no jargon)." },
            great_turning_link: { type: "string", description: "the bridge: 'because this placement, that means … for how you take part'. Causal, warm, non-deterministic." },
            tone: { type: "string", enum: ["gift", "shadow", "orientation", "background"] },
            gift_id: { type: "string", description: "optional framework gift id this thread feeds" },
          },
          required: ["modality", "ref", "placement", "plain_meaning", "great_turning_link"],
        },
      },
      gift_constellation: {
        type: "array",
        description: "the 2–3 archetypes that dominate for THIS person, strongest first.",
        items: {
          type: "object",
          properties: {
            gift_id: { type: "string", description: "framework gift id" },
            how_they_carry: { type: "string", description: "2–4 sentences on how THIS person specifically embodies the gift, grounded in their charts + ikigai — not the archetype definition." },
            prominence: { type: "number" },
          },
          required: ["gift_id", "how_they_carry"],
        },
      },
      lens_readings: {
        type: "array",
        description: "EXACTLY three deep, chart-specific sections — one for astrology (western + vedic together), one for human_design, one for gene_keys — each explaining THIS person's actual placements through the Great Turning. This is the flagship depth; be thorough and specific to their chart.",
        items: {
          type: "object",
          properties: {
            lens: { type: "string", enum: ["astrology", "human_design", "gene_keys"] },
            title: { type: "string", description: "e.g. 'Astrology — Western & Vedic', 'Human Design', 'Gene Keys'." },
            summary: { type: "string", description: "1–2 sentences orienting the reader to what this lens shows about them." },
            reading: { type: "string", description: "2–3 substantial paragraphs weaving THIS person's real placements in this lens into how they're built to take part in the Great Turning. Specific, warm, plain. No proprietary HD/Gene-Keys descriptive text — positions/structure + your own words only." },
            placements: {
              type: "array",
              description: "4–6 specific placements from their chart in this lens.",
              items: {
                type: "object",
                properties: {
                  label: { type: "string", description: "the specific placement, e.g. 'Sun in Scorpio, 8th house', 'Emotional authority', 'Life's Work in Gate 34'." },
                  meaning: { type: "string", description: "1–2 plain sentences on what this means for them." },
                  great_turning: { type: "string", description: "how this placement equips them for the Great Turning — causal, warm, non-deterministic." },
                },
                required: ["label", "meaning", "great_turning"],
              },
            },
          },
          required: ["lens", "title", "summary", "reading", "placements"],
        },
      },
      unique_gifts: { type: "array", items: { type: "string" }, description: "<=15 words each, second person, how this person carries a gift — NOT the archetype's definition." },
      domains: { type: "array", items: { type: "object", properties: { domain_id: { type: "string" }, why: { type: "string", description: "one plain sentence" } }, required: ["domain_id", "why"] } },
      pairings: { type: "array", description: "gift x domain intersections, most-alive first; use framework ids.", items: { type: "object", properties: { gift_id: { type: "string" }, domain_id: { type: "string" } }, required: ["gift_id", "domain_id"] } },
      orientations: { type: "array", items: { type: "string" }, description: "3–6 short leaning phrases (how they tend to move)." },
      shadow: { type: "array", items: { type: "object", properties: { pattern: { type: "string" }, how_to_relate: { type: "string" } } } },
      narrative: { type: "string", description: "a short closing coda (1–3 sentences). May be empty if the portrait says it all." },
    },
    required: ["recognition", "portrait", "chart_threads", "gift_constellation", "lens_readings", "unique_gifts", "domains", "pairings", "narrative"],
  },
} as const;

const V3_DIRECTIVE = `You write EcoDharma's gift readings. This reading goes DEEP and PERSONAL; the framework stays QUIET.
- LEAD with a short recognition, then a long, warm `+"`portrait`"+` (250–500 words) that genuinely weaves ALL FOUR charts — western tropical, vedic sidereal, Human Design, Gene Keys — with their ikigai, into one plain, specific reflection of who this person is and how they're built.
- Build `+"`chart_threads`"+`: 8–14 bridges across all four lenses, each tying ONE precisely-named placement to how they can take part in the great turning ("because X, that means Y"). Name placements specifically and set `+"`ref`"+` so the drawn chart can attach the note.
- Name the `+"`gift_constellation`"+`: the 2–3 archetypes most alive in them, and how THEY carry each (not the definition).
- Write `+"`lens_readings`"+`: THREE deep sections — astrology (western + vedic together), human_design, gene_keys — each 2–3 paragraphs PLUS 4–6 explained placements, reading THIS person's real chart in that lens through the great turning. Go thorough here; this is where the reading earns its depth. Name real placements (signs, houses, aspects, nakshatras; type/authority/profile/centers/channels; the gene-key spheres by gate.line) and explain what each equips them to do. Never reproduce proprietary HD/Gene-Keys prose.
- The framework is invisible scaffolding: reason WITH it, never recite it. A reader who never heard "trim-tab" or "Great Turning" must still feel deeply seen. At most 1–2 framework terms in the whole reading.
- Weight their IKIGAI words above chart signals; chart hints are soft priors, never verdicts. If birth time is uncertain, hold the rising sign and Human Design lightly and say so once.
- Original language only. NEVER reproduce proprietary Gene Keys or Human Design descriptive text — positions/structure and your own words only.`;

async function claudeCore(framework: Framework, charts: Charts, ikigai: Ikigai): Promise<CoreProfile> {
  const anthropic = new Anthropic();
  const msg = await anthropic.messages.create(
    {
      model: MODEL,
      max_tokens: 20000, // room for the three deep lens_readings on top of the portrait
      tools: [PROFILE_TOOL as any],
      tool_choice: { type: "tool", name: "gift_profile" },
      system: [
        { type: "text", text: loadVoice(), cache_control: { type: "ephemeral" } },
        { type: "text", text: V3_DIRECTIVE, cache_control: { type: "ephemeral" } },
        { type: "text", text: `FRAMEWORK (reason WITH this; never recite it):\n${JSON.stringify(slimFramework(framework))}`, cache_control: { type: "ephemeral" } },
      ] as any,
      messages: [
        {
          role: "user",
          content:
            "Reflect this specific person back to themselves: a short recognition, then a deep, chart-grounded portrait, the interpretive chart_threads, and their gift constellation. " +
            "Choose the gift x domain `pairings` (framework ids), most-alive first.\n\n" +
            `CHARTS:\n${JSON.stringify(charts)}\n\nIKIGAI:\n${JSON.stringify(ikigai)}`,
        },
      ],
    },
    // Abort before the serverless function is killed → graceful fixture fallback.
    { signal: AbortSignal.timeout(CLAUDE_TIMEOUT_MS) },
  );
  const block = msg.content.find((b) => b.type === "tool_use") as any;
  const out = block?.input as CoreProfile;
  if (!out?.recognition || !out?.portrait || !out?.pairings?.length || !out?.chart_threads?.length) {
    throw new Error(`incomplete Claude profile (stop_reason=${msg.stop_reason})`);
  }
  // normalize note (the viz reads `note`) from great_turning_link, and back-compat fields
  out.chart_threads = (out.chart_threads || []).map((t) => ({
    ...t,
    note: (t as any).note || clip(t.great_turning_link, 96),
  }));
  if (!out.unique_gifts?.length) out.unique_gifts = (out.gift_constellation || []).map((g) => clip(g.how_they_carry, 90));
  if (!out.domains) out.domains = [];
  if (!out.shadow) out.shadow = [];
  if (!out.narrative) out.narrative = "";
  if (!out.gift_constellation) out.gift_constellation = [];
  if (!out.lens_readings) out.lens_readings = [];
  return out;
}

function dedupePairings(framework: Framework, pairings: Pairing[]): Pairing[] {
  const gids = new Set(framework.gifts.map((g) => g.id));
  const dids = new Set(framework.domains.map((d) => d.id));
  const seen = new Set<string>();
  const out: Pairing[] = [];
  for (const p of pairings) {
    if (!gids.has(p.gift_id) || !dids.has(p.domain_id)) continue;
    const key = `${p.gift_id}|${p.domain_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length >= MAX_PAIRINGS) break;
  }
  return out;
}

export async function generateGiftProfile(
  charts: Charts,
  ikigai: Ikigai,
  opts: { useClaude?: boolean } = {},
): Promise<GiftProfile> {
  const framework = loadFramework();
  let core: CoreProfile;
  let engine = ENGINE_FIXTURE;
  // Claude is the DEFAULT engine (the admin can flip the global mode to fixture,
  // and the env can force it). On any failure — crucially out-of-credits — fall
  // back to the deterministic reading and trip the mode so we stop hitting a dead API.
  if (opts.useClaude) {
    try {
      core = await claudeCore(framework, charts, ikigai);
      engine = MODEL;
    } catch (err) {
      console.error("[interpret] Claude path failed, falling back to fixture:", err);
      await tripIfCreditError(err);
      core = fixtureCore(framework, charts, ikigai);
    }
  } else {
    core = fixtureCore(framework, charts, ikigai);
  }

  const pairings = dedupePairings(framework, core.pairings);
  const nameOf = (id: string, kind: "gift" | "domain") =>
    (kind === "gift" ? framework.gifts : framework.domains).find((x) => x.id === id)?.name || id;

  const trim_tabs = [];
  for (const p of pairings) {
    const row = await resolveTrimTab(p.gift_id, p.domain_id);
    trim_tabs.push(personalizeTrimTab(row, nameOf(p.gift_id, "gift"), nameOf(p.domain_id, "domain"), ikigai));
  }

  // Attach the compact HD signature so consented constellations can compute the
  // relational substrate (electromagnetics, conditioning, penta roles) without
  // ever touching the owner-only raw chart.
  const hd_signature = extractHdSignature(charts["human_design"]) ?? undefined;

  return {
    ...core,
    hd_signature,
    trim_tabs,
    meta: { engine, framework_version: framework.framework_version, voice_version: VOICE_VERSION },
  };
}
