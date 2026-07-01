// Deterministic, chart + framework-driven gift interpreter — NO network, NO
// Claude, NO `server-only`. This is the engine's offline brain: given the four
// charts + ikigai, it ranks the framework archetypes and writes a grounded
// reading. interpret.ts uses it as the fixture path / fallback; the MCP server
// uses it to expose the reading engine outside Next.
import type { Charts, ChartThread, CoreProfile, Framework, Gift, Ikigai, Pairing } from "./types";

const MAX_PAIRINGS = 3; // a lead + two — not a pile of "highest-leverage" moves

// ---------- chart signal extraction ----------
export type Signals = {
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

export function extractSignals(charts: Charts): Signals {
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

export const clip = (s: string, n = 60) => (s && s.length > n ? s.slice(0, n).replace(/[\s,.;:]+\S*$/, "") + "…" : s || "");

// Embed a user's own sentence mid-sentence: clip it, drop any trailing terminal
// punctuation (so we never get "…." or ".."), and downcase the first letter unless
// it's "I" or an acronym — so "Bringing people together." reads as "...you love
// bringing people together, ..." instead of a capital mid-clause with a doubled dot.
const DANGLING = /\s+(?:and|or|but|so|the|a|an|to|of|in|on|for|with|that|which|as|at|by|from)$/i;
export const frag = (s: string, n = 90) => {
  const wasClipped = !!s && s.length > n;
  let t = clip(s, n).replace(/[….,;:!?\s]+$/, "").trimStart();
  // Only a CLIP can leave a dangling conjunction/preposition ("…hold money and");
  // drop it so the embedded clause doesn't read as truncated. Never strip the
  // natural ending of a short sentence ("…where food comes from").
  if (wasClipped) while (DANGLING.test(t)) t = t.replace(DANGLING, "");
  if (!t) return "";
  const first = t.split(/\s+/)[0] || "";
  if (first === "I" || /^[A-Z]{2,}/.test(first)) return t;
  return t.charAt(0).toLowerCase() + t.slice(1);
};

// ---------- deterministic, chart+framework-driven fixture ----------
export function scoreGift(gift: Gift, sig: Signals, ikigai: Ikigai): number {
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

export function fixtureCore(framework: Framework, charts: Charts, ikigai: Ikigai): CoreProfile {
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
  const leadName = lead?.name?.replace(/^The /, "") || "the gifts you carry";
  const recognition =
    `You love ${frag(ikigai.love, 96)}, you're good at ${frag(ikigai.skill, 88)}, and the world around you — you sense — needs ${frag(ikigai.world_need, 88)}. ` +
    (chartClause ? `Your chart (${chartClause}) echoes it: ` : `Read together, `) +
    `your medicine gathers most around the ${leadName} in you — connecting people, tending what matters, and helping good work take root.`;

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
    `What these mirrors keep reflecting is someone whose medicine gathers around the ${lead2?.name?.replace(/^The /, "") || "gifts you carry"} in you — ` +
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
export function buildFixtureThreads(sig: Signals, charts: Charts, chosen: Gift[]): ChartThread[] {
  const out: ChartThread[] = [];
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
