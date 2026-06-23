// Shared types for the framework artifact, charts, and generated profiles.

export type Dimension = { id: string; name: string; description: string };

export type Domain = {
  id: string;
  name: string;
  dimension?: string; // great_turning dimension id
  description: string;
  examples?: string[];
  sub_domains?: string[];
  sources?: string[];
};

export type ChartSignatures = {
  western?: string[];
  vedic?: string[];
  human_design?: string[];
  gene_keys?: string[];
};

export type GreatTurningContribution = {
  summary?: string;
  dimensions?: string[];
  domains?: string[];
  what_its_for?: string;
};

export type Gift = {
  id: string;
  name: string;
  essence?: string;
  description: string; // == essence (back-compat)
  shadow: string;
  modality_signals?: {
    western?: string[];
    vedic?: string[];
    human_design?: string[];
    gene_keys?: string[];
  };
  // v3 enrichment — the thorough archetype (prescriptive weight lives here, not in readings)
  portrait?: string;
  strengths?: string[];
  shadow_how_to_relate?: string;
  chart_signatures?: ChartSignatures;
  great_turning_contribution?: GreatTurningContribution;
  sources?: string[];
};

export type TrimTab = {
  id: string;
  gift_id: string;
  domain_id: string;
  dimension?: string;
  pattern: string;
  why_it_compounds?: string;
  upward_spiral_logic?: string; // back-compat alias
  sources?: string[];
};

export type Framework = {
  framework_version: string;
  voice_ref: string;
  summary: string;
  lineage?: { name: string; contribution: string }[];
  dimensions?: Dimension[];
  domains: Domain[];
  gifts: Gift[];
  trim_tabs: TrimTab[];
  ikigai_lens: { love: string; skill: string; world_need: string; livelihood: string };
  concepts?: { id: string; name: string; definition: string; sources?: string[] }[];
};

export type Ikigai = {
  love: string;
  skill: string;
  world_need: string;
  livelihood: string;
};

export type Charts = Record<string, unknown>;

export type Pairing = { gift_id: string; domain_id: string };

export type ChartLens = "western" | "vedic" | "human_design" | "gene_keys";

// The interpretive bridge between the prose reading and the drawn charts.
// SUPERSET of the chart components' annotation shape — they read only
// { modality, ref, note, tone }; the reading renders the prose fields.
export type ChartThread = {
  modality: ChartLens; // which chart this thread annotates (chart components filter on this)
  ref: string; // anchor token the viz resolves: body name | center/"34-20"/gate | sphere id
  note: string; // short "because X → Y" shown in the viz callout (== great_turning_link, trimmed)
  tone?: "gift" | "shadow" | "orientation" | "background";
  body?: string;
  // reading prose (ignored by the viz, rendered in the interpretive list):
  placement: string; // human-readable, e.g. "Sun in Scorpio in the 8th house"
  plain_meaning: string; // 1–2 plain sentences about the person
  great_turning_link: string; // the fuller "because this placement, that means…" bridge
  gift_id?: string;
};

// Which 2–3 archetypes dominate, and how THIS person carries each.
export type GiftCarry = {
  gift_id: string;
  prominence?: number;
  how_they_carry: string; // 2–4 sentences, grounded in charts + ikigai (not the archetype definition)
  evidence?: string[];
};

// Core profile from the interpreter (Claude or fixture) — selection + prose.
// Trim-tabs are resolved separately from the growing library. Recognition leads;
// the framework recedes to support (no theory recitation).
export type CoreProfile = {
  recognition: string; // SHORT warm opener (1–3 plain, person-specific sentences)
  unique_gifts: string[]; // <=15 words each, second person, how THIS person carries the gift
  domains: { domain_id: string; why: string }[];
  pairings: Pairing[]; // first = the lead move
  shadow: { pattern: string; how_to_relate: string }[];
  narrative: string; // short closing coda (back-compat; may be "")
  // v3 — the comprehensive, chart-grounded reading
  portrait: string; // LONG body, 250–500 words, weaves all four charts + ikigai
  chart_threads: ChartThread[]; // 8–14, span all four lenses; powers the interpretive overlays
  gift_constellation: GiftCarry[]; // 2–3 dominant gifts + how this person carries each
  orientations?: string[]; // 3–6 short leaning phrases
  edges?: { pattern: string; how_to_relate: string }[]; // richer shadow; canonical when present
  // Compact, shareable Human Design structure (no birth data) — travels with the
  // profile so a CONSENTED constellation can compute relational mechanics
  // without ever reading another person's owner-only raw chart. See hd-relational.ts.
  hd_signature?: import("./hd-relational").HdSignature;
};

export type GiftProfile = CoreProfile & {
  trim_tabs: {
    trim_tab_id?: number;
    action: string;
    domain_id: string;
    gift_basis?: string;
    upward_spiral?: string;
    ikigai_fit?: string;
  }[];
  meta?: { engine: string; framework_version: string; voice_version: string };
};

export type ConstellationRead = {
  collective_gifts: string[];
  complementarities: string[];
  frictions: string[];
  gaps: string[];
  make_explicit: string[];
  weaving_guidance: string;
  pairwise?: { a: string; b: string; dynamic: string }[];
  narrative: string;
  // The Human Design relational substrate beneath the gift read — computed
  // structurally (not by the model) from members' consented hd_signatures.
  relational?: {
    engine: string;
    group?: import("./hd-relational").PentaResult;
    pair?: import("./hd-relational").CompareResult;
  };
  meta?: { engine: string; framework_version: string };
};
