// Sacred-geometry overlays — Flower of Life lattice, vesica, Metatron's lines —
// drawn as hairlines at low opacity and turned very slowly. Pure SVG, server-safe.
type Props = { size?: number; className?: string; variant?: "flower" | "metatron" | "seed"; opacity?: number; spin?: boolean };

function flowerCircles(r: number, rings: number): [number, number][] {
  const pts: [number, number][] = [[0, 0]];
  for (let ring = 1; ring <= rings; ring++) {
    for (let side = 0; side < 6; side++) {
      for (let step = 0; step < ring; step++) {
        const a0 = (Math.PI / 3) * side;
        const a1 = (Math.PI / 3) * (side + 1);
        const x = ring * r * Math.cos(a0) + step * r * (Math.cos(a1) - Math.cos(a0));
        const y = ring * r * Math.sin(a0) + step * r * (Math.sin(a1) - Math.sin(a0));
        pts.push([x, y]);
      }
    }
  }
  return pts;
}

export function SacredGeometry({ size = 520, className, variant = "flower", opacity = 0.16, spin = true }: Props) {
  const R = size / 2;
  const r = variant === "seed" ? R / 3 : R / 5.2;
  const circles = flowerCircles(r, variant === "seed" ? 1 : 2);
  const outer = Array.from({ length: 6 }, (_, i) => [R * 0.86 * Math.cos((Math.PI / 3) * i - Math.PI / 2), R * 0.86 * Math.sin((Math.PI / 3) * i - Math.PI / 2)]);
  const inner = Array.from({ length: 6 }, (_, i) => [R * 0.43 * Math.cos((Math.PI / 3) * i - Math.PI / 2), R * 0.43 * Math.sin((Math.PI / 3) * i - Math.PI / 2)]);
  const nodes = [[0, 0], ...outer, ...inner];
  return (
    <svg viewBox={`${-R} ${-R} ${size} ${size}`} width={size} height={size} className={className} aria-hidden="true">
      <g className={spin ? "altar-spin-slow" : undefined} fill="none" stroke="rgb(var(--accent))" strokeWidth={0.6} opacity={opacity}>
        <circle r={R * 0.98} />
        <circle r={R * 0.92} strokeDasharray="2 6" />
        {circles.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={r} />)}
        {variant === "metatron" && nodes.flatMap((a, i) => nodes.slice(i + 1).map((b, j) => (
          <line key={`${i}-${j}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} strokeWidth={0.35} />
        )))}
      </g>
      <g className={spin ? "altar-spin-rev" : undefined} fill="none" stroke="rgb(var(--link))" strokeWidth={0.5} opacity={opacity * 0.8}>
        {Array.from({ length: 72 }, (_, i) => {
          const a = (i / 72) * Math.PI * 2;
          const l = i % 6 === 0 ? 10 : 4;
          return <line key={i} x1={(R - 2) * Math.cos(a)} y1={(R - 2) * Math.sin(a)} x2={(R - 2 - l) * Math.cos(a)} y2={(R - 2 - l) * Math.sin(a)} />;
        })}
      </g>
    </svg>
  );
}
