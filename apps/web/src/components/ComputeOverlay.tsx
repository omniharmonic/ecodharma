"use client";
import { useEffect, useState } from "react";
import { AsciiEarth } from "./AsciiEarth";

// The compute moment: while charts are computed and interpreted, the Earth turns
// and instrument readouts tick — unavoidable latency becomes the most on-brand
// moment in the app. Rendered only while the onboarding form is pending.
const STEPS = [
  "ESTABLISHING EPHEMERIS LOCK…",
  "COMPUTING WESTERN (TROPICAL) CHART…",
  "COMPUTING VEDIC (SIDEREAL) CHART…",
  "DERIVING HUMAN-DESIGN BODYGRAPH…",
  "DERIVING GENE-KEY SEQUENCES…",
  "LOADING FRAMEWORK v1.1.0…",
  "INTERPRETING THROUGH THE GREAT TURNING…",
  "DRAFTING YOUR PATENT…",
];

export function ComputeOverlay({ show }: { show: boolean }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!show) {
      setI(0);
      return;
    }
    const id = setInterval(() => setI((n) => Math.min(n + 1, STEPS.length - 1)), 1400);
    return () => clearInterval(id);
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/95 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="cell w-[min(92vw,560px)] text-center">
        <p className="fig">Fig. 00 · Instrument coming online</p>
        <div className="my-4 flex justify-center">
          <AsciiEarth cols={46} rows={24} />
        </div>
        <div className="mx-auto max-w-sm space-y-1 text-left font-mono text-2xs text-muted">
          {STEPS.slice(0, i + 1).map((s, k) => (
            <p key={k} className={k === i ? "text-live" : ""}>
              <span className="text-accent">&gt;</span> {s}
              {k === i ? " ▮" : " ✓"}
            </p>
          ))}
        </div>
        <p className="mt-4 font-sans text-sm text-muted">
          Reading you through many lenses. This takes a moment when drafted by hand.
        </p>
      </div>
    </div>
  );
}
