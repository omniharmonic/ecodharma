"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { Snapshot } from "@/lib/altar/snapshot";
import { vitals } from "@/lib/altar/becoming";
import { KIND_META } from "@/lib/altar/model";
import { Telemetry } from "@/components/altar/Telemetry";
import { Orrery } from "@/components/altar/Orrery";

const SoilView = dynamic(() => import("@/components/altar/SoilView").then((m) => m.SoilView), { ssr: false });
const BecomingView = dynamic(() => import("@/components/altar/BecomingView").then((m) => m.BecomingView), { ssr: false });

type Lens = "orrery" | "soil" | "becoming";
const LENSES: { id: Lens; glyph: string; label: string; hint: string }[] = [
  { id: "orrery", glyph: "⊙", label: "Orrery", hint: "the altar as a mandala" },
  { id: "soil", glyph: "⟟", label: "Depths", hint: "roots & mycelium beneath the water" },
  { id: "becoming", glyph: "◌", label: "Becoming", hint: "the spiral of your years" },
];

/** The heads-up layer over the living sky: telemetry, the lens dock, and what you touch. */
export function AltarHUD({ snap }: { snap: Snapshot }) {
  const [lens, setLens] = useState<Lens | null>(null);
  const [sel, setSel] = useState<{ id: number | null; label: string } | null>(null);
  const v = useMemo(() => vitals(snap.elements, snap.strands, snap.alignment, Date.parse(snap.now)), [snap]);
  useEffect(() => {
    const h = (e: Event) => setSel((e as CustomEvent).detail);
    window.addEventListener("eco:dream-select", h);
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { setLens(null); setSel(null); } };
    window.addEventListener("keydown", k);
    return () => { window.removeEventListener("eco:dream-select", h); window.removeEventListener("keydown", k); };
  }, []);
  const el = sel?.id != null ? snap.elements.find((e) => e.lineage_id === sel.id) : null;
  const vt = el ? v.get(el.lineage_id) : null;

  return (
    <>
      <div className="veil fixed left-1/2 top-[4.6rem] z-20 hidden -translate-x-1/2 md:block" data-testid="soul-console">
        <Telemetry snap={snap} />
      </div>

      <div className="fixed bottom-20 left-1/2 z-20 flex -translate-x-1/2 gap-2 md:bottom-6" data-testid="lens-dock">
        {LENSES.map((l) => (
          <button key={l.id} type="button" title={l.hint} onClick={() => setLens(l.id)} data-testid={`view-${l.id}`}
            className="veil flex items-center gap-2 px-4 py-2 font-mono text-2xs uppercase tracking-eyebrow text-[#e8f0ff] hover:text-[#ffd9a0]">
            <span className="glyph text-base text-[#ffc878]">{l.glyph}</span>{l.label}
          </button>
        ))}
      </div>

      {sel && (
        <div className="veil veil-gold fixed bottom-20 left-1/2 z-30 w-[min(92vw,26rem)] -translate-x-1/2 p-5 animate-rise" data-testid="selection">
          <button type="button" onClick={() => setSel(null)} className="absolute right-3 top-2 text-muted hover:text-fg" aria-label="close">×</button>
          {el ? (
            <>
              <p className="whisper">{KIND_META[el.kind].glyph} {KIND_META[el.kind].label} · {el.status}{el.version > 1 ? ` · ring ${el.version}` : ""}</p>
              <p className="mt-2 font-display text-xl leading-snug text-fg">{el.title}</p>
              {vt && (
                <p className="mt-2 font-mono text-2xs text-muted">
                  {vt.touches} strands · {vt.recentTouches} in 90 days · charge {vt.charge >= 0 ? "+" : ""}{vt.charge.toFixed(1)}
                  {vt.aliveness ? ` · aliveness ${vt.aliveness.toFixed(1)}` : ""}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/journal?el=${el.lineage_id}`} className="dream-btn-ghost !px-3 !py-2">☽ its reflections</Link>
                <Link href={`/altar/edit#e${el.lineage_id}`} className="dream-btn-ghost !px-3 !py-2">⟡ tend it</Link>
              </div>
            </>
          ) : (
            <p className="font-display text-lg text-fg">{sel.label}</p>
          )}
        </div>
      )}

      {lens && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-[rgba(2,7,12,0.72)] p-4 backdrop-blur-md md:p-10" onClick={() => setLens(null)} data-testid="lens-overlay">
          <div className="veil mx-auto max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[rgba(127,211,230,0.16)] px-4 py-3">
              <div className="flex gap-1">
                {LENSES.map((l) => (
                  <button key={l.id} type="button" onClick={() => setLens(l.id)}
                    className={`px-3 py-1 font-mono text-2xs uppercase tracking-eyebrow ${lens === l.id ? "text-[#ffd9a0]" : "text-muted hover:text-fg"}`}>
                    <span className="glyph mr-1">{l.glyph}</span>{l.label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setLens(null)} className="font-mono text-2xs uppercase tracking-eyebrow text-muted hover:text-fg">close ×</button>
            </div>
            {lens === "orrery" && <Orrery snap={snap} />}
            {lens === "soil" && <SoilView snap={snap} onSelect={() => {}} />}
            {lens === "becoming" && <BecomingView snap={snap} onSelect={() => {}} />}
          </div>
        </div>
      )}
    </>
  );
}
