// Patent/diagram devices — single-weight line-work that plots itself on load
// (CSS stroke-dashoffset). Pure SVG, server-renderable; reduced-motion shows them drawn.

export function FeedbackLoop({ className = "" }: { className?: string }) {
  // A small upward-spiral: a near-closed loop with a solar arrowhead — each turn
  // making the next easier. Encodes the trim-tab's compounding logic.
  return (
    <svg viewBox="0 0 48 48" className={`h-10 w-10 shrink-0 ${className}`} aria-hidden fill="none">
      <path
        className="draft-line"
        d="M24 8 a16 16 0 1 1 -11 4.7"
        stroke="rgb(var(--live))"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M13 12.7 l-1.5 5.2 l5.2 -1.2" stroke="rgb(var(--accent))" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="24" r="2" fill="rgb(var(--accent))" />
    </svg>
  );
}

/**
 * The person as a labeled figure: a central node with leader lines radiating to
 * each gift label — a patent plate of "this person's contribution."
 */
export function GiftFigure({ center, parts }: { center: string; parts: string[] }) {
  const W = 720;
  const H = 300;
  const cx = W / 2;
  const cy = H / 2;
  const labels = parts.slice(0, 6);
  const n = labels.length || 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Figure: ${center}'s gifts`}>
      {/* registration ticks */}
      <g stroke="rgb(var(--rule) / 0.4)" strokeWidth="1">
        <path d="M8 8 h14 M8 8 v14" />
        <path d={`M${W - 8} 8 h-14 M${W - 8} 8 v14`} />
        <path d={`M8 ${H - 8} h14 M8 ${H - 8} v14`} />
        <path d={`M${W - 8} ${H - 8} h-14 M${W - 8} ${H - 8} v14`} />
      </g>

      {/* central node */}
      <circle cx={cx} cy={cy} r="34" fill="none" stroke="rgb(var(--accent))" strokeWidth="1.6" className="draft-line" />
      <circle cx={cx} cy={cy} r="3" fill="rgb(var(--accent))" />
      <text x={cx} y={cy + 4} textAnchor="middle" className="fill-fg font-mono" fontSize="11" style={{ textTransform: "uppercase", letterSpacing: "0.12em" }}>
        {center}
      </text>

      {labels.map((label, i) => {
        const left = i < Math.ceil(n / 2);
        const col = left ? i : i - Math.ceil(n / 2);
        const colCount = left ? Math.ceil(n / 2) : Math.floor(n / 2);
        const ty = ((col + 1) / (colCount + 1)) * (H - 60) + 30;
        const tx = left ? 28 : W - 28;
        const anchor = left ? "start" : ("end" as const);
        // leader line from node to a point near the label
        const nodeX = cx + (left ? -34 : 34);
        const elbowX = left ? 150 : W - 150;
        return (
          <g key={i}>
            <path
              className="draft-line"
              d={`M${nodeX} ${cy} L${elbowX} ${ty} L${tx + (left ? -4 : 4)} ${ty}`}
              stroke="rgb(var(--rule) / 0.55)"
              strokeWidth="1"
              fill="none"
            />
            <circle cx={elbowX} cy={ty} r="2" fill="rgb(var(--live))" />
            <text x={tx} y={ty - 6} textAnchor={anchor} className="fill-muted font-mono" fontSize="9" style={{ letterSpacing: "0.1em" }}>
              FIG. 1.{i + 1}
            </text>
            <text x={tx} y={ty + 8} textAnchor={anchor} className="fill-fg font-sans" fontSize="13">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
