// Deterministic, chart + framework-driven gift interpreter — NO network, NO
// Claude, NO `server-only`. This is the engine's offline brain: given the four
// charts + ikigai, it ranks the framework archetypes and writes a grounded
// reading. interpret.ts uses it as the fixture path / fallback; the MCP server
// uses it to expose the reading engine outside Next.
import type { Charts, ChartThread, CoreProfile, Framework, Gift, Ikigai, LensReading, Pairing } from "./types";
import {
  SIGN_MEANING, HOUSE_MEANING, PLANET_MEANING, ASPECT_MEANING,
  HD_TYPE_MEANING, HD_AUTHORITY_MEANING, HD_CENTER_MEANING,
  GK_SPHERE_MEANING, GK_SPHERE_LABEL, houseOf,
} from "./astro-meanings";

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
  const gkLw = (charts["gene_keys"] as any)?.activation_sequence?.lifes_work;
  const vedicSun = (charts["vedic"] as any)?.positions?.Sun?.sign;
  const portrait =
    `${recognition} ` +
    `Read across the four lenses, a consistent shape comes through. ` +
    (sig.sunSign ? `Your Sun in ${sig.sunSign} ` : `Your chart `) +
    `points to how you naturally give${sig.ascSign && !sig.unknownTime ? `, while ${sig.ascSign} rising shapes how you first meet a room` : ""}. ` +
    (vedicSun && vedicSun !== sig.sunSign ? `Through the Vedic sky that same Sun reads as ${vedicSun}, a slower, more karmic underlayer to the same story. ` : "") +
    (sig.hdType ? `As a ${sig.hdType}${sig.hdAuthority ? ` with ${sig.hdAuthority.toLowerCase()} authority` : ""}, you do your truest work when you move from your own rhythm rather than pushing against it. ` : "") +
    (gkLw ? `The Gene Keys put your Life's Work in Gate ${gkLw.gate}.${gkLw.line} — a theme your days keep circling back toward. ` : "") +
    (sig.unknownTime ? `Your birth time is uncertain, so hold the rising sign and Human Design lightly. ` : "") +
    `What these mirrors keep reflecting is someone whose medicine gathers around the ${lead2?.name?.replace(/^The /, "") || "gifts you carry"} in you — ` +
    `${clip(lead2?.essence || lead2?.description || "", 120)}. ` +
    `Your second and third notes — ${chosen.slice(1).map((g) => g.name.replace(/^The /, "")).join(" and ") || "the quieter ones"} — round it out. ` +
    `None of this is a verdict; it's a set of doorways. The work that is most yours is where one of these gifts meets a real need in ${domainIds.map(domainName).join(", ")}, ` +
    `and a small, well-placed first move there tends to open the next.`;

  // A short, person-specific chart anchor to ground the gift-carry prose.
  const chartHint =
    sig.hdType && sig.sunSign ? `your ${sig.sunSign} Sun and ${sig.hdType} design`
    : sig.sunSign ? `your ${sig.sunSign} Sun`
    : sig.hdType ? `your ${sig.hdType} design`
    : "the shape your charts keep drawing";

  const gift_constellation = chosen.map((g, i) => ({
    gift_id: g.id,
    prominence: chosen.length - i,
    how_they_carry:
      `You carry the ${g.name.replace(/^The /, "")} in a way that's recognizably yours — it shows up in ${frag(i === 0 ? ikigai.skill : ikigai.love, 60)} and in ${chartHint}. ` +
      `At its best it looks like ${frag((g.strengths || [])[0] || g.essence || g.description, 100)}.`,
  }));

  // Domain "why" grounded in the gift that actually serves it (not a static line).
  const domainWhy = (id: string): string => {
    const g = chosen.find((x) => x.great_turning_contribution?.domains?.includes(id)) || lead;
    if (!g) return `A natural arena for how you give.`;
    return `This is where the ${g.name.replace(/^The /, "")} in you meets real need — ${frag(gtOf(g), 130)}.`;
  };

  const lens_readings = buildLensReadings(sig, charts, chosen, ikigai);

  return {
    recognition,
    unique_gifts: chosen.map((g) => `${cap(frag((g.strengths || [])[0] || g.essence || g.description, 72))} — the ${g.name.replace(/^The /, "")} in you`),
    domains: domainIds.map((id) => ({ domain_id: id, why: domainWhy(id) })),
    pairings,
    shadow: chosen.map((g) => ({ pattern: g.shadow, how_to_relate: g.shadow_how_to_relate || `Notice it gently when it shows — it's this gift over-reaching, not a flaw to fix.` })),
    narrative,
    portrait,
    chart_threads,
    gift_constellation,
    lens_readings,
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
  const vedic = (charts["vedic"] as any) || {};
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
  const vedicSun = vedic?.positions?.Sun?.sign;
  if (vedicSun)
    out.push({
      modality: "vedic", ref: "Sun", tone: "background",
      placement: `Sidereal Sun in ${vedicSun}`,
      plain_meaning: `Beneath the tropical picture, a slower, more karmic layer colored by ${vedicSun}.`,
      great_turning_link: `Hold it lightly — it points to the deeper grain of what you're here to work out over a lifetime.`,
      note: `The karmic underlayer.`,
    });
  const vedicMoon = vedic?.positions?.Moon?.sign;
  if (vedicMoon && vedicMoon !== vedicSun)
    out.push({
      modality: "vedic", ref: "Moon", tone: "orientation",
      placement: `Sidereal Moon in ${vedicMoon}`,
      plain_meaning: `In the Vedic tradition the Moon is central — yours carries ${vedicMoon}.`,
      great_turning_link: `It's a clue to what genuinely restores you, which is what lets you keep giving.`,
      note: `What restores you.`,
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

// ---------- deep per-lens readings (the flagship depth, deterministic path) ----------

const gtOf = (g?: Gift) =>
  g?.great_turning_contribution?.what_its_for || g?.great_turning_contribution?.summary || g?.essence || g?.description || "";

// A varied "how this equips you for the turning" line, rotating through the person's
// chosen gifts so the three sections don't all name the same archetype.
function turningFor(chosen: Gift[], i: number, quality: string): string {
  const g = chosen[i % Math.max(chosen.length, 1)];
  const name = g?.name?.replace(/^The /, "") || "the work that's yours";
  return `That ${quality} is exactly what the ${name} in you runs on — ${frag(gtOf(g), 150)}.`;
}

export function buildLensReadings(sig: Signals, charts: Charts, chosen: Gift[], ikigai: Ikigai): LensReading[] {
  const readings: LensReading[] = [];
  const western = (charts["western"] as any) || {};
  const vedic = (charts["vedic"] as any) || {};
  const hd = (charts["human_design"] as any) || {};
  const gk = (charts["gene_keys"] as any) || {};
  const cusps: number[] | undefined = western?.houses?.cusps;
  const pos = western.positions || {};

  // ---- Astrology (western + vedic) ----
  {
    const placements: LensReading["placements"] = [];
    const bodyOrder = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
    let i = 0;
    for (const body of bodyOrder) {
      const p = pos[body];
      if (!p?.sign) continue;
      const timeSafe = !sig.unknownTime || (body !== "Moon");
      const house = timeSafe ? houseOf(p.lon, cusps) : null;
      const houseStr = house ? `, ${ordinal(house)} house` : "";
      const label = `${body.replace("_", " ")} in ${p.sign}${houseStr}`;
      const houseClause = house ? ` in the arena of ${HOUSE_MEANING[house]}` : "";
      const meaning = `${cap(PLANET_MEANING[body] || "this part of you")} carries ${p.sign}'s ${SIGN_MEANING[p.sign] || "quality"}${houseClause}.`;
      placements.push({ label, meaning, great_turning: turningFor(chosen, i, signQuality(p.sign)) });
      if (++i >= 5) break;
    }
    if (sig.ascSign && !sig.unknownTime) {
      placements.unshift({
        label: `${sig.ascSign} rising`,
        meaning: `You tend to meet a room the ${sig.ascSign} way — ${SIGN_MEANING[sig.ascSign] || "your own signature"}.`,
        great_turning: `It's the doorway others come through to trust you; lead with it when you're gathering people.`,
      });
    }
    // A tight aspect, if any, adds relational texture.
    const asp = (western.aspects || []).find((a: any) => a.orb != null && a.orb < 3 && ASPECT_MEANING[a.aspect]);
    if (asp) {
      placements.push({
        label: `${asp.p1.replace("_", " ")} ${asp.aspect} ${asp.p2.replace("_", " ")}`,
        meaning: `${cap(PLANET_MEANING[asp.p1] || asp.p1)} and ${PLANET_MEANING[asp.p2] || asp.p2} sit ${ASPECT_MEANING[asp.aspect]}.`,
        great_turning: `Worth knowing your own wiring here — it shapes how these two energies cooperate in your work.`,
      });
    }
    const ved = vedic?.positions?.Sun?.sign;
    const vedicClause = ved && ved !== sig.sunSign
      ? `Read through the sidereal (Vedic) sky, your Sun shifts to ${ved} — a quieter, karmic underlayer beneath the tropical picture, ${SIGN_MEANING[ved] || "its own note"}.`
      : `The Vedic (sidereal) chart echoes the same shape from a slower, more karmic angle.`;
    const reading =
      `Your western chart is a map of how you're built to give. ${sig.sunSign ? `With the Sun in ${sig.sunSign}, ` : ""}` +
      `your core energy${sig.ascSign && !sig.unknownTime ? `, met first through ${sig.ascSign} rising,` : ""} wants to be spent where it counts. ` +
      (pos.Moon?.sign ? `The Moon in ${pos.Moon.sign} tells you what you need to feel safe enough to keep going — tend that and you don't burn out. ` : "") +
      `${vedicClause} ` +
      `None of this is fate; it's a mirror. Held lightly, it points to where your particular energy meets what the world around you actually needs.`;
    readings.push({
      lens: "astrology",
      title: "Astrology — Western & Vedic",
      summary: sig.sunSign ? `A ${sig.sunSign} core, read through both the tropical and sidereal skies.` : `Your natal sky, read through both the tropical and sidereal traditions.`,
      reading,
      placements: placements.slice(0, 6),
    });
  }

  // ---- Human Design ----
  if (hd.type) {
    const placements: LensReading["placements"] = [];
    placements.push({
      label: `${hd.type}${hd.profile ? `, ${hd.profile} profile` : ""}`,
      meaning: `${cap(HD_TYPE_MEANING[hd.type] || "a design with its own rhythm")}.`,
      great_turning: turningFor(chosen, 0, "way of working"),
    });
    if (hd.authority)
      placements.push({
        label: `${hd.authority} authority`,
        meaning: `Your most reliable way to decide: ${HD_AUTHORITY_MEANING[hd.authority] || "your own inner signal"}.`,
        great_turning: `Decisions made this way hold up — they're how you say a sustainable yes to the work that's really yours.`,
      });
    for (const c of (hd.defined_centers || []).slice(0, 3)) {
      if (!HD_CENTER_MEANING[c]) continue;
      placements.push({
        label: `Defined ${c} center`,
        meaning: `A steady, dependable source in you: ${HD_CENTER_MEANING[c]}.`,
        great_turning: turningFor(chosen, placements.length, "steadiness"),
      });
    }
    const ch = (hd.channels || [])[0];
    if (ch?.gates)
      placements.push({
        label: `Channel ${ch.gates.join("-")}`,
        meaning: `A consistent current wired across your design — a strength others can count on.`,
        great_turning: `Lean on it; it's the kind of reliability movements are built from.`,
      });
    const reading =
      `Human Design reads the mechanics of how your energy actually runs. ${cap(HD_TYPE_MEANING[hd.type] || "You have your own rhythm")}. ` +
      (hd.authority ? `Your ${hd.authority.toLowerCase()} authority means ${HD_AUTHORITY_MEANING[hd.authority] || "you have an inner compass worth trusting"} — following it is what keeps your contribution sustainable rather than forced. ` : "") +
      ((hd.defined_centers || []).length ? `Your defined centers (${(hd.defined_centers || []).slice(0, 4).join(", ")}) are the parts of you that are consistent and dependable — what you can offer others reliably. ` : "") +
      (sig.unknownTime ? `Because your birth time is uncertain, hold the specifics here lightly. ` : "") +
      `The turning doesn't need you to work like everyone else; it needs you working the way you're actually built to.`;
    readings.push({
      lens: "human_design",
      title: "Human Design",
      summary: `${hd.type}${hd.authority ? ` with ${hd.authority.toLowerCase()} authority` : ""} — how your energy is wired to contribute.`,
      reading,
      placements: placements.slice(0, 6),
    });
  }

  // ---- Gene Keys ----
  {
    const seq = gk?.activation_sequence || {};
    const spheres: Array<[string, any]> = [
      ["lifes_work", seq.lifes_work], ["evolution", seq.evolution],
      ["radiance", seq.radiance], ["purpose", seq.purpose],
      ["vocation", gk?.pearl_sequence?.vocation],
    ];
    const placements: LensReading["placements"] = [];
    let i = 0;
    for (const [id, s] of spheres) {
      if (!s?.gate) continue;
      placements.push({
        label: `${GK_SPHERE_LABEL[id] || id} — Gate ${s.gate}.${s.line}`,
        meaning: `${cap(GK_SPHERE_MEANING[id] || "a thread of your path")}.`,
        great_turning: turningFor(chosen, i++, "thread"),
      });
    }
    if (placements.length) {
      const lw = seq.lifes_work;
      const reading =
        `The Gene Keys sketch a contemplative arc through your life — not a verdict, a set of doorways. ` +
        (lw ? `Your Life's Work sits in Gate ${lw.gate}.${lw.line}: ${GK_SPHERE_MEANING.lifes_work}. ` : "") +
        (seq.purpose ? `Beneath it, your Purpose (Gate ${seq.purpose.gate}.${seq.purpose.line}) is ${GK_SPHERE_MEANING.purpose} — the quiet why under the visible what. ` : "") +
        `Taken together they describe a direction more than a destination: the places where, if you lean in, your gift tends to compound rather than drain. ` +
        `Contemplate them slowly; they're most useful held as living questions, not fixed answers.`;
      readings.push({
        lens: "gene_keys",
        title: "Gene Keys",
        summary: `Your activation sequence — the contemplative thread from life's work to purpose.`,
        reading,
        placements: placements.slice(0, 6),
      });
    }
  }

  return readings;
}

// small text helpers
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};
const signQuality = (sign: string) => (SIGN_MEANING[sign] || "quality").split("—")[0].split(",")[0].trim();
