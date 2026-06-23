import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Charts, CoreProfile, Framework, Gift, GiftProfile, Ikigai, Pairing } from "./types";
import { loadFramework } from "./framework";
import { loadVoice, VOICE_VERSION } from "./voice";
import { useClaude } from "./llm";
import { personalizeTrimTab, resolveTrimTab } from "./trimtabs";
import { extractHdSignature } from "./hd-relational";

export { useClaude };

const ENGINE_FIXTURE = "fixture-interpreter@2.0.0";
const MODEL = "claude-opus-4-8";
const MAX_PAIRINGS = 3; // a lead + two — not a pile of "highest-leverage" moves

// ---------- chart signal extraction ----------
type Signals = {
  hdType?: string;
  hdProfile?: string;
  hdAuthority?: string;
  definedCenters: string[];
  channels: string[];
  signs: Set<string>;
  sunSign?: string;
  ascSign?: string;
  unknownTime: boolean;
};

function extractSignals(charts: Charts): Signals {
  const hd = (charts["human_design"] as any) || {};
  const western = (charts["western"] as any) || {};
  const signs = new Set<string>();
  const positions = western.positions || {};
  for (const k of Object.keys(positions)) {
    const s = positions[k]?.sign;
    if (s) signs.add(s);
  }
  return {
    hdType: hd.type,
    hdProfile: hd.profile,
    hdAuthority: hd.authority,
    definedCenters: hd.defined_centers || [],
    channels: (hd.channels || []).map((c: any) => (c.gates ? c.gates.join("-") : String(c))),
    signs,
    sunSign: positions?.Sun?.sign,
    ascSign: western?.houses?.ascendant?.sign,
    unknownTime: !!hd.low_confidence,
  };
}

const clip = (s: string, n = 60) => (s && s.length > n ? s.slice(0, n).replace(/[\s,.;:]+\S*$/, "") + "…" : s || "");

// ---------- deterministic, chart+framework-driven fixture ----------
function scoreGift(gift: Gift, sig: Signals, ikigai: Ikigai): number {
  let score = 0;
  const hay = `${ikigai.love} ${ikigai.skill} ${ikigai.world_need} ${ikigai.livelihood}`.toLowerCase();
  const hd = gift.modality_signals?.human_design || [];
  const w = [...(gift.modality_signals?.western || []), ...(gift.modality_signals?.vedic || [])];
  for (const s of hd) {
    const low = s.toLowerCase();
    if (sig.hdType && low.includes(sig.hdType.toLowerCase())) score += 3;
    if (sig.hdAuthority && low.includes(sig.hdAuthority.toLowerCase())) score += 2;
    for (const c of sig.definedCenters) if (low.includes(c.toLowerCase())) score += 2;
    for (const ch of sig.channels) if (low.includes(ch)) score += 3;
  }
  for (const s of w) {
    const low = s.toLowerCase();
    for (const sign of sig.signs) if (low.includes(sign.toLowerCase())) score += 1.5;
  }
  // Ikigai resonance weighted ABOVE chart signal-matching (soft priors).
  const text = `${gift.name} ${gift.essence || gift.description}`.toLowerCase();
  for (const word of text.split(/\W+/)) if (word.length > 4 && hay.includes(word)) score += 2.5;
  return score;
}

function fixtureCore(framework: Framework, charts: Charts, ikigai: Ikigai): CoreProfile {
  const sig = extractSignals(charts);
  const ranked = [...framework.gifts].map((g) => ({ g, s: scoreGift(g, sig, ikigai) })).sort((a, b) => b.s - a.s);
  const chosen = (ranked.filter((r) => r.s > 0).length >= 2 ? ranked.filter((r) => r.s > 0) : ranked).slice(0, 3).map((r) => r.g);
  const chosenIds = new Set(chosen.map((g) => g.id));

  const domainScore = new Map<string, number>();
  for (const tt of framework.trim_tabs) if (chosenIds.has(tt.gift_id)) domainScore.set(tt.domain_id, (domainScore.get(tt.domain_id) || 0) + 2);
  const need = ikigai.world_need.toLowerCase();
  for (const d of framework.domains)
    for (const word of `${d.name} ${d.description}`.toLowerCase().split(/\W+/))
      if (word.length > 4 && need.includes(word)) domainScore.set(d.id, (domainScore.get(d.id) || 0) + 1);
  let domainIds = [...domainScore.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 3);
  if (domainIds.length === 0) domainIds = framework.domains.slice(0, 3).map((d) => d.id);
  const domainName = (id: string) => framework.domains.find((d) => d.id === id)?.name || id;

  const pairings: Pairing[] = [];
  for (const g of chosen) for (const did of domainIds) { pairings.push({ gift_id: g.id, domain_id: did }); if (pairings.length >= MAX_PAIRINGS) break; }
  if (pairings.length >= MAX_PAIRINGS) pairings.length = MAX_PAIRINGS;

  const lead = chosen[0];
  const chartClause = [
    sig.hdType ? `a ${sig.hdType}` : null,
    sig.sunSign ? `Sun in ${sig.sunSign}` : null,
    sig.hdProfile ? `${sig.hdProfile} profile` : null,
  ].filter(Boolean).join(", ");
  const recognition =
    `You love ${clip(ikigai.love, 70)} and you're good at ${clip(ikigai.skill, 60)} — and the world, you sense, needs ${clip(ikigai.world_need, 60)}. ` +
    (chartClause ? `Your chart (${chartClause}) echoes it: ` : `Read together, `) +
    `your medicine gathers most around being ${lead?.name?.toLowerCase().replace(/^the /, "") || "yourself"} — connecting people, tending what matters, and helping good work take root.`;

  const narrative =
    `Across the lenses, a consistent shape shows up` +
    (sig.sunSign ? `, Sun in ${sig.sunSign}` : "") +
    (sig.hdProfile ? `, a ${sig.hdProfile} profile` : "") +
    (sig.ascSign ? `, ${sig.ascSign} rising` : "") +
    `. ` +
    (sig.unknownTime ? "Your birth time is uncertain, so hold the rising sign and Human Design lightly here. " : "") +
    `These are mirrors, not verdicts. What they reflect back is someone whose gifts — ${chosen.map((g) => g.name.replace(/^The /, "")).join(", ")} — want to meet real need in ${domainIds.map(domainName).join(", ")}. ` +
    `Begin where it feels most alive; one honest move tends to open the next.`;

  const chart_threads = buildFixtureThreads(sig, charts, chosen);

  const lead2 = chosen[0];
  const portrait =
    `${recognition} ` +
    `Read across the four lenses, a consistent shape comes through. ` +
    (sig.sunSign ? `Your Sun in ${sig.sunSign} ` : `Your chart `) +
    `points to how you naturally give${sig.ascSign ? `, while ${sig.ascSign} rising shapes how you first meet a room` : ""}. ` +
    (sig.hdType ? `As a ${sig.hdType}${sig.hdAuthority ? ` with ${sig.hdAuthority.toLowerCase()} authority` : ""}, you do your truest work when you move from your own rhythm rather than pushing against it. ` : "") +
    (sig.unknownTime ? `Your birth time is uncertain, so hold the rising sign and Human Design lightly. ` : "") +
    `What these mirrors keep reflecting is someone whose medicine gathers around being ${lead2?.name?.toLowerCase().replace(/^the /, "") || "yourself"} — ` +
    `${clip(lead2?.essence || lead2?.description || "", 120)}. ` +
    `Your second and third notes — ${chosen.slice(1).map((g) => g.name.replace(/^The /, "")).join(" and ") || "the quieter ones"} — round it out. ` +
    `None of this is a verdict; it's a set of doorways. The work that is most yours is where one of these gifts meets a real need in ${domainIds.map(domainName).join(", ")}, ` +
    `and a small, well-placed first move there tends to open the next.`;

  const gift_constellation = chosen.map((g, i) => ({
    gift_id: g.id,
    prominence: chosen.length - i,
    how_they_carry:
      `You carry ${g.name.replace(/^The /, "")} in a way that shows up in what you love and what you're good at — ` +
      `${clip(g.essence || g.description, 110)}`,
  }));

  return {
    recognition,
    unique_gifts: chosen.map((g) => `${g.name.replace(/^The /, "")} — ${clip(g.essence || g.description, 90)}`),
    domains: domainIds.map((id) => ({ domain_id: id, why: `A natural arena for how you give.` })),
    pairings,
    shadow: chosen.map((g) => ({ pattern: g.shadow, how_to_relate: g.shadow_how_to_relate || `Notice it gently when it shows — it's this gift over-reaching, not a flaw to fix.` })),
    narrative,
    portrait,
    chart_threads,
    gift_constellation,
    orientations: chosen.flatMap((g) => (g.strengths || []).slice(0, 2)).slice(0, 6),
    edges: chosen.map((g) => ({ pattern: g.shadow, how_to_relate: g.shadow_how_to_relate || `Tend it; don't fight it.` })),
  };
}

// Build interpretive chart_threads from the real chart data — so the drawn charts
// get annotations even on the deterministic (no-Claude) path.
function buildFixtureThreads(sig: Signals, charts: Charts, chosen: Gift[]): import("./types").ChartThread[] {
  const out: import("./types").ChartThread[] = [];
  const lead = chosen[0]?.name?.replace(/^The /, "").toLowerCase() || "your gift";
  const western = (charts["western"] as any) || {};
  const gk = (charts["gene_keys"] as any) || {};
  const hd = (charts["human_design"] as any) || {};

  if (sig.sunSign)
    out.push({
      modality: "western", ref: "Sun", tone: "gift",
      placement: `Sun in ${sig.sunSign}`,
      plain_meaning: `Your core drive carries the flavor of ${sig.sunSign}.`,
      great_turning_link: `Let that be the engine for being ${lead} — it's where your steadiest energy comes from.`,
      note: `Core drive — fuel for being ${lead}.`,
    });
  const moonSign = western?.positions?.Moon?.sign;
  if (moonSign)
    out.push({
      modality: "western", ref: "Moon", tone: "orientation",
      placement: `Moon in ${moonSign}`,
      plain_meaning: `You're nourished and steadied through ${moonSign} ways of feeling safe.`,
      great_turning_link: `Tend that need first; you give most freely when you're not running on empty.`,
      note: `What steadies you.`,
    });
  if (sig.ascSign && !sig.unknownTime)
    out.push({
      modality: "western", ref: "Ascendant", tone: "orientation",
      placement: `${sig.ascSign} rising`,
      plain_meaning: `You tend to meet new rooms in a ${sig.ascSign} way.`,
      great_turning_link: `Use it as a doorway in — it's how people first learn to trust you.`,
      note: `How you meet a room.`,
    });
  if (sig.hdType) {
    const center = sig.definedCenters[0];
    out.push({
      modality: "human_design", ref: center || sig.hdType, tone: "gift",
      placement: `${sig.hdType}${sig.hdAuthority ? `, ${sig.hdAuthority} authority` : ""}`,
      plain_meaning: `Your design works best when you move from your own rhythm, not pressure.`,
      great_turning_link: `Pace your contribution this way and it stays sustainable for years, not one season.`,
      note: `Work from your own rhythm.`,
    });
    const ch = (hd.channels || [])[0];
    if (ch?.gates)
      out.push({
        modality: "human_design", ref: ch.gates.join("-"), tone: "gift",
        placement: `Channel ${ch.gates.join("-")}`,
        plain_meaning: `A consistent current in how your energy wants to flow.`,
        great_turning_link: `Lean on it — it's a reliable strength others can count on you for.`,
        note: `A reliable current.`,
      });
  }
  const lw = gk?.activation_sequence?.lifes_work;
  if (lw)
    out.push({
      modality: "gene_keys", ref: "lifes_work", tone: "gift",
      placement: `Life's Work in Gate ${lw.gate}.${lw.line}`,
      plain_meaning: `A theme your work keeps circling back toward.`,
      great_turning_link: `When your daily work touches this, it stops feeling like effort and starts compounding.`,
      note: `What your work circles toward.`,
    });
  const purpose = gk?.activation_sequence?.purpose;
  if (purpose)
    out.push({
      modality: "gene_keys", ref: "purpose", tone: "orientation",
      placement: `Purpose in Gate ${purpose.gate}.${purpose.line}`,
      plain_meaning: `A quiet sense of direction underneath your choices.`,
      great_turning_link: `Trust it to choose between good options — it points where you're most needed.`,
      note: `Underlying direction.`,
    });
  return out;
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
      unique_gifts: { type: "array", items: { type: "string" }, description: "<=15 words each, second person, how this person carries a gift — NOT the archetype's definition." },
      domains: { type: "array", items: { type: "object", properties: { domain_id: { type: "string" }, why: { type: "string", description: "one plain sentence" } }, required: ["domain_id", "why"] } },
      pairings: { type: "array", description: "gift x domain intersections, most-alive first; use framework ids.", items: { type: "object", properties: { gift_id: { type: "string" }, domain_id: { type: "string" } }, required: ["gift_id", "domain_id"] } },
      orientations: { type: "array", items: { type: "string" }, description: "3–6 short leaning phrases (how they tend to move)." },
      shadow: { type: "array", items: { type: "object", properties: { pattern: { type: "string" }, how_to_relate: { type: "string" } } } },
      narrative: { type: "string", description: "a short closing coda (1–3 sentences). May be empty if the portrait says it all." },
    },
    required: ["recognition", "portrait", "chart_threads", "gift_constellation", "unique_gifts", "domains", "pairings", "narrative"],
  },
} as const;

const V3_DIRECTIVE = `You write EcoDharma's gift readings. This reading goes DEEP and PERSONAL; the framework stays QUIET.
- LEAD with a short recognition, then a long, warm `+"`portrait`"+` (250–500 words) that genuinely weaves ALL FOUR charts — western tropical, vedic sidereal, Human Design, Gene Keys — with their ikigai, into one plain, specific reflection of who this person is and how they're built.
- Build `+"`chart_threads`"+`: 8–14 bridges across all four lenses, each tying ONE precisely-named placement to how they can take part in the great turning ("because X, that means Y"). Name placements specifically and set `+"`ref`"+` so the drawn chart can attach the note.
- Name the `+"`gift_constellation`"+`: the 2–3 archetypes most alive in them, and how THEY carry each (not the definition).
- The framework is invisible scaffolding: reason WITH it, never recite it. A reader who never heard "trim-tab" or "Great Turning" must still feel deeply seen. At most 1–2 framework terms in the whole reading.
- Weight their IKIGAI words above chart signals; chart hints are soft priors, never verdicts. If birth time is uncertain, hold the rising sign and Human Design lightly and say so once.
- Original language only. NEVER reproduce proprietary Gene Keys or Human Design descriptive text — positions/structure and your own words only.`;

async function claudeCore(framework: Framework, charts: Charts, ikigai: Ikigai): Promise<CoreProfile> {
  const anthropic = new Anthropic();
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 12000,
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
  });
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

export async function generateGiftProfile(charts: Charts, ikigai: Ikigai): Promise<GiftProfile> {
  const framework = loadFramework();
  let core: CoreProfile;
  let engine = ENGINE_FIXTURE;
  if (useClaude()) {
    try {
      core = await claudeCore(framework, charts, ikigai);
      engine = MODEL;
    } catch (err) {
      console.error("[interpret] Claude path failed, falling back to fixture:", err);
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
