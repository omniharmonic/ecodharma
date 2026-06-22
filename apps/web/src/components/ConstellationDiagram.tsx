// A geodesic social plate: members as nodes on a ring, woven by chords — a
// Dymaxion-flavored map of the constellation. Draw-on linework; pure SVG.
export function ConstellationDiagram({ names }: { names: string[] }) {
  const W = 720;
  const H = 320;
  const cx = W / 2;
  const cy = H / 2;
  const R = 120;
  const n = Math.max(names.length, 1);
  const pts = names.map((name, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { name, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Constellation diagram">
      {/* geodesic ground rings */}
      {[R, R * 0.66, R * 0.33].map((r, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke="rgb(var(--rule) / 0.18)" strokeWidth="1" />
      ))}
      {/* chords — every member woven to every other */}
      {pts.map((p, i) =>
        pts.slice(i + 1).map((q, j) => (
          <line
            key={`${i}-${j}`}
            className="draft-line"
            x1={p.x} y1={p.y} x2={q.x} y2={q.y}
            stroke="rgb(var(--live) / 0.5)" strokeWidth="1"
          />
        )),
      )}
      {/* nodes */}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="5" fill="rgb(var(--accent))" stroke="rgb(var(--bg))" strokeWidth="1.5" />
          <text
            x={p.x} y={p.y - 12}
            textAnchor="middle"
            className="fill-fg font-mono"
            fontSize="11"
          >
            {p.name}
          </text>
          <text x={p.x} y={p.y + 20} textAnchor="middle" className="fill-muted font-mono" fontSize="8" style={{ letterSpacing: "0.1em" }}>
            NODE {String(i + 1).padStart(2, "0")}
          </text>
        </g>
      ))}
    </svg>
  );
}
