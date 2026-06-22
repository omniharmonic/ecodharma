// NatalWheel — the EcoDharma v3 astrological wheel. Renders BOTH the western
// (tropical) and vedic (sidereal) charts: identical data shape, only `system`
// + the supplied positions differ. Pure SVG, server-renderable (no hooks),
// mode-aware purely through CSS custom properties (rgb(var(--token) / alpha)),
// reduced-motion-safe by reusing the global `.draft-line` draw-on class.
//
// ORIENTATION (documented, conventional): 0° = 0° Aries, sits at the LEFT
// (9-o'clock) and longitude increases counter-clockwise — so 90° (0° Cancer)
// is at the top. When `ascendantLeft` (default) the whole wheel is rotated so
// the Ascendant degree falls on the left horizon, the classic chart framing.
//
//   const offset = ascendantLeft ? houses.ascendant.lon : 0;
//   const a = ((180 - (lon - offset)) * Math.PI) / 180;
//   x = 200 + r*cos(a);  y = 200 - r*sin(a);   // SVG y is flipped
//
// Anti-clutter: every annotated body gets a numbered solar marker + <title>;
// at most `maxLeaders` (4) also draw a leader line out to a margin label. The
// full notes live in the parent's FIG legend + the reading prose, never here.

import {
  ASPECT_STYLE,
  PLANET_ABBR,
  PLANET_GLYPH,
  SIGN_ABBR,
  SIGN_GLYPH,
  SIGN_INDEX,
  WHEEL,
  clamp,
} from "./chartGeometry";
import type { Aspect, ChartThread, Houses, BodyPosition } from "./types";
import { TONE_TOKEN } from "./types";

export interface NatalWheelProps {
  positions: Record<string, BodyPosition>;
  houses: Houses;
  aspects?: Aspect[];
  size?: number;
  system?: "western" | "vedic";
  ayanamsa?: number;
  glyphMode?: "abbr" | "unicode";
  ascendantLeft?: boolean;
  highlight?: string[];
  annotations?: ChartThread[];
  /** legend letter the parent uses for these callouts (FIG A.n by default). */
  figPrefix?: string;
  /** max on-SVG leader callouts (everything else stays a marker + tooltip). */
  maxLeaders?: number;
  className?: string;
}

const { cx, cy } = WHEEL;
const TAU = Math.PI / 180;
const norm360 = (d: number): number => ((d % 360) + 360) % 360;

export function NatalWheel({
  positions,
  houses,
  aspects = [],
  size = 400,
  system = "western",
  ayanamsa,
  glyphMode = "abbr",
  ascendantLeft = true,
  highlight = [],
  annotations = [],
  figPrefix = "A",
  maxLeaders = 4,
  className,
}: NatalWheelProps) {
  const offset = ascendantLeft ? houses?.ascendant?.lon ?? 0 : 0;

  // longitude (0=0° Aries) → screen point at radius r
  const polar = (lon: number, r: number): { x: number; y: number } => {
    const a = (180 - (lon - offset)) * TAU;
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  };

  const signGlyphs = glyphMode === "unicode" ? SIGN_GLYPH : SIGN_ABBR;
  const cusps =
    Array.isArray(houses?.cusps) && houses.cusps.length === 12
      ? houses.cusps
      : null;

  // ---- declustered bodies (sweep by longitude; bump inward when crowded) ----
  const bodies = Object.entries(positions ?? {})
    .filter(([name]) => PLANET_ABBR[name])
    .map(([name, p]) => ({ name, ...p }))
    .sort((a, b) => a.lon - b.lon);

  let lastLon = -999;
  let lastTier = 0;
  const placed = bodies.map((b) => {
    const tier =
      b.lon - lastLon < 6 ? Math.min(lastTier + 1, WHEEL.maxTier) : 0;
    lastLon = b.lon;
    lastTier = tier;
    return { ...b, r: WHEEL.planet - tier * WHEEL.planetTier };
  });

  const isHot = (name: string): boolean => highlight.includes(name);

  // ---- resolve an annotation ref to a longitude on this wheel ----
  const refLon = (ref: string): number | null => {
    if (positions?.[ref]) return positions[ref].lon;
    const key = ref.toLowerCase();
    if (key === "ascendant" || key === "asc") return houses?.ascendant?.lon ?? null;
    if (key === "midheaven" || key === "mc") return houses?.midheaven?.lon ?? null;
    if (key === "descendant" || key === "dsc")
      return houses?.ascendant ? norm360(houses.ascendant.lon + 180) : null;
    if (key === "ic")
      return houses?.midheaven ? norm360(houses.midheaven.lon + 180) : null;
    return null;
  };

  const threads = (annotations ?? []).filter((t) => t.modality === system);
  const callouts = threads
    .map((t, i) => ({ t, n: i + 1, lon: refLon(t.ref) }))
    .filter((c): c is { t: ChartThread; n: number; lon: number } => c.lon != null);

  // ---- accessible summary ----
  const sun = positions?.Sun;
  const moon = positions?.Moon;
  const ascSign = houses?.ascendant?.sign;
  const label =
    `${system === "vedic" ? "Sidereal (vedic)" : "Tropical (western)"} natal wheel.` +
    (sun ? ` Sun in ${sun.sign}.` : "") +
    (moon ? ` Moon in ${moon.sign}.` : "") +
    (ascSign ? ` Ascendant in ${ascSign}.` : "") +
    ` ${aspects.length} aspect${aspects.length === 1 ? "" : "s"}.`;

  const haloProps = {
    stroke: "rgb(var(--bg))",
    strokeWidth: 2.5,
    paintOrder: "stroke" as const,
  };

  return (
    <svg
      viewBox="0 0 400 400"
      width={size}
      height={size}
      className={className ?? "h-auto w-full"}
      role="img"
      aria-label={label}
    >
      <title>{label}</title>

      {/* registration ticks — drafting corner marks */}
      {(
        [
          [14, 14, 1, 1],
          [386, 14, -1, 1],
          [14, 386, 1, -1],
          [386, 386, -1, -1],
        ] as const
      ).map(([x, y, sx, sy], i) => (
        <path
          key={`reg-${i}`}
          d={`M${x} ${y + 12 * sy}L${x} ${y}L${x + 12 * sx} ${y}`}
          fill="none"
          stroke="rgb(var(--rule) / 0.4)"
          strokeWidth={1}
        />
      ))}

      {/* sign band — two rings + 12 radial dividers + glyph/abbr per sign */}
      <circle cx={cx} cy={cy} r={WHEEL.signOuter} fill="none" stroke="rgb(var(--rule) / 0.25)" strokeWidth={1} />
      <circle cx={cx} cy={cy} r={WHEEL.signInner} fill="none" stroke="rgb(var(--rule) / 0.25)" strokeWidth={1} />
      {Array.from({ length: 12 }, (_, k) => {
        const lon = k * 30;
        const a = polar(lon, WHEEL.signInner);
        const b = polar(lon, WHEEL.signOuter);
        const g = polar(lon + 15, WHEEL.signGlyph);
        return (
          <g key={`sign-${k}`}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="rgb(var(--rule) / 0.25)"
              strokeWidth={1}
            />
            <text
              x={g.x}
              y={g.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-muted font-mono"
              fontSize={glyphMode === "unicode" ? 11 : 8}
              {...haloProps}
              style={{ letterSpacing: glyphMode === "unicode" ? undefined : "0.05em" }}
            >
              {signGlyphs[k]}
            </text>
          </g>
        );
      })}

      {/* house cusps — radial spokes; ASC/IC/DSC/MC heavier + labeled */}
      {cusps?.map((lon, i) => {
        const angular = i === 0 || i === 3 || i === 6 || i === 9;
        const inner = polar(lon, WHEEL.cuspInner);
        const outer = polar(lon, WHEEL.cuspOuter);
        const tag = i === 0 ? "ASC" : i === 3 ? "IC" : i === 6 ? "DSC" : i === 9 ? "MC" : null;
        const lp = polar(lon, WHEEL.cuspInner - 8);
        return (
          <g key={`cusp-${i}`}>
            <line
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={angular ? "rgb(var(--link))" : "rgb(var(--rule) / 0.3)"}
              strokeWidth={angular ? 1.4 : 0.75}
            />
            {tag && (
              <text
                x={lp.x}
                y={lp.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="font-mono"
                fill="rgb(var(--link))"
                fontSize={7}
                {...haloProps}
                style={{ letterSpacing: "0.12em" }}
              >
                {tag}
              </text>
            )}
          </g>
        );
      })}

      {/* house numbers — midpoint of each house arc */}
      {cusps?.map((lon, i) => {
        const next = cusps[(i + 1) % 12];
        let span = next - lon;
        if (span <= 0) span += 360;
        const mid = norm360(lon + span / 2);
        const p = polar(mid, WHEEL.houseNum);
        return (
          <text
            key={`hn-${i}`}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-muted font-mono"
            fontSize={7}
            opacity={0.7}
            {...haloProps}
          >
            {i + 1}
          </text>
        );
      })}

      {/* hub circle — all aspect chords are tied at this radius */}
      <circle cx={cx} cy={cy} r={WHEEL.hub} fill="none" stroke="rgb(var(--rule) / 0.2)" strokeWidth={1} />

      {/* aspect web */}
      {aspects.map((asp, i) => {
        const a = positions?.[asp.p1];
        const b = positions?.[asp.p2];
        const style = ASPECT_STYLE[asp.aspect];
        if (!a || !b || !style) return null;
        const op = clamp(0.3, 0.85, 0.85 - (asp.orb / 8) * 0.5);
        const p = polar(a.lon, WHEEL.hub);
        const q = polar(b.lon, WHEEL.hub);
        const common = {
          className: "draft-line",
          stroke: `rgb(var(${style.token}) / ${op.toFixed(2)})`,
          strokeWidth: style.width,
          strokeDasharray: style.dash,
          fill: "none",
        };
        if (asp.aspect === "conjunction") {
          // short rim tie-arc rather than a chord across the centre
          const r = WHEEL.hub + 3;
          const pa = polar(a.lon, r);
          const pb = polar(b.lon, r);
          let d = norm360(b.lon - a.lon);
          const sweep = d <= 180 ? 0 : 1;
          if (d > 180) d = 360 - d;
          return (
            <path
              key={`asp-${i}`}
              {...common}
              d={`M${pa.x.toFixed(2)} ${pa.y.toFixed(2)} A${r} ${r} 0 0 ${sweep} ${pb.x.toFixed(2)} ${pb.y.toFixed(2)}`}
            />
          );
        }
        return (
          <line
            key={`asp-${i}`}
            {...common}
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
          />
        );
      })}

      {/* planets — degree tick on the ring, glyph drawn inward by tier */}
      {placed.map((b) => {
        const tick0 = polar(b.lon, WHEEL.signInner);
        const tick1 = polar(b.lon, WHEEL.signInner - 6);
        const conn0 = polar(b.lon, WHEEL.signInner - 6);
        const conn1 = polar(b.lon, b.r + 9);
        const gp = polar(b.lon, b.r);
        const dp = polar(b.lon, b.r - 11);
        const hot = isHot(b.name);
        const glyph = glyphMode === "unicode" ? PLANET_GLYPH[b.name] : PLANET_ABBR[b.name];
        return (
          <g key={`pl-${b.name}`}>
            <line x1={tick0.x} y1={tick0.y} x2={tick1.x} y2={tick1.y} stroke="rgb(var(--fg))" strokeWidth={1} />
            <line x1={conn0.x} y1={conn0.y} x2={conn1.x} y2={conn1.y} stroke="rgb(var(--rule) / 0.3)" strokeWidth={0.75} />
            {hot && (
              <circle cx={gp.x} cy={gp.y} r={10} fill="none" stroke="rgb(var(--accent))" strokeWidth={1.4} />
            )}
            <text
              x={gp.x}
              y={gp.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="font-mono"
              fill={hot ? "rgb(var(--accent))" : "rgb(var(--fg))"}
              fontSize={glyphMode === "unicode" ? 11 : 9}
              {...haloProps}
              strokeWidth={3}
            >
              {glyph}
            </text>
            <text
              x={dp.x}
              y={dp.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-muted font-mono"
              fontSize={7}
              {...haloProps}
            >
              {Math.round(b.deg_in_sign)}°
            </text>
            <title>{`${b.name.replace("_", " ")} — ${Math.round(b.deg_in_sign)}° ${b.sign}`}</title>
          </g>
        );
      })}

      {/* interpretive callouts — numbered solar marker (all) + leader (first N) */}
      {callouts.map((c, idx) => {
        const tone = c.t.tone ? TONE_TOKEN[c.t.tone] : "--accent";
        const m = polar(c.lon, WHEEL.signInner + 3);
        const drawLeader = idx < maxLeaders;
        const tip = polar(c.lon, WHEEL.callout);
        const rightSide = tip.x >= cx;
        const marginX = rightSide ? 396 : 4;
        const anchor = rightSide ? "end" : ("start" as const);
        return (
          <g key={`cb-${c.n}`} aria-label={`${figPrefix}.${c.n} ${c.t.ref}: ${c.t.note}`}>
            {drawLeader && (
              <>
                <path
                  className="draft-line"
                  d={`M${m.x.toFixed(2)} ${m.y.toFixed(2)}L${tip.x.toFixed(2)} ${tip.y.toFixed(2)}L${marginX} ${tip.y.toFixed(2)}`}
                  fill="none"
                  stroke={`rgb(var(${tone}) / 0.7)`}
                  strokeWidth={1}
                />
                <text
                  x={marginX}
                  y={tip.y - 3}
                  textAnchor={anchor}
                  className="font-mono"
                  fill={`rgb(var(${tone}))`}
                  fontSize={7}
                  {...haloProps}
                  style={{ letterSpacing: "0.1em" }}
                >
                  {`${figPrefix}.${c.n} ${c.t.ref.replace("_", " ").toUpperCase()}`}
                </text>
              </>
            )}
            <circle cx={m.x} cy={m.y} r={6} fill={`rgb(var(${tone}))`} stroke="rgb(var(--bg))" strokeWidth={1.2} />
            <text
              x={m.x}
              y={m.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="font-mono"
              fill="rgb(var(--bg))"
              fontSize={8}
            >
              {c.n}
            </text>
            <title>{`${figPrefix}.${c.n} ${c.t.ref}: ${c.t.note}`}</title>
          </g>
        );
      })}

      {/* sidereal stamp */}
      {system === "vedic" && ayanamsa != null && (
        <text
          x={cx}
          y={388}
          textAnchor="middle"
          className="fill-muted font-mono"
          fontSize={7}
          {...haloProps}
          style={{ letterSpacing: "0.1em" }}
        >
          {`SIDEREAL · AYANAMSA ${ayanamsa.toFixed(2)}°`}
        </text>
      )}
    </svg>
  );
}

export default NatalWheel;
