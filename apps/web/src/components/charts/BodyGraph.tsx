// BodyGraph — Human Design bodygraph, dependency-free SVG, server-renderable.
//
// Renders the 9 canonical HD centers in their fixed bodygraph positions, all 36
// canonical channels as faint ghost hairlines, the person's defined channels in
// bold solar/phosphor, hanging gates as half-lit channels, every gate numbered,
// and an optional interpretive callout layer (chart_threads). Mode-aware purely
// via CSS custom properties (rgb(var(--token) / alpha)); reduced-motion-safe by
// reusing the existing `.draft-line` draw-on class from globals.css.
//
// No hooks in the core render -> safe inside React Server Components and inside
// ancestor 3D CSS transforms (chart stays transform-neutral so .draft-line and
// <title> hit-testing survive). No canvas, no WebGL, no new npm deps.
//
// Self-contained: it declares its own HD geometry + types so it typechecks
// independently of the sibling chart files (NatalWheel / GeneKeysViz).

// ---------------------------------------------------------------------------
// Types (local copies; the canonical home is charts/types.ts when present)
// ---------------------------------------------------------------------------

export type HDGateActivation = { gate: number; line: number };
export type HDBodyMap = Record<string, HDGateActivation>;

export type HDChannel = {
  gates: number[]; // [a, b]
  centers: string[]; // [c1, c2]
};

export interface HumanDesign {
  type: "Generator" | "Manifesting Generator" | "Manifestor" | "Projector" | "Reflector";
  profile: string;
  authority: string;
  definition: string;
  defined_centers: string[];
  open_centers: string[];
  channels: HDChannel[];
  gates: { personality: HDBodyMap; design: HDBodyMap };
  incarnation_cross_gates?: {
    personality_sun?: number;
    personality_earth?: number;
    design_sun?: number;
    design_earth?: number;
  };
  low_confidence?: boolean;
}

export type ChartThread = {
  modality: "western" | "vedic" | "human_design" | "gene_keys";
  ref: string;
  body?: string;
  note: string;
  tone?: "gift" | "shadow" | "orientation" | "background";
};

export interface BodyGraphProps {
  hd: HumanDesign;
  size?: number;
  /** center names ("Sacral"), channel keys ("34-20"), or gate strings ("34") */
  highlight?: string[];
  annotations?: ChartThread[];
  showGateNumbers?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Geometry — exact coordinates from the chart-viz spec digest
// ---------------------------------------------------------------------------

type CenterDef = {
  name: string;
  motor: boolean;
  shape: { kind: "poly"; pts: [number, number][] } | { kind: "rect"; rect: [number, number, number, number] };
  // centroid + radius hint for labels and highlight rings
  cx: number;
  cy: number;
  r: number;
  label: string;
};

const HD_CENTERS: CenterDef[] = [
  { name: "Head", motor: false, shape: { kind: "poly", pts: [[160, 16], [124, 70], [196, 70]] }, cx: 160, cy: 52, r: 40, label: "HEAD" },
  { name: "Ajna", motor: false, shape: { kind: "poly", pts: [[124, 84], [196, 84], [160, 140]] }, cx: 160, cy: 100, r: 40, label: "AJNA" },
  { name: "Throat", motor: false, shape: { kind: "rect", rect: [130, 152, 60, 60] }, cx: 160, cy: 182, r: 42, label: "THROAT" },
  { name: "G", motor: false, shape: { kind: "poly", pts: [[160, 224], [200, 266], [160, 308], [120, 266]] }, cx: 160, cy: 266, r: 48, label: "G" },
  { name: "Heart", motor: true, shape: { kind: "poly", pts: [[236, 210], [236, 250], [206, 230]] }, cx: 224, cy: 230, r: 26, label: "EGO" },
  { name: "Spleen", motor: false, shape: { kind: "poly", pts: [[40, 300], [40, 400], [118, 350]] }, cx: 70, cy: 350, r: 50, label: "SPLEEN" },
  { name: "SolarPlexus", motor: true, shape: { kind: "poly", pts: [[280, 300], [280, 400], [202, 350]] }, cx: 250, cy: 350, r: 50, label: "SOLAR" },
  { name: "Sacral", motor: true, shape: { kind: "rect", rect: [130, 318, 60, 60] }, cx: 160, cy: 348, r: 42, label: "SACRAL" },
  { name: "Root", motor: true, shape: { kind: "rect", rect: [130, 432, 60, 60] }, cx: 160, cy: 462, r: 42, label: "ROOT" },
];

const HD_CHANNELS: HDChannel[] = [
  // Head–Ajna
  { gates: [64, 47], centers: ["Head", "Ajna"] },
  { gates: [61, 24], centers: ["Head", "Ajna"] },
  { gates: [63, 4], centers: ["Head", "Ajna"] },
  // Ajna–Throat
  { gates: [17, 62], centers: ["Ajna", "Throat"] },
  { gates: [43, 23], centers: ["Ajna", "Throat"] },
  { gates: [11, 56], centers: ["Ajna", "Throat"] },
  // Throat–Spleen
  { gates: [16, 48], centers: ["Throat", "Spleen"] },
  { gates: [20, 57], centers: ["Throat", "Spleen"] },
  // Throat–G
  { gates: [31, 7], centers: ["Throat", "G"] },
  { gates: [8, 1], centers: ["Throat", "G"] },
  { gates: [33, 13], centers: ["Throat", "G"] },
  { gates: [20, 10], centers: ["Throat", "G"] },
  // Throat–Sacral
  { gates: [20, 34], centers: ["Throat", "Sacral"] },
  // Throat–SolarPlexus
  { gates: [35, 36], centers: ["Throat", "SolarPlexus"] },
  { gates: [12, 22], centers: ["Throat", "SolarPlexus"] },
  // Throat–Heart
  { gates: [45, 21], centers: ["Throat", "Heart"] },
  // G–Sacral
  { gates: [10, 34], centers: ["G", "Sacral"] },
  { gates: [15, 5], centers: ["G", "Sacral"] },
  { gates: [2, 14], centers: ["G", "Sacral"] },
  { gates: [46, 29], centers: ["G", "Sacral"] },
  // G–Spleen
  { gates: [10, 57], centers: ["G", "Spleen"] },
  // G–Heart
  { gates: [25, 51], centers: ["G", "Heart"] },
  // Heart–Spleen
  { gates: [26, 44], centers: ["Heart", "Spleen"] },
  // Heart–SolarPlexus
  { gates: [40, 37], centers: ["Heart", "SolarPlexus"] },
  // Sacral–Spleen
  { gates: [34, 57], centers: ["Sacral", "Spleen"] },
  { gates: [27, 50], centers: ["Sacral", "Spleen"] },
  // Sacral–SolarPlexus
  { gates: [59, 6], centers: ["Sacral", "SolarPlexus"] },
  // Sacral–Root
  { gates: [42, 53], centers: ["Sacral", "Root"] },
  { gates: [3, 60], centers: ["Sacral", "Root"] },
  { gates: [9, 52], centers: ["Sacral", "Root"] },
  // Spleen–Root
  { gates: [32, 54], centers: ["Spleen", "Root"] },
  { gates: [28, 38], centers: ["Spleen", "Root"] },
  { gates: [18, 58], centers: ["Spleen", "Root"] },
  // SolarPlexus–Root
  { gates: [30, 41], centers: ["SolarPlexus", "Root"] },
  { gates: [55, 39], centers: ["SolarPlexus", "Root"] },
  { gates: [49, 19], centers: ["SolarPlexus", "Root"] },
];

const GATE_PORTS: Record<number, [number, number]> = {
  64: [140, 66], 61: [160, 66], 63: [180, 66],
  47: [140, 90], 24: [160, 90], 4: [180, 90],
  17: [146, 128], 43: [160, 132], 11: [174, 128],
  62: [146, 158], 23: [160, 156], 56: [174, 158],
  16: [130, 168], 20: [130, 196],
  31: [140, 212], 8: [160, 212], 33: [180, 212],
  35: [190, 166], 12: [190, 184], 45: [190, 202],
  1: [160, 228], 7: [146, 236], 13: [174, 236],
  10: [126, 258], 25: [194, 258],
  15: [146, 296], 2: [160, 302], 46: [174, 296],
  21: [224, 212], 51: [210, 228], 26: [224, 240], 40: [232, 248],
  48: [100, 332], 57: [112, 350], 44: [92, 322], 50: [100, 368],
  32: [70, 392], 28: [56, 390], 18: [44, 386],
  36: [220, 332], 22: [208, 346], 37: [216, 362], 6: [210, 366],
  30: [250, 392], 55: [264, 390], 49: [276, 386],
  34: [132, 322], 5: [146, 318], 14: [160, 318], 29: [174, 318],
  27: [130, 340], 59: [190, 340],
  42: [140, 378], 3: [160, 378], 9: [180, 378],
  53: [140, 432], 60: [160, 432], 52: [180, 432],
  54: [130, 444], 38: [130, 460], 58: [130, 476],
  41: [190, 444], 39: [190, 460], 19: [190, 476],
};

// gate -> the canonical channel it belongs to (each gate lives in exactly one)
const GATE_TO_CHANNEL: Record<number, HDChannel> = (() => {
  const m: Record<number, HDChannel> = {};
  for (const ch of HD_CHANNELS) {
    m[ch.gates[0]] = ch;
    m[ch.gates[1]] = ch;
  }
  return m;
})();

const VIEW_W = 320;
const VIEW_H = 520;
const AXIS_X = 160;

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

function ptStr(pts: [number, number][]): string {
  return pts.map(([x, y]) => `${x},${y}`).join(" ");
}

function toneColor(tone: ChartThread["tone"]): string {
  switch (tone) {
    case "orientation":
      return "var(--link)";
    case "background":
      return "var(--muted)";
    case "shadow":
      return "var(--flag)";
    case "gift":
    default:
      return "var(--accent)";
  }
}

function channelKey(a: number, b: number): string {
  return `${a}-${b}`;
}

function midpoint(a: [number, number], b: [number, number]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

// resolve an annotation/highlight ref to an on-canvas anchor point
function resolveAnchor(ref: string): [number, number] | null {
  const center = HD_CENTERS.find((c) => c.name === ref);
  if (center) return [center.cx, center.cy];
  const chMatch = ref.match(/^(\d+)-(\d+)$/);
  if (chMatch) {
    const a = GATE_PORTS[Number(chMatch[1])];
    const b = GATE_PORTS[Number(chMatch[2])];
    if (a && b) return midpoint(a, b);
    if (a) return a;
    if (b) return b;
    return null;
  }
  const gateMatch = ref.match(/^(\d+)$/);
  if (gateMatch) {
    const p = GATE_PORTS[Number(gateMatch[1])];
    return p ?? null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BodyGraph({
  hd,
  size = 320,
  highlight = [],
  annotations = [],
  showGateNumbers = true,
  className = "",
}: BodyGraphProps) {
  const definedSet = new Set(hd?.defined_centers ?? []);
  const channels = hd?.channels ?? [];
  const personality = hd?.gates?.personality ?? {};
  const design = hd?.gates?.design ?? {};

  // active gate set = union of personality + design gate numbers
  const activeGateSet = new Set<number>();
  for (const m of [personality, design]) {
    for (const k of Object.keys(m)) {
      const g = m[k]?.gate;
      if (typeof g === "number") activeGateSet.add(g);
    }
  }

  // gates carried by a fully-defined channel (drawn bold) vs. hanging
  const channelGateSet = new Set<number>();
  for (const ch of channels) {
    if (Array.isArray(ch.gates)) ch.gates.forEach((g) => channelGateSet.add(g));
  }
  const hangingGates = [...activeGateSet].filter((g) => !channelGateSet.has(g));

  const highlightSet = new Set(highlight);

  // interpretive markers — every annotation gets a marker; first 4 get leaders
  const hdAnnotations = annotations.filter((a) => a.modality === "human_design");
  const markers = hdAnnotations
    .map((a, i) => {
      const anchor = resolveAnchor(a.ref);
      return anchor ? { thread: a, anchor, n: i + 1 } : null;
    })
    .filter((m): m is { thread: ChartThread; anchor: [number, number]; n: number } => m !== null);
  const MAX_LEADERS = 4;

  const definedCenterNames = (hd?.defined_centers ?? []).join(", ");
  const ariaLabel = `${hd?.type ?? "Unknown"} bodygraph, ${hd?.authority ?? "unknown"} authority, profile ${
    hd?.profile ?? "?"
  }; defined centers: ${definedCenterNames || "none"}.`;

  return (
    <figure className={className} style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width={size}
        height={(size * VIEW_H) / VIEW_W}
        role="img"
        aria-label={ariaLabel}
        style={{ display: "block", maxWidth: "100%", height: "auto", marginInline: "auto" }}
      >
        {/* registration ticks (drafting-table corners) */}
        <g stroke="rgb(var(--rule) / 0.4)" strokeWidth="1" fill="none">
          <path d="M8 8 h14 M8 8 v14" />
          <path d={`M${VIEW_W - 8} 8 h-14 M${VIEW_W - 8} 8 v14`} />
          <path d={`M8 ${VIEW_H - 8} h14 M8 ${VIEW_H - 8} v14`} />
          <path d={`M${VIEW_W - 8} ${VIEW_H - 8} h-14 M${VIEW_W - 8} ${VIEW_H - 8} v14`} />
        </g>

        {/* central vertical axis — faint spine */}
        <line
          x1={AXIS_X}
          y1={70}
          x2={AXIS_X}
          y2={492}
          stroke="rgb(var(--rule) / 0.12)"
          strokeWidth="1"
        />

        {/* (1) all 36 canonical channels as faint ghost hairlines — full-body plate */}
        <g fill="none">
          {HD_CHANNELS.map((ch) => {
            const a = GATE_PORTS[ch.gates[0]];
            const b = GATE_PORTS[ch.gates[1]];
            if (!a || !b) return null;
            return (
              <line
                key={`ghost-${ch.gates[0]}-${ch.gates[1]}`}
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
                stroke="rgb(var(--rule) / 0.12)"
                strokeWidth="1"
              />
            );
          })}
        </g>

        {/* (2) hanging gates — own half solar, partner half faded */}
        <g fill="none">
          {hangingGates.map((g) => {
            const ch = GATE_TO_CHANNEL[g];
            if (!ch) return null;
            const own = GATE_PORTS[g];
            const partnerGate = ch.gates[0] === g ? ch.gates[1] : ch.gates[0];
            const partner = GATE_PORTS[partnerGate];
            if (!own || !partner) return null;
            const mid = midpoint(own, partner);
            return (
              <g key={`hang-${g}`}>
                <line x1={own[0]} y1={own[1]} x2={mid[0]} y2={mid[1]} stroke="rgb(var(--accent))" strokeWidth="1.8" />
                <line
                  x1={mid[0]}
                  y1={mid[1]}
                  x2={partner[0]}
                  y2={partner[1]}
                  stroke="rgb(var(--accent) / 0.35)"
                  strokeWidth="1.8"
                />
              </g>
            );
          })}
        </g>

        {/* (3) defined channels — bold, draw-on */}
        <g fill="none">
          {channels.map((ch, i) => {
            if (!Array.isArray(ch.gates) || ch.gates.length < 2) return null;
            const a = GATE_PORTS[ch.gates[0]];
            const b = GATE_PORTS[ch.gates[1]];
            if (!a || !b) return null;
            return (
              <line
                key={`active-${ch.gates[0]}-${ch.gates[1]}-${i}`}
                className="draft-line"
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
                stroke="rgb(var(--accent))"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            );
          })}
        </g>

        {/* (4) centers — outline all, fill defined (motor=solar, awareness=phosphor) */}
        <g>
          {HD_CENTERS.map((c) => {
            const defined = definedSet.has(c.name);
            const fill = defined ? (c.motor ? "rgb(var(--accent))" : "rgb(var(--live))") : "none";
            const stroke = defined
              ? c.motor
                ? "rgb(var(--accent))"
                : "rgb(var(--live))"
              : "rgb(var(--rule) / 0.5)";
            const strokeWidth = defined ? 1 : 1.2;
            const shapeEl =
              c.shape.kind === "rect" ? (
                <rect
                  x={c.shape.rect[0]}
                  y={c.shape.rect[1]}
                  width={c.shape.rect[2]}
                  height={c.shape.rect[3]}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                />
              ) : (
                <polygon points={ptStr(c.shape.pts)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
              );
            const labelFill = defined ? "rgb(var(--bg))" : "rgb(var(--muted))";
            return (
              <g key={`center-${c.name}`}>
                <title>{`${c.name}${defined ? " — defined" : " — open"}`}</title>
                {shapeEl}
                <text
                  x={c.cx}
                  y={c.cy + 3}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={c.label.length > 5 ? 6.5 : 7.5}
                  fill={labelFill}
                  style={{ letterSpacing: "0.08em" }}
                  aria-hidden
                >
                  {c.label}
                </text>
              </g>
            );
          })}
        </g>

        {/* (5) gate numbers — carried gates in ink + solar dot, others muted */}
        {showGateNumbers && (
          <g>
            {Object.keys(GATE_PORTS).map((gk) => {
              const g = Number(gk);
              const p = GATE_PORTS[g];
              const carried = activeGateSet.has(g);
              return (
                <g key={`gate-${g}`}>
                  {carried && <circle cx={p[0]} cy={p[1]} r={2} fill="rgb(var(--accent))" />}
                  <text
                    x={p[0]}
                    y={p[1] + 2.4}
                    textAnchor="middle"
                    className="font-mono"
                    fontSize={7}
                    fill={carried ? "rgb(var(--fg))" : "rgb(var(--muted) / 0.85)"}
                    stroke="rgb(var(--bg))"
                    strokeWidth={carried ? 2.4 : 1.6}
                    paintOrder="stroke"
                    style={{ fontWeight: carried ? 600 : 400 }}
                  >
                    {g}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* (6) highlight rings — centers / channels / gates */}
        <g fill="none">
          {[...highlightSet].map((h) => {
            const center = HD_CENTERS.find((c) => c.name === h);
            if (center) {
              return (
                <circle
                  key={`hl-${h}`}
                  cx={center.cx}
                  cy={center.cy}
                  r={center.r}
                  stroke="rgb(var(--accent))"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
              );
            }
            const anchor = resolveAnchor(h);
            if (anchor) {
              return (
                <circle
                  key={`hl-${h}`}
                  cx={anchor[0]}
                  cy={anchor[1]}
                  r={10}
                  stroke="rgb(var(--accent))"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
              );
            }
            return null;
          })}
        </g>

        {/* (7) interpretive callouts — markers for all, leaders for first 4 */}
        <g>
          {markers.map((m, idx) => {
            const [ax, ay] = m.anchor;
            const color = toneColor(m.thread.tone);
            const drawLeader = idx < MAX_LEADERS;
            const goLeft = ax < AXIS_X;
            const marginX = goLeft ? 10 : VIEW_W - 10;
            const elbowX = goLeft ? 40 : VIEW_W - 40;
            const labelAnchor = goLeft ? "start" : "end";
            return (
              <g key={`mk-${m.n}`}>
                <title>{`B.${m.n} ${m.thread.ref}: ${m.thread.note}`}</title>
                {drawLeader && (
                  <>
                    <path
                      className="draft-line"
                      d={`M${ax} ${ay} L${elbowX} ${ay} L${marginX} ${ay}`}
                      stroke={`rgb(${color} / 0.55)`}
                      strokeWidth="1"
                      fill="none"
                    />
                    <text
                      x={marginX}
                      y={ay - 5}
                      textAnchor={labelAnchor}
                      className="font-mono"
                      fontSize={7}
                      fill="rgb(var(--muted))"
                      stroke="rgb(var(--bg))"
                      strokeWidth={2.4}
                      paintOrder="stroke"
                      style={{ letterSpacing: "0.1em" }}
                    >
                      {`FIG. B.${m.n}`}
                    </text>
                  </>
                )}
                {/* numbered solar marker on the anchor */}
                <circle cx={ax} cy={ay} r={5.5} fill="rgb(var(--bg))" stroke={`rgb(${color})`} strokeWidth="1.2" />
                <text
                  x={ax}
                  y={ay + 2.6}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={7}
                  fill={`rgb(${color})`}
                  aria-label={`${m.thread.ref}: ${m.thread.note}`}
                  style={{ fontWeight: 600 }}
                >
                  {m.n}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* caption — TYPE / AUTHORITY / PROFILE / DEFINITION */}
      <figcaption className="mt-3">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="flex justify-between gap-2">
            <dt className="eyebrow">Type</dt>
            <dd className="kv text-fg">{hd?.type ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="eyebrow">Authority</dt>
            <dd className="kv text-fg">{hd?.authority ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="eyebrow">Profile</dt>
            <dd className="kv text-fg">{hd?.profile ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="eyebrow">Definition</dt>
            <dd className="kv text-fg">{hd?.definition ?? "—"}</dd>
          </div>
        </dl>
        {hd?.low_confidence && (
          <p className="eyebrow mt-2" style={{ color: "rgb(var(--flag))" }}>
            ⚠ Birth time uncertain — definition is time-sensitive
          </p>
        )}
      </figcaption>
    </figure>
  );
}

export default BodyGraph;
