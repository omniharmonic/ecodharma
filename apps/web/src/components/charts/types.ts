// Shared chart data shapes + the interpretive-layer ChartThread type for the
// EcoDharma v3 chart-viz components (NatalWheel / BodyGraph / GeneKeysViz).
// These mirror the persisted `charts.raw_json` payloads exactly; positions and
// structure only — never any proprietary descriptive text.

/** One placed body: ecliptic longitude (0 = 0° Aries), its sign + degree-in-sign. */
export interface BodyPosition {
  lon: number;
  sign: string;
  deg_in_sign: number;
}

/** Angular + intermediate house data. `cusps` is 12 ecliptic longitudes (house 1..12). */
export interface Houses {
  ascendant: BodyPosition;
  midheaven: BodyPosition;
  cusps: number[];
}

export type AspectKind =
  | "conjunction"
  | "sextile"
  | "square"
  | "trine"
  | "opposition";

export interface Aspect {
  p1: string;
  p2: string;
  aspect: AspectKind;
  angle: number;
  orb: number;
}

/** western and vedic share this shape; vedic additionally carries `ayanamsa`. */
export interface NatalChartData {
  positions: Record<string, BodyPosition>;
  houses: Houses;
  aspects?: Aspect[];
  ayanamsa?: number;
}

// ---- Human Design (consumed by BodyGraph) ----
export interface HDGate {
  gate: number;
  line: number;
}
export interface HDChannel {
  gates: [number, number];
  centers: [string, string];
}
export interface HumanDesign {
  type:
    | "Generator"
    | "Manifesting Generator"
    | "Manifestor"
    | "Projector"
    | "Reflector";
  profile: string;
  authority:
    | "Emotional"
    | "Sacral"
    | "Splenic"
    | "Ego"
    | "Self-Projected"
    | "Mental"
    | "Lunar";
  definition: string;
  defined_centers: string[];
  open_centers: string[];
  channels: HDChannel[];
  gates: {
    personality: Record<string, HDGate>;
    design: Record<string, HDGate>;
  };
  incarnation_cross_gates: {
    personality_sun: number;
    personality_earth: number;
    design_sun: number;
    design_earth: number;
  };
  low_confidence: boolean;
}

// ---- Gene Keys (consumed by GeneKeysViz) ----
export interface GKSphere {
  gate: number;
  line: number;
}
export interface GeneKeys {
  activation_sequence: {
    lifes_work: GKSphere;
    evolution: GKSphere;
    radiance: GKSphere;
    purpose: GKSphere;
  };
  venus_sequence: {
    attraction: GKSphere;
    iq: GKSphere;
    eq: GKSphere;
    sq: GKSphere;
  };
  pearl_sequence: {
    vocation: GKSphere;
    culture: GKSphere;
    brand: GKSphere;
  };
  note?: string;
}

/**
 * The interpretive bridge between reading prose and the drawn charts.
 * `note` is our-words "placement → Great-Turning meaning". `ref` is the anchor
 * each component resolves against its own geometry (and silently ignores when
 * it can't draw it):
 *   western/vedic → a body name ("Sun", "North_Node", "Ascendant")
 *   human_design  → a center ("Sacral") | channel ("34-20") | gate ("34")
 *   gene_keys     → a sphere id ("lifes_work", "attraction", "vocation")
 */
export interface ChartThread {
  modality: "western" | "vedic" | "human_design" | "gene_keys";
  ref: string;
  body?: string;
  note: string;
  tone?: "gift" | "shadow" | "orientation" | "background";
}

/** tone → CSS custom-property token (used as rgb(var(--token) / alpha)). */
export const TONE_TOKEN: Record<
  NonNullable<ChartThread["tone"]>,
  string
> = {
  gift: "--accent",
  orientation: "--link",
  background: "--muted",
  shadow: "--flag",
};
