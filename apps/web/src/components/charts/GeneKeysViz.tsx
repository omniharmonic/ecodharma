// GeneKeysViz — EcoDharma v3
// A dependency-free, server-renderable SVG of the three Gene Keys sequences
// (Activation / Venus / Pearl) laid out as our own minimal hologenetic-style
// arrangement of gate.line nodes. No proprietary Gene Keys art or descriptive
// text is reproduced — only the gate.line numbers and the structural skeleton.
//
// Mode-aware purely via CSS custom properties (rgb(var(--token) / alpha)) so it
// re-themes under .mode-blueprint with no JS. Reduced-motion-safe by reusing the
// global `.draft-line` draw-on class (it resets dashoffset under
// prefers-reduced-motion). No hooks in the core render — safe as a Server
// Component; no canvas, no WebGL, no new deps.

import type { CSSProperties } from "react";

/* ------------------------------------------------------------------ types -- */

export type GKSphere = { gate: number; line: number };

export type GeneKeys = {
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
};

// The interpretive bridge between reading prose and the drawn chart. The whole
// array is passed to every chart; this component filters to gene_keys and to
// anchors it can draw (sphere ids).
export type ChartThread = {
  modality: "western" | "vedic" | "human_design" | "gene_keys";
  ref: string;
  body?: string;
  note: string;
  tone?: "gift" | "shadow" | "orientation" | "background";
};

type SphereId =
  | "lifes_work"
  | "evolution"
  | "radiance"
  | "purpose"
  | "attraction"
  | "iq"
  | "eq"
  | "sq"
  | "vocation"
  | "culture"
  | "brand";

type SeqKey = "activation" | "venus" | "pearl";

export type GeneKeysVizProps = {
  geneKeys: GeneKeys;
  size?: number;
  /** sphere ids to ring with a seq-color resonance halo */
  highlight?: string[];
  /** interpretive callouts; the whole array is fine — filtered internally */
  annotations?: ChartThread[];
  className?: string;
};

/* ------------------------------------------------------------- geometry --- */

const VB_W = 480;
const VB_H = 440;
const R = 28; // sphere outer radius
const R_INNER = 24;
const R_HALO = 32;

type LayoutNode = {
  id: SphereId;
  x: number;
  y: number;
  seq: SeqKey;
  label: string;
  sub: string;
};

// Spheres ascend bottom -> top (lower = entry/foundation, upper = fruit).
const GK_LAYOUT: LayoutNode[] = [
  // CENTER column — Activation (the spine)
  { id: "lifes_work", x: 240, y: 372, seq: "activation", label: "LIFE'S WORK", sub: "Sun · Personality" },
  { id: "evolution", x: 240, y: 278, seq: "activation", label: "EVOLUTION", sub: "Earth · challenge" },
  { id: "radiance", x: 240, y: 184, seq: "activation", label: "RADIANCE", sub: "Design Sun · vitality" },
  { id: "purpose", x: 240, y: 90, seq: "activation", label: "PURPOSE", sub: "Design Earth · core" },
  // LEFT column — Venus
  { id: "attraction", x: 96, y: 360, seq: "venus", label: "ATTRACTION", sub: "relational" },
  { id: "iq", x: 96, y: 268, seq: "venus", label: "IQ", sub: "mental" },
  { id: "eq", x: 96, y: 176, seq: "venus", label: "EQ", sub: "emotional" },
  { id: "sq", x: 96, y: 84, seq: "venus", label: "SQ", sub: "spiritual" },
  // RIGHT column — Pearl
  { id: "vocation", x: 384, y: 340, seq: "pearl", label: "VOCATION", sub: "vocational" },
  { id: "culture", x: 384, y: 215, seq: "pearl", label: "CULTURE", sub: "collective" },
  { id: "brand", x: 384, y: 90, seq: "pearl", label: "BRAND", sub: "expression" },
];

// flow order within each sequence (bottom -> top)
const SEQ_FLOW: Record<SeqKey, SphereId[]> = {
  activation: ["lifes_work", "evolution", "radiance", "purpose"],
  venus: ["attraction", "iq", "eq", "sq"],
  pearl: ["vocation", "culture", "brand"],
};

// Gene Keys convention: Activation green, Venus red, Pearl blue.
const GK_SEQ_COLOR: Record<SeqKey, string> = {
  activation: "--live", // green
  venus: "--flag", // red
  pearl: "--link", // blue
};

const SEQ_CAPTION: { seq: SeqKey; x: number; text: string }[] = [
  { seq: "venus", x: 96, text: "VENUS" },
  { seq: "activation", x: 240, text: "ACTIVATION" },
  { seq: "pearl", x: 384, text: "PEARL" },
];

const TONE_COLOR: Record<NonNullable<ChartThread["tone"]>, string> = {
  gift: "--accent",
  orientation: "--link",
  background: "--muted",
  shadow: "--flag",
};

/* -------------------------------------------------------------- helpers --- */

const NODE_BY_ID: Record<SphereId, LayoutNode> = GK_LAYOUT.reduce(
  (acc, n) => {
    acc[n.id] = n;
    return acc;
  },
  {} as Record<SphereId, LayoutNode>,
);

function sphereLookup(gk: GeneKeys): Record<SphereId, GKSphere> {
  return {
    lifes_work: gk.activation_sequence.lifes_work,
    evolution: gk.activation_sequence.evolution,
    radiance: gk.activation_sequence.radiance,
    purpose: gk.activation_sequence.purpose,
    attraction: gk.venus_sequence.attraction,
    iq: gk.venus_sequence.iq,
    eq: gk.venus_sequence.eq,
    sq: gk.venus_sequence.sq,
    vocation: gk.pearl_sequence.vocation,
    culture: gk.pearl_sequence.culture,
    brand: gk.pearl_sequence.brand,
  };
}

// upward chevron centered at (cx, cy) — the FeedbackLoop "ascending" idiom
function chevronPath(cx: number, cy: number, w = 5, h = 4): string {
  return `M${cx - w} ${cy + h} L${cx} ${cy} L${cx + w} ${cy + h}`;
}

/* ----------------------------------------------------------- component --- */

export default function GeneKeysViz({
  geneKeys,
  size = 480,
  highlight = [],
  annotations = [],
  className,
}: GeneKeysVizProps) {
  const values = sphereLookup(geneKeys);
  const highlightSet = new Set(highlight);

  // interpretive threads we can draw: gene_keys modality, anchored to a sphere
  const threads = annotations.filter(
    (a) => a.modality === "gene_keys" && a.ref in NODE_BY_ID,
  );
  // ANTI-CLUTTER: at most 4 leader callouts on-SVG; every match still gets a
  // numbered solar marker + <title>. Parent renders the full numbered legend.
  const leaderCount = Math.min(threads.length, 4);

  const fmt = (s: GKSphere) => `${s.gate}.${s.line}`;
  const ariaLabel =
    "Gene Keys profile. " +
    `Activation — Life's Work ${fmt(values.lifes_work)}, Evolution ${fmt(values.evolution)}, ` +
    `Radiance ${fmt(values.radiance)}, Purpose ${fmt(values.purpose)}. ` +
    `Venus — Attraction ${fmt(values.attraction)}, IQ ${fmt(values.iq)}, ` +
    `EQ ${fmt(values.eq)}, SQ ${fmt(values.sq)}. ` +
    `Pearl — Vocation ${fmt(values.vocation)}, Culture ${fmt(values.culture)}, Brand ${fmt(values.brand)}.`;

  const halo: CSSProperties = {
    stroke: "rgb(var(--bg))",
    strokeWidth: 3,
    paintOrder: "stroke",
  };

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width={size}
      height={(size * VB_H) / VB_W}
      className={["h-auto max-w-full", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={ariaLabel}
    >
      {/* registration ticks */}
      <g stroke="rgb(var(--rule) / 0.4)" strokeWidth="1" fill="none">
        <path d="M8 8 h14 M8 8 v14" />
        <path d={`M${VB_W - 8} 8 h-14 M${VB_W - 8} 8 v14`} />
        <path d={`M8 ${VB_H - 8} h14 M8 ${VB_H - 8} v14`} />
        <path d={`M${VB_W - 8} ${VB_H - 8} h-14 M${VB_W - 8} ${VB_H - 8} v14`} />
      </g>

      {/* column captions */}
      {SEQ_CAPTION.map((c) => (
        <text
          key={`cap-${c.seq}`}
          x={c.x}
          y={28}
          textAnchor="middle"
          className="font-mono"
          fill={`rgb(var(${GK_SEQ_COLOR[c.seq]}))`}
          fontSize="9"
          style={{ ...halo, letterSpacing: "0.22em" }}
        >
          {c.text}
        </text>
      ))}

      {/* faint cross-links tying the three sequences into one profile */}
      <g stroke="rgb(var(--rule) / 0.3)" strokeWidth="1" fill="none" strokeDasharray="2 4">
        <line
          x1={NODE_BY_ID.lifes_work.x - R}
          y1={NODE_BY_ID.lifes_work.y}
          x2={NODE_BY_ID.attraction.x + R}
          y2={NODE_BY_ID.attraction.y}
        />
        <line
          x1={NODE_BY_ID.lifes_work.x + R}
          y1={NODE_BY_ID.lifes_work.y}
          x2={NODE_BY_ID.vocation.x - R}
          y2={NODE_BY_ID.vocation.y}
        />
      </g>

      {/* flow paths within each sequence (bottom -> top) with ascending chevrons */}
      {(Object.keys(SEQ_FLOW) as SeqKey[]).map((seq) => {
        const order = SEQ_FLOW[seq];
        const color = `rgb(var(${GK_SEQ_COLOR[seq]}) / 0.4)`;
        return (
          <g key={`flow-${seq}`} fill="none">
            {order.slice(0, -1).map((fromId, i) => {
              const a = NODE_BY_ID[fromId];
              const b = NODE_BY_ID[order[i + 1]];
              // a is below b (larger y); draw upward from a's top to b's bottom
              const x1 = a.x;
              const y1 = a.y - R;
              const x2 = b.x;
              const y2 = b.y + R;
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;
              return (
                <g key={`seg-${seq}-${i}`}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={color}
                    strokeWidth="1.4"
                    className="draft-line"
                  />
                  <path
                    d={chevronPath(midX, midY)}
                    stroke={color}
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}
          </g>
        );
      })}

      {/* spheres */}
      {GK_LAYOUT.map((n) => {
        const v = values[n.id];
        const color = `rgb(var(${GK_SEQ_COLOR[n.seq]}))`;
        const isHi = highlightSet.has(n.id);
        return (
          <g key={`node-${n.id}`}>
            <title>{`${n.label} — Gate ${v.gate}, Line ${v.line}`}</title>

            {/* resonance halo for highlighted spheres */}
            {isHi && (
              <circle
                cx={n.x}
                cy={n.y}
                r={R_HALO}
                fill={`rgb(var(${GK_SEQ_COLOR[n.seq]}) / 0.25)`}
              />
            )}

            {/* sphere body */}
            <circle cx={n.x} cy={n.y} r={R} fill="rgb(var(--bg))" stroke={color} strokeWidth="1.6" />
            <circle cx={n.x} cy={n.y} r={R_INNER} fill="none" stroke="rgb(var(--rule) / 0.2)" strokeWidth="1" />

            {/* gate numeral + line superscript */}
            <text
              x={n.x}
              y={n.y + 7}
              textAnchor="middle"
              className="font-display"
              fill="rgb(var(--fg))"
              fontSize="22"
            >
              {v.gate}
            </text>
            <text
              x={n.x + R - 6}
              y={n.y - 6}
              textAnchor="end"
              className="font-mono"
              fill={color}
              fontSize="10"
            >
              {`.${v.line}`}
            </text>

            {/* label above (eyebrow-style) */}
            <text
              x={n.x}
              y={n.y - R - 8}
              textAnchor="middle"
              className="font-mono"
              fill="rgb(var(--muted))"
              fontSize="8"
              style={{ ...halo, letterSpacing: "0.14em" }}
            >
              {n.label}
            </text>

            {/* sub below */}
            <text
              x={n.x}
              y={n.y + R + 14}
              textAnchor="middle"
              className="font-mono"
              fill="rgb(var(--muted))"
              fontSize="7"
              style={{ ...halo, letterSpacing: "0.08em" }}
            >
              {n.sub}
            </text>
          </g>
        );
      })}

      {/* interpretive callouts — leaders for the first 4, markers for all */}
      {threads.map((t, i) => {
        const n = NODE_BY_ID[t.ref as SphereId];
        const tone = t.tone ?? "orientation";
        const toneColor = `rgb(var(${TONE_COLOR[tone]}))`;
        const num = i + 1;
        // marker sits at the sphere's upper-right shoulder
        const mx = n.x + R * 0.72;
        const my = n.y - R * 0.72;
        const drawLeader = i < leaderCount;
        // route leader to the nearer vertical margin
        const toLeft = n.x < 200;
        const marginX = toLeft ? 12 : VB_W - 12;
        const elbowX = toLeft ? 60 : VB_W - 60;
        const anchor = toLeft ? "start" : "end";
        return (
          <g key={`thread-${i}`}>
            <title>{`${num}. ${t.note}`}</title>
            {drawLeader && (
              <>
                <polyline
                  points={`${mx},${my} ${elbowX},${my} ${marginX},${my}`}
                  fill="none"
                  stroke={toneColor}
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  className="draft-line"
                />
                <text
                  x={marginX}
                  y={my - 4}
                  textAnchor={anchor}
                  className="font-mono"
                  fill={toneColor}
                  fontSize="8"
                  style={{ ...halo, letterSpacing: "0.08em" }}
                >
                  {`C.${num}`}
                </text>
              </>
            )}
            {/* numbered solar marker (always) */}
            <circle cx={mx} cy={my} r="6.5" fill="rgb(var(--accent))" stroke="rgb(var(--bg))" strokeWidth="1.2" />
            <text
              x={mx}
              y={my + 3}
              textAnchor="middle"
              className="font-mono"
              fill="rgb(var(--bg))"
              fontSize="8"
              aria-label={`Callout ${num}: ${t.note}`}
            >
              {num}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
