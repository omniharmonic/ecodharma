"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Snapshot } from "@/lib/altar/snapshot";
import { Orrery } from "./Orrery";
import { Telemetry } from "./Telemetry";
import { SacredGeometry } from "./SacredGeometry";

// Soul's Becoming — the console. One snapshot, several ways of seeing:
//   ORRERY   the altar as a living mandala (2D; also the still fallback)
//   SKY      a star of light: 3D celestial sphere over your natal sky
//   SOIL     a node in the mycelial web: roots, hyphae, pulses, reciprocity
//   BECOMING time: the year spiral and the tree rings of your prayer
// Heavy views load on demand.

const SkyView = dynamic(() => import("./SkyView").then((m) => m.SkyView), { ssr: false, loading: () => <Loading what="sky" /> });
const SoilView = dynamic(() => import("./SoilView").then((m) => m.SoilView), { ssr: false, loading: () => <Loading what="soil" /> });
const BecomingView = dynamic(() => import("./BecomingView").then((m) => m.BecomingView), { ssr: false, loading: () => <Loading what="time" /> });

type View = "orrery" | "sky" | "soil" | "becoming";
const VIEWS: { id: View; label: string; glyph: string; hint: string }[] = [
  { id: "orrery", label: "Orrery", glyph: "⊙", hint: "the altar as a living mandala" },
  { id: "sky", label: "Sky", glyph: "✶", hint: "a star of light" },
  { id: "soil", label: "Soil", glyph: "⟟", hint: "a node in the mycelial web" },
  { id: "becoming", label: "Becoming", glyph: "◌", hint: "the spiral of your years" },
];

function Loading({ what }: { what: string }) {
  return (
    <div className="flex aspect-square w-full items-center justify-center">
      <div className="text-center">
        <SacredGeometry size={220} variant="seed" opacity={0.4} />
        <p className="mt-2 telemetry">calibrating {what}…</p>
      </div>
    </div>
  );
}

function canWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function SoulConsole({ snap }: { snap: Snapshot }) {
  const [view, setView] = useState<View>("orrery");
  const [selected, setSelected] = useState<number | null>(null);
  const [gl, setGl] = useState(true);
  const [still, setStill] = useState(false);
  useEffect(() => {
    setGl(canWebGL());
    setStill(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
    try {
      const v = localStorage.getItem("eco-altar-view") as View | null;
      if (v && VIEWS.some((x) => x.id === v)) setView(v);
    } catch { /* storage unavailable */ }
  }, []);
  const choose = (v: View) => {
    setView(v);
    try { localStorage.setItem("eco-altar-view", v); } catch { /* ignore */ }
  };
  const sel = selected != null ? snap.elements.find((e) => e.lineage_id === selected) : null;

  return (
    <div className="console" data-testid="soul-console">
      <Telemetry snap={snap} />
      <div className="flex flex-wrap items-center gap-1 border-b border-rule/15 px-3 py-2">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => choose(v.id)}
            title={v.hint}
            data-testid={`view-${v.id}`}
            className={`font-mono text-2xs uppercase tracking-eyebrow px-2.5 py-1 border ${view === v.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-fg"}`}
          >
            <span className="glyph mr-1">{v.glyph}</span>{v.label}
          </button>
        ))}
        {sel && (
          <span className="ml-auto telemetry">
            selected · <b>{sel.title.length > 40 ? `${sel.title.slice(0, 38)}…` : sel.title}</b>
            <button type="button" className="ml-2 text-accent" onClick={() => setSelected(null)}>×</button>
          </span>
        )}
      </div>
      <div className="relative">
        {view === "orrery" && <Orrery snap={snap} onSelect={setSelected} selected={selected} />}
        {view === "sky" && (gl && !still ? <SkyView snap={snap} onSelect={setSelected} /> : <Orrery snap={snap} onSelect={setSelected} selected={selected} />)}
        {view === "soil" && <SoilView snap={snap} onSelect={setSelected} still={still} />}
        {view === "becoming" && <BecomingView snap={snap} onSelect={setSelected} />}
      </div>
    </div>
  );
}
