// The Living Altar — the taxonomy as types + pure rules.
// docs/v4-living-altar/VISION_AND_TAXONOMY.md §3.
// Pure (no server-only): shared by server actions, MCP, the bot, and tests.

export const ELEMENT_KINDS = ["prayer", "devotion", "root", "work", "practice", "measure", "inquiry", "thread"] as const;
export type ElementKind = (typeof ELEMENT_KINDS)[number];

export const RELATIONS = ["embodies", "strains", "questions", "evidences", "nourishes", "releases", "discovers"] as const;
export type Relation = (typeof RELATIONS)[number];

export const LENSES = ["aliveness", "fidelity", "constitution", "reciprocity", "fruit"] as const;
export type Lens = (typeof LENSES)[number];

export const CADENCES = ["weekly", "lunar", "monthly", "quarterly", "seasonal", "solar_return", "spontaneous"] as const;
export type Cadence = (typeof CADENCES)[number];

export const ROOT_STATUSES = ["held", "questioning", "composting", "renewed"] as const;
export const INQUIRY_STATUSES = ["opened", "living", "integrated"] as const;
export const THREAD_STATUSES = ["proposed", "accepted", "dismissed"] as const;

export type ConstitutionRef = { lens: "gift" | "hd" | "gk" | "astro" | "vedic" | "ikigai"; ref: string; label?: string };
export type ExternalRef = { kind: "url" | "parachute" | "calendar" | "repo"; ref: string; label?: string };

export type AltarElement = {
  id: number;
  lineage_id: number;
  version: number;
  kind: ElementKind;
  title: string;
  body: string; // decrypted
  facets: Record<string, string>;
  status: string;
  constitution_refs: ConstitutionRef[];
  external_refs: ExternalRef[];
  created_at: string;
  retired_at: string | null;
};

export type Strand = {
  id: number;
  reflection_id: number;
  lineage_id: number;
  relation: Relation;
  charge: number; // -2..2
  quote: string;
  proposed_by: "claude" | "det" | "person";
  status: "proposed" | "confirmed" | "rejected";
};

export type Reflection = {
  id: number;
  cadence: Cadence;
  depth: 1 | 2 | 3;
  source: "web" | "telegram" | "mcp" | "email";
  body: string;
  created_at: string;
  ritual_id: number | null;
  strands: Strand[];
  alignment: { lineage_id: number | null; lens: string; value: number | null; note: string }[];
};

export type Altar = {
  prayer: AltarElement | null;
  prayerRings: AltarElement[]; // every version, oldest first — the tree rings
  devotions: AltarElement[];
  roots: AltarElement[];
  works: AltarElement[];
  practices: AltarElement[];
  measures: AltarElement[];
  inquiries: AltarElement[];
  threads: AltarElement[];
  composted: AltarElement[];
};

export const KIND_META: Record<ElementKind, { label: string; plural: string; glyph: string; layer: "sky" | "soil" | "both"; prompt: string }> = {
  prayer: { label: "Prayer", plural: "Prayer", glyph: "☉", layer: "sky", prompt: "What is your life in service to?" },
  devotion: { label: "Devotion", plural: "Devotions", glyph: "✶", layer: "sky", prompt: "Who and what do you place on the altar?" },
  root: { label: "Root", plural: "Roots", glyph: "⟟", layer: "soil", prompt: "What do you believe that makes this matter — and why this way?" },
  work: { label: "Work", plural: "Works", glyph: "◈", layer: "sky", prompt: "Which projects, roles and offerings carry the prayer?" },
  practice: { label: "Practice", plural: "Practices", glyph: "∿", layer: "soil", prompt: "Which disciplines keep the vessel clean?" },
  measure: { label: "Measure", plural: "Measures", glyph: "◎", layer: "both", prompt: "How will you know you're aligned?" },
  inquiry: { label: "Inquiry", plural: "Inquiries", glyph: "?", layer: "soil", prompt: "What question are you living?" },
  thread: { label: "Thread", plural: "Threads", glyph: "≋", layer: "both", prompt: "What pattern keeps returning?" },
};

export const LENS_META: Record<Lens, { label: string; question: string }> = {
  aliveness: { label: "Aliveness", question: "Does this make me more alive — or drain me?" },
  fidelity: { label: "Fidelity", question: "Does this actually serve the prayer and devotions?" },
  constitution: { label: "Constitution", question: "Am I working with my design — strategy, authority, gifts — or against it?" },
  reciprocity: { label: "Reciprocity", question: "Is nourishment flowing both ways?" },
  fruit: { label: "Fruit", question: "What evidence in the world shows this bearing fruit?" },
};

export const RELATION_META: Record<Relation, { label: string; verb: string; defaultCharge: number }> = {
  embodies: { label: "embodies", verb: "lived", defaultCharge: 1 },
  strains: { label: "strains", verb: "strained against", defaultCharge: -1 },
  questions: { label: "questions", verb: "questioned", defaultCharge: 0 },
  evidences: { label: "evidences", verb: "showed fruit for", defaultCharge: 1 },
  nourishes: { label: "nourishes", verb: "was nourished by", defaultCharge: 1 },
  releases: { label: "releases", verb: "let go of", defaultCharge: 0 },
  discovers: { label: "discovers", verb: "discovered", defaultCharge: 1 },
};

/** Cadence → loop depth (single / double / triple). */
export const CADENCE_DEPTH: Record<Cadence, 1 | 2 | 3> = {
  weekly: 1, lunar: 1, spontaneous: 1, monthly: 2, quarterly: 2, seasonal: 3, solar_return: 3,
};

export function defaultStatus(kind: ElementKind): string {
  if (kind === "root") return "held";
  if (kind === "inquiry") return "opened";
  if (kind === "thread") return "proposed";
  return "active";
}

/** Which status transitions are allowed — the person may move freely within a kind's set. */
export function validStatus(kind: ElementKind, status: string): boolean {
  if (kind === "root") return (ROOT_STATUSES as readonly string[]).includes(status);
  if (kind === "inquiry") return (INQUIRY_STATUSES as readonly string[]).includes(status);
  if (kind === "thread") return (THREAD_STATUSES as readonly string[]).includes(status);
  return status === "active";
}

export const clampCharge = (n: unknown): number => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(-2, Math.min(2, v)) : 0;
};

export const isRelation = (r: unknown): r is Relation => (RELATIONS as readonly string[]).includes(r as string);
export const isKind = (k: unknown): k is ElementKind => (ELEMENT_KINDS as readonly string[]).includes(k as string);
export const isCadence = (c: unknown): c is Cadence => (CADENCES as readonly string[]).includes(c as string);

export function groupAltar(rows: AltarElement[], allPrayerVersions: AltarElement[]): Altar {
  const live = rows.filter((r) => !r.retired_at);
  const by = (k: ElementKind) => live.filter((r) => r.kind === k);
  const prayers = by("prayer");
  return {
    prayer: prayers[0] ?? null,
    prayerRings: [...allPrayerVersions].sort((a, b) => a.version - b.version),
    devotions: by("devotion"),
    roots: by("root"),
    works: by("work"),
    practices: by("practice"),
    measures: by("measure"),
    inquiries: by("inquiry"),
    threads: by("thread"),
    composted: rows.filter((r) => r.retired_at),
  };
}

export function altarElements(a: Altar): AltarElement[] {
  return [
    ...(a.prayer ? [a.prayer] : []), ...a.devotions, ...a.roots, ...a.works, ...a.practices,
    ...a.measures, ...a.inquiries, ...a.threads,
  ];
}

export const isEmptyAltar = (a: Altar) => !a.prayer && altarElements(a).length === 0;
