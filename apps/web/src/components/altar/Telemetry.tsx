"use client";
import { useEffect, useState } from "react";
import type { Snapshot } from "@/lib/altar/snapshot";
import { loopState, moonPhase, moonPhaseName } from "@/lib/altar/becoming";

// The console's instrument rail: moon, season, the next threshold of the year,
// the three learning loops, and the practice's pulse. Live (ticks each minute).

function MoonGlyph({ phase, size = 18 }: { phase: number; size?: number }) {
  // Terminator as an ellipse: illuminated fraction from phase (0 new → 0.5 full → 1 new).
  const r = size / 2;
  const k = Math.cos(phase * 2 * Math.PI); // 1 at new, -1 at full
  const waxing = phase < 0.5;
  const rx = Math.abs(k) * r;
  const lit = "rgb(var(--halo))";
  const dark = "rgb(var(--sky-deep))";
  return (
    <svg width={size} height={size} viewBox={`${-r} ${-r} ${size} ${size}`} aria-hidden>
      <circle r={r} fill={dark} stroke="rgb(var(--rule) / 0.5)" strokeWidth={0.6} />
      <path d={`M0,${-r} A${r},${r} 0 0 ${waxing ? 1 : 0} 0,${r} A${rx},${r} 0 0 ${(k > 0) === waxing ? 0 : 1} 0,${-r}`} fill={lit} />
    </svg>
  );
}

function since(iso: string | null, now: number): string {
  if (!iso) return "—";
  const d = Math.floor((now - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? "today" : `${d}d ago`;
}

export function Telemetry({ snap }: { snap: Snapshot }) {
  const [now, setNow] = useState(() => Date.parse(snap.now));
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const phase = moonPhase(new Date(now));
  const loops = loopState(snap.reflections, now);
  const next = snap.thresholds.find((t) => t.kind === "season" && Date.parse(t.at) > now);
  const days = next ? Math.ceil((Date.parse(next.at) - now) / 86_400_000) : null;
  const pulsePct = Math.round(loops.pulse * 100);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-rule/20 px-4 py-2.5 telemetry" data-testid="telemetry">
      <span className="flex items-center gap-2"><MoonGlyph phase={phase} /> <b>{moonPhaseName(phase)}</b></span>
      {next && <span>⟲ <b>{next.label}</b> in <b>{days}d</b></span>}
      <span title="single loop · weekly practice">I <b>{since(loops.single.last, now)}</b></span>
      <span title="double loop · method & measures">II <b>{since(loops.double.last, now)}</b></span>
      <span title="triple loop · prayer & roots">III <b>{since(loops.triple.last, now)}</b></span>
      <span className="flex items-center gap-2" title="practice pulse — how warm your reflecting is">
        pulse
        <span className="relative inline-block h-1.5 w-20 overflow-hidden bg-rule/20">
          <span className="absolute inset-y-0 left-0 bg-accent altar-shimmer" style={{ width: `${Math.max(4, pulsePct)}%` }} />
        </span>
        <b>{pulsePct}</b>
      </span>
      <span className="ml-auto">{snap.reflections.length} reflections · {snap.strands.filter((s) => s.status === "confirmed").length} strands</span>
    </div>
  );
}

export { MoonGlyph };
