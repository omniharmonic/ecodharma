"use client";
import { useMemo, useState } from "react";
import type { Snapshot } from "@/lib/altar/snapshot";
import { seeded, vitals } from "@/lib/altar/becoming";
import { KIND_META, type ElementKind } from "@/lib/altar/model";

// The Orrery — the altar as a living mandala: the Prayer a breathing sun at the
// centre; Devotions, Works and Practices in orbit (closer = truer to the prayer,
// brighter = more alive); Measures as gauge-ticks on the outer ring; and below
// the horizon, Roots descending into soil with Inquiries fruiting on them.
// Pure SVG + CSS motion. Also the reduced-motion / no-WebGL fallback for Sky.

const W = 720;
const H = 720;
const CX = W / 2;
const CY = 300;

type Body = { id: number; kind: ElementKind; title: string; x: number; y: number; r: number; glow: number; charge: number; status: string; retired: boolean };

const ORBIT: Partial<Record<ElementKind, number>> = { devotion: 88, work: 160, practice: 222 };

function chargeColor(c: number) {
  if (c > 0.25) return "rgb(var(--nebula-warm))";
  if (c < -0.25) return "rgb(var(--nebula-cool))";
  return "rgb(var(--fg) / 0.75)";
}
const ROOT_COLOR: Record<string, string> = {
  held: "rgb(var(--root-held))", questioning: "rgb(var(--root-questioning))", composting: "rgb(var(--root-composting))", renewed: "rgb(var(--root-renewed))",
};

export function Orrery({ snap, onSelect, selected }: { snap: Snapshot; onSelect?: (id: number | null) => void; selected?: number | null }) {
  const [hover, setHover] = useState<number | null>(null);
  const v = useMemo(() => vitals(snap.elements, snap.strands, snap.alignment, Date.parse(snap.now)), [snap]);
  const prayer = snap.elements.find((e) => e.kind === "prayer" && !e.retired);

  const bodies: Body[] = useMemo(() => {
    const out: Body[] = [];
    for (const kind of ["devotion", "work", "practice"] as ElementKind[]) {
      const list = snap.elements.filter((e) => e.kind === kind && !e.retired);
      list.forEach((e, i) => {
        const vt = v.get(e.lineage_id)!;
        // Fidelity pulls a body inward (up to 22% of its orbit); charge colours it.
        const fid = vt.fidelity ?? 3;
        const radius = ORBIT[kind]! * (1.1 - (fid - 1) * 0.055);
        const a = (i / Math.max(1, list.length)) * Math.PI * 2 + seeded(e.lineage_id) * 0.6 - Math.PI / 2;
        out.push({
          id: e.lineage_id, kind, title: e.title, x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) * 0.62,
          r: 5 + Math.min(6, vt.recentTouches), glow: Math.min(1, 0.25 + vt.recentTouches * 0.15 + (vt.aliveness ? (vt.aliveness - 1) / 6 : 0)),
          charge: vt.charge, status: e.status, retired: false,
        });
      });
    }
    return out;
  }, [snap, v]);

  const roots = snap.elements.filter((e) => e.kind === "root");
  const inquiries = snap.elements.filter((e) => e.kind === "inquiry" && e.status !== "integrated" && !e.retired);
  const measures = snap.elements.filter((e) => e.kind === "measure" && !e.retired);
  const horizon = 520;
  const active = hover ?? selected ?? null;
  const label = active != null ? snap.elements.find((e) => e.lineage_id === active) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Your altar as a living orrery" data-testid="orrery">
      <defs>
        <radialGradient id="sun-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgb(var(--halo))" stopOpacity="1" />
          <stop offset="35%" stopColor="rgb(var(--accent))" stopOpacity="0.85" />
          <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="soil" cx="50%" cy="0%" r="100%">
          <stop offset="0%" stopColor="rgb(var(--hypha))" stopOpacity="0.16" />
          <stop offset="100%" stopColor="rgb(var(--hypha))" stopOpacity="0" />
        </radialGradient>
        <filter id="glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>

      {/* outer gauge ring — measures as ticks */}
      <g fill="none" stroke="rgb(var(--console-grid) / 0.35)">
        <ellipse cx={CX} cy={CY} rx={272} ry={272 * 0.62} strokeDasharray="1 5" />
        {Object.values(ORBIT).map((r) => <ellipse key={r} cx={CX} cy={CY} rx={r} ry={r! * 0.62} strokeOpacity={0.6} />)}
      </g>
      {measures.map((m, i) => {
        const a = (i / Math.max(1, measures.length)) * Math.PI * 2 - Math.PI / 2;
        const vt = v.get(m.lineage_id)!;
        const x1 = CX + 262 * Math.cos(a); const y1 = CY + 262 * 0.62 * Math.sin(a);
        const x2 = CX + 286 * Math.cos(a); const y2 = CY + 286 * 0.62 * Math.sin(a);
        return (
          <g key={m.lineage_id} onMouseEnter={() => setHover(m.lineage_id)} onMouseLeave={() => setHover(null)} onClick={() => onSelect?.(m.lineage_id)} className="cursor-pointer">
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={chargeColor(vt.charge)} strokeWidth={3} />
            <text x={CX + 300 * Math.cos(a)} y={CY + 300 * 0.62 * Math.sin(a)} textAnchor="middle" className="glyph" fontSize="11" fill="rgb(var(--muted))">◎</text>
          </g>
        );
      })}

      {/* links: elements → prayer (light threads that flow toward the centre) */}
      {bodies.map((b) => (
        <line key={`l-${b.id}`} x1={b.x} y1={b.y} x2={CX} y2={CY} stroke={chargeColor(b.charge)} strokeOpacity={0.25 + b.glow * 0.3} strokeWidth={0.8} className="altar-flow" />
      ))}

      {/* the Prayer — a breathing sun */}
      <g className="altar-breathe">
        <circle cx={CX} cy={CY} r={64} fill="url(#sun-core)" />
        <circle cx={CX} cy={CY} r={18} fill="rgb(var(--halo))" />
      </g>
      <circle cx={CX} cy={CY} r={26} fill="none" stroke="rgb(var(--accent))" className="altar-pulse-ring" />
      {snap.rings.map((r, i) => (
        <circle key={r.version} cx={CX} cy={CY} r={30 + i * 4} fill="none" stroke="rgb(var(--accent) / 0.5)" strokeWidth={0.6} />
      ))}
      {prayer && (
        <text x={CX} y={34} textAnchor="middle" className="font-display" fontSize="15" fill="rgb(var(--fg))" stroke="rgb(var(--sky-deep))" strokeWidth={4} paintOrder="stroke">
          {prayer.title.length > 64 ? `${prayer.title.slice(0, 62)}…` : prayer.title}
        </text>
      )}

      {/* orbiting bodies */}
      {bodies.map((b) => (
        <g key={b.id} className="altar-germinate cursor-pointer" onMouseEnter={() => setHover(b.id)} onMouseLeave={() => setHover(null)} onClick={() => onSelect?.(b.id)} data-testid={`orrery-${b.kind}`}>
          <circle cx={b.x} cy={b.y} r={b.r * 2.4} fill={chargeColor(b.charge)} opacity={b.glow * 0.35} filter="url(#glow)" />
          <circle cx={b.x} cy={b.y} r={b.r} fill="rgb(var(--sky-deep))" stroke={chargeColor(b.charge)} strokeWidth={active === b.id ? 2.4 : 1.4} />
          <text x={b.x} y={b.y + 3.5} textAnchor="middle" className="glyph" fontSize="9" fill={chargeColor(b.charge)}>{KIND_META[b.kind].glyph}</text>
        </g>
      ))}

      {/* horizon */}
      <line x1={40} x2={W - 40} y1={horizon} y2={horizon} stroke="rgb(var(--accent) / 0.55)" strokeDasharray="2 4" />
      <text x={44} y={horizon - 6} fontSize="9" className="font-mono" fill="rgb(var(--muted))" letterSpacing="2">SKY ↑ · SOIL ↓</text>
      <rect x={0} y={horizon} width={W} height={H - horizon} fill="url(#soil)" />

      {/* roots descending from the trunk */}
      <line x1={CX} y1={CY + 64} x2={CX} y2={horizon} stroke="rgb(var(--hypha) / 0.6)" strokeWidth={2} />
      {roots.map((rt, i) => {
        const n = roots.length;
        const spread = n > 1 ? (i / (n - 1) - 0.5) * 2 : 0;
        const ex = CX + spread * 260;
        const ey = horizon + 120 + seeded(rt.lineage_id) * 60;
        const color = rt.retired ? ROOT_COLOR.composting : ROOT_COLOR[rt.status] || ROOT_COLOR.held;
        const d = `M${CX},${horizon} C${CX + spread * 40},${horizon + 60} ${ex - spread * 60},${ey - 70} ${ex},${ey}`;
        return (
          <g key={rt.lineage_id} className="cursor-pointer" onMouseEnter={() => setHover(rt.lineage_id)} onMouseLeave={() => setHover(null)} onClick={() => onSelect?.(rt.lineage_id)} data-testid="orrery-root">
            <path d={d} fill="none" stroke={color} strokeWidth={rt.status === "held" || rt.status === "renewed" ? 2.4 : 1.4}
              strokeDasharray={rt.retired || rt.status === "composting" ? "2 5" : undefined} className={rt.status === "questioning" ? "altar-shimmer" : undefined} />
            {rt.status === "renewed" && <circle cx={ex} cy={ey} r={7} fill="none" stroke={color} />}
            <circle cx={ex} cy={ey} r={3.5} fill={color} />
          </g>
        );
      })}
      {inquiries.map((q, i) => {
        const x = CX + (i - (inquiries.length - 1) / 2) * 90;
        const y = horizon + 40 + seeded(q.lineage_id * 3) * 30;
        return (
          <g key={q.lineage_id} className="cursor-pointer altar-breathe" onMouseEnter={() => setHover(q.lineage_id)} onMouseLeave={() => setHover(null)} onClick={() => onSelect?.(q.lineage_id)}>
            <path d={`M${x - 9},${y} Q${x},${y - 16} ${x + 9},${y} Z`} fill="rgb(var(--root-questioning) / 0.7)" />
            <line x1={x} y1={y} x2={x} y2={y + 12} stroke="rgb(var(--root-questioning))" />
          </g>
        );
      })}

      {/* hover readout */}
      {label && (
        <g pointerEvents="none">
          <rect x={20} y={20} width={320} height={44} fill="rgb(var(--bg) / 0.92)" stroke="rgb(var(--accent) / 0.5)" />
          <text x={32} y={38} fontSize="9" className="font-mono" fill="rgb(var(--accent))" letterSpacing="2">
            {KIND_META[label.kind].label.toUpperCase()} · {label.status.toUpperCase()} · v{label.version}
          </text>
          <text x={32} y={55} fontSize="12" fill="rgb(var(--fg))">{label.title.length > 46 ? `${label.title.slice(0, 44)}…` : label.title}</text>
        </g>
      )}
    </svg>
  );
}
