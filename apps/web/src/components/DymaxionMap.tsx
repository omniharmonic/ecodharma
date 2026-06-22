// Dymaxion (Fuller icosahedral) constellation map — the constellation screen's
// bold element. An unfolded icosahedral net of equilateral triangles drawn in
// hairlines on the drafting sheet; consenting members plotted on face centroids
// and woven by labeled leader lines. Pure SVG + Tailwind tokens, draw-on motion
// via `.draft-line` (reduced-motion safe). Server-renderable — no hooks.

// ---- precomputed icosahedral net layout (trig done once at module load) ----
const SIDE = 130;
const HALF = SIDE / 2; // 65
const HEIGHT = (SIDE * Math.sqrt(3)) / 2; // ~112.58
const OX = 155; // horizontal offset, centers the band in the 960-wide sheet
const BANDTOP = 184; // top edge of the central band (vertical center ~240)

type Pt = { x: number; y: number };
type Face = { pts: [Pt, Pt, Pt]; cx: number; cy: number };

function face(a: Pt, b: Pt, c: Pt): Face {
  return { pts: [a, b, c], cx: (a.x + b.x + c.x) / 3, cy: (a.y + b.y + c.y) / 3 };
}
// up-pointing triangle: base on the lower lattice line, apex above
function up(i: number, top: number): Face {
  const x = OX + i * HALF;
  return face({ x, y: top + HEIGHT }, { x: x + SIDE, y: top + HEIGHT }, { x: x + HALF, y: top });
}
// down-pointing triangle: base on the upper lattice line, apex below
function down(i: number, top: number): Face {
  const x = OX + i * HALF;
  return face({ x, y: top }, { x: x + SIDE, y: top }, { x: x + HALF, y: top + HEIGHT });
}

// central band (alternating up/down) + top & bottom flaps → ~18 faces, the
// characteristic Fuller staircase silhouette.
const BAND: Face[] = Array.from({ length: 9 }, (_, i) =>
  i % 2 === 0 ? up(i, BANDTOP) : down(i, BANDTOP),
);
const TOP_FLAPS: Face[] = [1, 3, 5, 7].map((i) => up(i, BANDTOP - HEIGHT));
const BOTTOM_FLAPS: Face[] = [0, 2, 4, 6, 8].map((i) => down(i, BANDTOP + HEIGHT));
const FACES: Face[] = [...BAND, ...TOP_FLAPS, ...BOTTOM_FLAPS];

// node slots: interleave the three rows so consecutive members spread across
// the sheet (vertical zigzag, drifting right) rather than clumping.
function interleave(groups: Face[][]): Face[] {
  const out: Face[] = [];
  const max = Math.max(...groups.map((g) => g.length));
  for (let i = 0; i < max; i++) for (const g of groups) if (i < g.length) out.push(g[i]);
  return out;
}
const SLOTS: Face[] = interleave([TOP_FLAPS, BAND, BOTTOM_FLAPS]);

const poly = (f: Face) => `M${f.pts.map((p) => `${p.x} ${p.y}`).join("L")}Z`;

// faint cartographic great-circle arcs for texture (purely decorative)
const GRATICULE = [
  "M120 240 Q480 120 840 240",
  "M120 240 Q480 360 840 240",
  "M300 80 Q480 240 300 400",
  "M660 80 Q480 240 660 400",
];

type Edge = { a: number; b: number; kind?: "resonance" | "friction" };

export function DymaxionMap({ names, edges }: { names: string[]; edges?: Edge[] }) {
  // place each member on a face centroid, deterministic by index, spread EVENLY
  // across the whole net (rather than clustering in the first few left slots).
  const step = names.length > 0 ? SLOTS.length / names.length : 1;
  const nodes = names.map((name, i) => {
    const t = i * step;
    const slot = SLOTS[Math.floor(t) % SLOTS.length];
    const wrap = Math.floor(t / SLOTS.length); // 0 until members exceed slot count
    return { name, i, x: slot.cx + wrap * 9, y: slot.cy + wrap * 9 };
  });

  // default to a fully-woven resonance mesh when no edges are supplied
  const labeled = Array.isArray(edges);
  const links: Edge[] =
    edges ??
    nodes.flatMap((_, a) =>
      nodes.slice(a + 1).map((__, j) => ({ a, b: a + 1 + j, kind: "resonance" as const })),
    );

  const label =
    `Dymaxion constellation map of ${names.length} ` +
    `member${names.length === 1 ? "" : "s"}` +
    (names.length ? `: ${names.join(", ")}` : "") +
    `, woven by ${links.length} connection${links.length === 1 ? "" : "s"}.`;

  return (
    <svg viewBox="108 58 744 388" className="h-auto w-full max-w-full" role="img" aria-label={label}>
      {/* registration ticks — drafting corner marks (aligned to the tightened frame) */}
      {[
        [116, 66, 1, 1],
        [844, 66, -1, 1],
        [116, 438, 1, -1],
        [844, 438, -1, -1],
      ].map(([x, y, sx, sy], i) => (
        <path
          key={`reg-${i}`}
          d={`M${x} ${y + 14 * sy}L${x} ${y}L${x + 14 * sx} ${y}`}
          fill="none"
          stroke="rgb(var(--rule) / 0.45)"
          strokeWidth="1"
        />
      ))}

      {/* faint graticule arcs */}
      {GRATICULE.map((d, i) => (
        <path
          key={`grat-${i}`}
          className="draft-line"
          d={d}
          fill="none"
          stroke="rgb(var(--rule) / 0.12)"
          strokeWidth="1"
        />
      ))}

      {/* icosahedral net faces — hairline linework */}
      {FACES.map((f, i) => (
        <path
          key={`face-${i}`}
          className="draft-line"
          d={poly(f)}
          fill="none"
          stroke="rgb(var(--rule) / 0.25)"
          strokeWidth="1"
        />
      ))}

      {/* structural ferro lines — the band's two lattice "tropics" */}
      {[BANDTOP, BANDTOP + HEIGHT].map((y, i) => (
        <line
          key={`spine-${i}`}
          className="draft-line"
          x1={OX}
          y1={y}
          x2={OX + 9 * HALF}
          y2={y}
          stroke="rgb(var(--link))"
          strokeWidth="1"
        />
      ))}

      {/* edges — labeled leader lines (resonance solid · friction dashed) */}
      {links.map((e, i) => {
        const p = nodes[e.a];
        const q = nodes[e.b];
        if (!p || !q) return null;
        const friction = e.kind === "friction";
        const mx = (p.x + q.x) / 2;
        const my = (p.y + q.y) / 2;
        return (
          <g key={`edge-${i}`}>
            <line
              className="draft-line"
              x1={p.x}
              y1={p.y}
              x2={q.x}
              y2={q.y}
              stroke={friction ? "rgb(var(--flag) / 0.75)" : "rgb(var(--live) / 0.45)"}
              strokeWidth="1"
              strokeDasharray={friction ? "4 3" : undefined}
            />
            {labeled && (
              <text
                x={mx}
                y={my - 3}
                textAnchor="middle"
                className="fill-muted font-mono"
                fontSize="8"
                stroke="rgb(var(--bg))"
                strokeWidth="2.5"
                paintOrder="stroke"
                style={{ letterSpacing: "0.1em" }}
              >
                {friction ? "FRICTION" : "RESONANCE"}
              </text>
            )}
          </g>
        );
      })}

      {/* member nodes — solar diamond glyph + mono labels */}
      {nodes.map((p) => {
        const r = 5.5;
        return (
          <g key={`node-${p.i}`}>
            <path
              d={`M${p.x} ${p.y - r}L${p.x + r} ${p.y}L${p.x} ${p.y + r}L${p.x - r} ${p.y}Z`}
              fill="rgb(var(--accent))"
              stroke="rgb(var(--bg))"
              strokeWidth="1.5"
            />
            <text
              x={p.x}
              y={p.y - 13}
              textAnchor="middle"
              className="fill-fg font-mono"
              fontSize="11"
              stroke="rgb(var(--bg))"
              strokeWidth="3"
              paintOrder="stroke"
            >
              {p.name}
            </text>
            <text
              x={p.x}
              y={p.y + 19}
              textAnchor="middle"
              className="fill-muted font-mono"
              fontSize="8"
              style={{ letterSpacing: "0.1em" }}
            >
              NODE {String(p.i + 1).padStart(2, "0")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
