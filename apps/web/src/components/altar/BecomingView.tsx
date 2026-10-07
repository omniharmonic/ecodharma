"use client";
import { useMemo, useState } from "react";
import type { Snapshot } from "@/lib/altar/snapshot";
import { reflectionCharges, seeded } from "@/lib/altar/becoming";
import { KIND_META } from "@/lib/altar/model";

// BECOMING — time.
//   · THE YEAR SPIRAL: one turn per year (Jan 1 at the top, clockwise), the
//     solstices, equinoxes and your solar return marked as gates; every
//     reflection a point (warm = radiant, violet = contracted, size = depth);
//     each version of your Prayer a star on the spiral.
//   · TREE RINGS: a cross-section of the trunk, one ring per Prayer version.
//   · LIFE LINES: every altar element's history as a strand of charged beads —
//     where it was lived, strained, questioned, released.

const S = 520;
const C = S / 2;

function chargeFill(c: number, a = 1) {
  return c > 0.25 ? `rgb(var(--nebula-warm) / ${a})` : c < -0.25 ? `rgb(var(--nebula-cool) / ${a})` : `rgb(var(--fg) / ${a * 0.7})`;
}

export function BecomingView({ snap, onSelect }: { snap: Snapshot; onSelect: (id: number | null) => void }) {
  const [focus, setFocus] = useState<string | null>(null);
  const now = new Date(snap.now);
  const charges = useMemo(() => reflectionCharges(snap.strands), [snap]);

  const dates = [...snap.reflections.map((r) => r.at), ...snap.elements.map((e) => e.created_at), ...snap.rings.map((r) => r.at)].map((d) => Date.parse(d));
  const firstYear = new Date(Math.min(Date.parse(snap.now), ...dates)).getUTCFullYear();
  const lastYear = now.getUTCFullYear();
  const years = lastYear - firstYear + 1;
  const r0 = 70;
  const gap = Math.max(26, Math.min(170, (C - r0 - 34) / Math.max(1, years)));

  const polar = (iso: string | Date) => {
    const d = typeof iso === "string" ? new Date(iso) : iso;
    const y = d.getUTCFullYear();
    const start = Date.UTC(y, 0, 1);
    const frac = (d.getTime() - start) / (Date.UTC(y + 1, 0, 1) - start);
    const a = frac * Math.PI * 2 - Math.PI / 2;
    const r = r0 + (y - firstYear + frac) * gap;
    return { x: C + r * Math.cos(a), y: C + r * Math.sin(a), a, r };
  };

  // the spiral path from Jan 1 of the first year to now
  const spiral = useMemo(() => {
    const pts: string[] = [];
    const t0 = Date.UTC(firstYear, 0, 1);
    const t1 = Date.parse(snap.now);
    for (let i = 0; i <= 720; i++) {
      const p = polar(new Date(t0 + ((t1 - t0) * i) / 720));
      pts.push(`${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    }
    return pts.join(" ");
  }, [snap]); // eslint-disable-line react-hooks/exhaustive-deps

  const seasonal = snap.thresholds.filter((t) => t.kind === "season" && Date.parse(t.at) <= Date.parse(snap.now) + 200 * 86_400_000);
  const natalSun = snap.natal.find((b) => b.body === "Sun");
  const lifeElements = snap.elements.filter((e) => e.kind !== "prayer" && !(e.kind === "thread" && e.status !== "accepted"));
  const spanStart = Math.min(Date.parse(snap.now) - 90 * 86_400_000, ...dates);
  const spanEnd = Date.parse(snap.now);
  const xOf = (iso: string) => 160 + ((Date.parse(iso) - spanStart) / Math.max(1, spanEnd - spanStart)) * 520;

  return (
    <div className="p-3" data-testid="becoming-view">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* THE YEAR SPIRAL */}
        <figure>
          <svg viewBox={`0 0 ${S} ${S}`} className="h-auto w-full" role="img" aria-label="The year spiral of your reflections">
            <defs>
              <radialGradient id="spiral-core"><stop offset="0%" stopColor="rgb(var(--halo))" stopOpacity="0.8" /><stop offset="100%" stopColor="rgb(var(--halo))" stopOpacity="0" /></radialGradient>
            </defs>
            <circle cx={C} cy={C} r={r0 * 0.8} fill="url(#spiral-core)" className="altar-breathe" />
            {/* month spokes */}
            {Array.from({ length: 12 }, (_, m) => {
              const a = (m / 12) * Math.PI * 2 - Math.PI / 2;
              return (
                <g key={m}>
                  <line x1={C + r0 * 0.6 * Math.cos(a)} y1={C + r0 * 0.6 * Math.sin(a)} x2={C + (C - 8) * Math.cos(a)} y2={C + (C - 8) * Math.sin(a)} stroke="rgb(var(--console-grid) / 0.12)" />
                  <text x={C + (C - 2) * Math.cos(a + 0.26)} y={C + (C - 2) * Math.sin(a + 0.26)} fontSize="8" textAnchor="middle" className="font-mono" fill="rgb(var(--muted))">
                    {["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][m]}
                  </text>
                </g>
              );
            })}
            <path d={spiral} fill="none" stroke="rgb(var(--accent) / 0.55)" strokeWidth={1.2} className="draft-line" />
            {/* seasonal gates */}
            {seasonal.map((t) => {
              const p = polar(t.at);
              return (
                <g key={t.at}>
                  <line x1={C + (p.r - 10) * Math.cos(p.a)} y1={C + (p.r - 10) * Math.sin(p.a)} x2={C + (p.r + 10) * Math.cos(p.a)} y2={C + (p.r + 10) * Math.sin(p.a)} stroke="rgb(var(--live) / 0.8)" strokeWidth={1.4} />
                  <title>{t.label}</title>
                </g>
              );
            })}
            {/* solar return each year: the Sun returns to its natal degree (approx. birthday) */}
            {natalSun && Array.from({ length: years }, (_, i) => {
              // approximate the date the Sun reaches its natal longitude in that year
              const y = firstYear + i;
              const dayOfYear = ((natalSun.lon - 280.46 + 360) % 360) / 0.98565; // from ~Jan 1 (Sun ≈ 280°)
              const p = polar(new Date(Date.UTC(y, 0, 1) + dayOfYear * 86_400_000));
              return <text key={y} x={p.x} y={p.y + 3} textAnchor="middle" fontSize="11" className="glyph" fill="rgb(var(--halo))">☉<title>Solar return {y}</title></text>;
            })}
            {/* prayer versions */}
            {snap.rings.map((r) => {
              const p = polar(r.at);
              return (
                <g key={r.version} onMouseEnter={() => setFocus(`Prayer v${r.version}: ${r.title}`)} onMouseLeave={() => setFocus(null)}>
                  <path d={`M${p.x},${p.y - 7} L${p.x + 2},${p.y - 2} L${p.x + 7},${p.y} L${p.x + 2},${p.y + 2} L${p.x},${p.y + 7} L${p.x - 2},${p.y + 2} L${p.x - 7},${p.y} L${p.x - 2},${p.y - 2} Z`} fill="rgb(var(--accent))" />
                </g>
              );
            })}
            {/* reflections */}
            {snap.reflections.map((r) => {
              const p = polar(r.at);
              const c = charges.get(r.id) ?? 0;
              return (
                <circle key={r.id} cx={p.x} cy={p.y} r={2 + r.depth * 1.6} fill={chargeFill(c, 0.9)} stroke="rgb(var(--bg))" strokeWidth={0.6}
                  onMouseEnter={() => setFocus(`${r.cadence} reflection · ${new Date(r.at).toLocaleDateString()} · charge ${c > 0 ? "+" : ""}${c.toFixed(1)}`)} onMouseLeave={() => setFocus(null)} className="altar-germinate" />
              );
            })}
            {/* now */}
            {(() => { const p = polar(snap.now); return <circle cx={p.x} cy={p.y} r={5} fill="none" stroke="rgb(var(--accent))" className="altar-pulse-ring" />; })()}
            <text x={C} y={C + 4} textAnchor="middle" fontSize="10" className="font-mono" fill="rgb(var(--fg))">{firstYear}{years > 1 ? `–${lastYear}` : ""}</text>
          </svg>
          <figcaption className="mt-1 telemetry">{focus || "the year spiral — one turn per year · ✦ prayer versions · ☉ solar returns · green gates = solstices & equinoxes"}</figcaption>
        </figure>

        {/* TREE RINGS */}
        <figure>
          <svg viewBox="-150 -150 300 300" className="h-auto w-full" role="img" aria-label="Tree rings of your prayer">
            {snap.rings.length === 0 && <text textAnchor="middle" fontSize="10" fill="rgb(var(--muted))">your first ring forms when you write your prayer</text>}
            {snap.rings.map((r, i) => {
              const rad = 30 + (i + 1) * (110 / Math.max(1, snap.rings.length));
              const pts = Array.from({ length: 73 }, (_, k) => {
                const a = (k / 72) * Math.PI * 2;
                const wob = 1 + Math.sin(k * 0.52 + r.version) * 0.012 + (seeded(r.version * 100 + (k % 72)) - 0.5) * 0.018;
                return `${k ? "L" : "M"}${(rad * wob * Math.cos(a)).toFixed(1)},${(rad * wob * Math.sin(a)).toFixed(1)}`;
              }).join(" ");
              const outer = i === snap.rings.length - 1;
              return (
                <path key={r.version} d={pts} fill="none" stroke={outer ? "rgb(var(--accent))" : "rgb(var(--hypha) / 0.7)"} strokeWidth={outer ? 2 : 1.1}
                  onMouseEnter={() => setFocus(`Ring ${r.version} · ${new Date(r.at).toLocaleDateString()} — “${r.title}”`)} onMouseLeave={() => setFocus(null)} className="cursor-help" />
              );
            })}
            <circle r={6} fill="rgb(var(--accent))" className="altar-breathe" />
          </svg>
          <figcaption className="mt-1 telemetry">tree rings · {snap.rings.length} version{snap.rings.length === 1 ? "" : "s"} of your prayer</figcaption>
        </figure>
      </div>

      {/* LIFE LINES */}
      <div className="mt-4 border-t border-rule/15 pt-3">
        <p className="telemetry mb-2">life lines — each element's history of being lived, strained, questioned, released</p>
        <svg viewBox={`0 0 700 ${Math.max(40, lifeElements.length * 22 + 20)}`} className="h-auto w-full">
          {lifeElements.map((e, i) => {
            const y = 14 + i * 22;
            const ss = snap.strands.filter((s) => s.lineage_id === e.lineage_id);
            return (
              <g key={e.lineage_id} className="cursor-pointer" onClick={() => onSelect(e.lineage_id)}>
                <text x={4} y={y + 4} fontSize="10" fill={e.retired ? "rgb(var(--muted) / 0.6)" : "rgb(var(--fg))"}>
                  {KIND_META[e.kind].glyph} {e.title.length > 24 ? `${e.title.slice(0, 22)}…` : e.title}
                </text>
                <line x1={xOf(e.created_at)} x2={e.retired ? xOf(e.created_at) + 40 : 680} y1={y} y2={y} stroke="rgb(var(--console-grid) / 0.3)" strokeDasharray={e.retired ? "2 3" : undefined} />
                {ss.map((s, k) => (
                  <circle key={k} cx={xOf(s.at)} cy={y} r={s.relation === "strains" || s.relation === "questions" ? 3.2 : 2.6} fill={chargeFill(s.charge, s.status === "confirmed" ? 0.95 : 0.4)}>
                    <title>{s.relation} · {new Date(s.at).toLocaleDateString()}</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
