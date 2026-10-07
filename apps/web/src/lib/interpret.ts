import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Charts, CoreProfile, Framework, GiftProfile, Ikigai } from "./types";
import { loadFramework } from "./framework";
import { loadVoice, VOICE_VERSION } from "./voice";
import { useClaude } from "./llm";
import { setInterpreterMode } from "./config";
import { personalizeTrimTab, resolveTrimTab } from "./trimtabs";
import { extractHdSignature } from "./hd-relational";
// Chart signal extraction + the deterministic fixture interpreter live in
// interpret-fixture.ts (pure, no `server-only`) so the MCP server can reuse them.
import { fixtureCore, clip, dedupePairings, repairCore } from "./interpret-fixture";
import { normalizeReading, healReadingCore } from "./normalize-reading";
import { GENE_KEYS } from "./gene-keys";
import { guardReading } from "./guard";

// A compact, VERIFIED fact sheet of this person's placements. The model reads the
// raw chart JSON too, but this list is what it may name — and the guard enforces it.
export function factSheet(charts: Charts): string {
  const lines: string[] = [];
  const w = (charts["western"] as any) || {};
  const pos = (p: any) => Object.entries<any>(p || {}).map(([b, v]) => `${b} ${v.sign} ${Number(v.deg_in_sign ?? 0).toFixed(1)}°`).join(", ");
  if (w.positions) lines.push(`WESTERN (tropical): ${pos(w.positions)}; Ascendant ${w.houses?.ascendant?.sign}; Midheaven ${w.houses?.midheaven?.sign}`);
  const j = ((charts["vedic"] as any) || {}).jyotish;
  if (j) {
    const g = Object.entries<any>(j.grahas || {}).map(([b, v]) => `${b} ${v.sign} (house ${v.house}, ${v.nakshatra?.name} pada ${v.nakshatra?.pada})`).join(", ");
    lines.push(`VEDIC (sidereal Lahiri, whole-sign houses): Lagna ${j.lagna?.sign} (${j.lagna?.nakshatra?.name}); ${g}`);
  } else {
    lines.push("VEDIC: nakshatras were NOT computed for this chart — do not name any nakshatra.");
  }
  const hd = (charts["human_design"] as any) || {};
  if (hd.type) {
    lines.push(`HUMAN DESIGN: ${hd.type}, ${hd.authority_detail || hd.authority} authority, ${hd.profile} profile, ${hd.definition} definition; defined centers ${(hd.defined_centers || []).join(", ")}; channels ${(hd.channels || []).map((c: any) => c.gates.join("-")).join(", ") || "none"}`);
    if ((hd.sensitive_activations || []).length) lines.push(`HOLD LIGHTLY (within 5′ of a boundary): ${hd.sensitive_activations.join(", ")}`);
    if ((hd.time_sensitive_fields || []).length) lines.push(`TIME-SENSITIVE (changes within ±10 min of birth time): ${hd.time_sensitive_fields.join(", ")}`);
  }
  const gk = (charts["gene_keys"] as any) || {};
  const sph = (seq: any) => Object.entries<any>(seq || {}).filter(([, v]) => v?.gate).map(([k, v]) => `${k} ${v.gate}.${v.line}`).join(", ");
  if (gk.activation_sequence) lines.push(`GENE KEYS: ${sph(gk.activation_sequence)}; ${sph(gk.venus_sequence)}; ${sph(gk.pearl_sequence)}`);
  return lines.join("\n");
}

// The shadow→gift→siddhi names for THIS person's gene-key gates — so Claude can
// name them exactly (the names aren't proprietary; the descriptive prose is).
function geneKeyNames(charts: Charts): string {
  const gk = (charts["gene_keys"] as any) || {};
  const gates = new Set<number>();
  for (const seq of [gk.activation_sequence, gk.venus_sequence, gk.pearl_sequence]) {
    for (const k in seq || {}) { const g = seq[k]?.gate; if (typeof g === "number") gates.add(g); }
  }
  return [...gates].sort((a, b) => a - b)
    .map((g) => (GENE_KEYS[g] ? `Gate ${g}: ${GENE_KEYS[g].shadow} → ${GENE_KEYS[g].gift} → ${GENE_KEYS[g].siddhi}` : ""))
    .filter(Boolean).join("; ");
}

export { useClaude };

const ENGINE_FIXTURE = "fixture-interpreter@2.0.0";
// section-level repair + pairing dedupe live in interpret-fixture.ts (pure), so
// the read-time healer and its unit tests can exercise them without `server-only`.
// Opus for maximum depth. A full reading runs ~90–120s, which fits the serverless
// budget on Fluid Compute (the routes set maxDuration=300). Set ECODHARMA_PROFILE_MODEL=
// claude-sonnet-4-6 for a faster (~50–70s), slightly lighter reading if preferred.
const MODEL = process.env.ECODHARMA_PROFILE_MODEL || "claude-opus-4-8";
// Safety net: abort well before the function's own limit so a genuinely hung call
// still falls back to the (rich, deterministic) fixture instead of a blank profile.
const CLAUDE_TIMEOUT_MS = Number(process.env.ECODHARMA_CLAUDE_TIMEOUT_MS || 240_000);

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
            ref: { type: "string", description: "anchor the chart resolves. western/vedic: a body ('Sun','Moon','Venus','North_Node') or angle ('Ascendant','Midheaven'). human_design: a center ('Sacral'), a channel ('34-20'), or a gate ('34'). gene_keys: a sphere id ('lifes_work','evolution','radiance','purpose','attraction','iq','eq','sq','core','vocation','culture','brand','pearl')." },
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
- READ FROM THE CHARTS FIRST. The recognition and portrait must reflect who this person IS and how they're BUILT — drawn from their western, vedic, Human Design and Gene Keys placements — back to them. Do NOT open by repeating their ikigai answers; a reader should feel you SAW something in their chart, not that you paraphrased their form responses.
- LEAD with a short recognition (a chart-grounded insight about them), then a long, warm `+"`portrait`"+` (250–500 words) that genuinely weaves ALL FOUR charts — western tropical, vedic sidereal, Human Design, Gene Keys — into one plain, specific reflection of who this person is and how they're built.
- Build `+"`chart_threads`"+`: 8–14 bridges across all four lenses, each tying ONE precisely-named placement to how they can take part in the great turning ("because X, that means Y"). Name placements specifically and set `+"`ref`"+` so the drawn chart can attach the note.
- Name the `+"`gift_constellation`"+`: the 2–3 archetypes most alive in them, and how THEY carry each (not the definition).
- Write `+"`lens_readings`"+`: THREE deep sections — astrology (western + vedic together), human_design, gene_keys — each 2–3 paragraphs PLUS 4–6 explained placements, reading THIS person's real chart in that lens through the great turning. Go thorough here; this is where the reading earns its depth. Name real placements ONLY from the VERIFIED PLACEMENTS sheet (signs, houses, aspects, nakshatras; type/authority/profile/centers/channels; the gene-key spheres by gate.line) and explain what each equips them to do. Never name a placement, nakshatra, gate, or channel that is not on the sheet — an automated guard removes any that are. Never reproduce proprietary HD/Gene-Keys prose.
- The framework is invisible scaffolding: reason WITH it, never recite it. A reader who never heard "trim-tab" or "Great Turning" must still feel deeply seen. At most 1–2 framework terms in the whole reading.
- Use their IKIGAI answers to CONFIRM and ground the chart reading — a resonance check, woven in lightly — but never recite their answers back to them verbatim. The charts lead; their words quietly corroborate. If birth time is uncertain, hold the rising sign and Human Design lightly and say so once.
- Original language only. You MAY name a Gene Key's Shadow / Gift / Siddhi (the single-word names provided) and any computed HD structure, but NEVER reproduce proprietary Gene Keys or Human Design descriptive PROSE — the paragraphs of meaning must be your own words.`;

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
            `VERIFIED PLACEMENTS (the only placements you may name):\n${factSheet(charts)}\n\n` +
            `CHARTS:\n${JSON.stringify(charts)}\n\nIKIGAI:\n${JSON.stringify(ikigai)}\n\n` +
            `GENE KEY NAMES (shadow → gift → siddhi for this person's gates — use these EXACT names in the gene_keys lens):\n${geneKeyNames(charts)}`,
        },
      ],
    },
    // Abort before the serverless function is killed → graceful fixture fallback.
    { signal: AbortSignal.timeout(CLAUDE_TIMEOUT_MS) },
  );
  const block = msg.content.find((b) => b.type === "tool_use") as any;
  // Coerce the tool payload into a structurally valid profile FIRST — the model
  // can return ANY field with the wrong shape (arrays as strings/objects, junk
  // items inside arrays), and nothing downstream may ever crash on it. Sections
  // that come back empty here are backfilled from the fixture by repairCore.
  const out: CoreProfile = normalizeReading(block?.input);
  // Only the heart of the reading is irreplaceable — if recognition or portrait
  // is missing, discard and fall back to the full fixture. Everything else is
  // backfilled section-by-section (see repairCore), so we keep Claude's richness.
  if (!out.recognition.trim() || !out.portrait.trim()) {
    throw new Error(`incomplete Claude profile (stop_reason=${msg.stop_reason})`);
  }
  // Prefer a Claude-derived unique_gifts fallback (more personal than the
  // fixture's) before repairCore reaches for the fixture.
  if (!out.unique_gifts.length) {
    out.unique_gifts = out.gift_constellation.map((g) => clip(g.how_they_carry, 90)).filter(Boolean);
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
      // Backfill any thin/missing section from the fixture so the reading is
      // always complete — never omit content just because the model skimped.
      const rep = repairCore(core, framework, charts, ikigai);
      core = rep.core;
      engine = rep.repaired.length ? `${MODEL}+repair` : MODEL;
      if (rep.repaired.length) console.warn(`[interpret] repaired ${rep.repaired.join(", ")} from fixture`);
    } catch (err) {
      console.error("[interpret] Claude path failed, falling back to fixture:", err);
      await tripIfCreditError(err);
      core = fixtureCore(framework, charts, ikigai);
    }
  } else {
    core = fixtureCore(framework, charts, ikigai);
  }

  // The interpretation guard: correct or remove any placement claim the charts
  // don't support (wrong sign, invented nakshatra, phantom gate/channel…).
  const guarded = guardReading(core, charts);
  core = guarded.core;
  if (guarded.report.fixed || guarded.report.removed) {
    engine = `${engine}+guard`;
    console.warn(`[interpret] guard fixed ${guarded.report.fixed}, removed ${guarded.report.removed}: ${guarded.report.notes.slice(0, 8).join("; ")}`);
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

  // Final write-time guarantee: whatever engine produced the core, the object
  // we persist is structurally valid. Reads normalize too (see healStoredReading),
  // but no row written from here on should ever need it.
  return normalizeReading({
    ...core,
    hd_signature,
    trim_tabs,
    meta: { engine, framework_version: framework.framework_version, voice_version: VOICE_VERSION },
  });
}

/**
 * Read-time healing for STORED readings. Rows written before write-time
 * hardening existed (or by an older engine) can be malformed — a required array
 * stored as a string/object — or missing whole sections, and they will stay
 * that way in the DB no matter how good generation gets. This gives reads the
 * same guarantee generation has: normalize (can never crash), then backfill
 * every gap from the deterministic fixture computed from the person's own
 * charts. Healing is best-effort — if the fixture can't run, the normalized
 * reading is still returned and is safe to render. Callers should persist the
 * healed profile when `healed` is non-empty so the row converges to complete.
 */
export async function healStoredReading(
  raw: unknown,
  charts: Charts,
  ikigai: Ikigai,
): Promise<{ profile: GiftProfile; healed: string[] }> {
  const framework = loadFramework();
  // The pure structural heal (normalize + fixture backfill) — never throws.
  const { profile: gp, healed } = healReadingCore(raw, framework, charts, ikigai);
  // Trim-tabs come from the library (DB), so they're rebuilt here, not in the core.
  try {
    if (!gp.trim_tabs.length && gp.pairings.length) {
      const nameOf = (id: string, kind: "gift" | "domain") =>
        (kind === "gift" ? framework.gifts : framework.domains).find((x) => x.id === id)?.name || id;
      for (const p of gp.pairings) {
        const row = await resolveTrimTab(p.gift_id, p.domain_id);
        gp.trim_tabs.push(personalizeTrimTab(row, nameOf(p.gift_id, "gift"), nameOf(p.domain_id, "domain"), ikigai));
      }
      healed.push("trim_tabs");
    }
  } catch (err) {
    console.error("[interpret] trim-tab heal failed (reading is still complete without them):", err);
  }
  if (healed.length) {
    gp.meta = {
      engine: `${gp.meta?.engine || "unknown"}+heal`,
      framework_version: gp.meta?.framework_version || framework.framework_version,
      voice_version: gp.meta?.voice_version || VOICE_VERSION,
    };
  }
  return { profile: gp, healed };
}
