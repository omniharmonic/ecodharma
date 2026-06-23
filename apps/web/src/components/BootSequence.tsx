"use client";
import { useEffect, useRef, useState } from "react";
import { WORDMARK, BOOT_LINES } from "./ascii/art";

// A cold-start sequence: the ASCII wordmark + a typed boot log, then it dissolves.
// Plays at most once per browser session. Skipped entirely for automated browsers
// (so it never intercepts e2e) and for reduced-motion users.
export function BootSequence({ domains, gifts, trimtabs }: { domains: number; gifts: number; trimtabs: number }) {
  const [show, setShow] = useState(false);
  const [n, setN] = useState(0);
  const lines = useRef<string[]>(BOOT_LINES(domains, gifts, trimtabs));

  useEffect(() => {
    // ?boot replays the sequence on demand (and overrides every gate).
    const forced = typeof location !== "undefined" && location.search.includes("boot");
    const automated = typeof navigator !== "undefined" && (navigator as any).webdriver;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let booted = false;
    try { booted = sessionStorage.getItem("eco-booted") === "1"; } catch {}
    if (!forced && (automated || reduce || booted)) return;
    try { sessionStorage.setItem("eco-booted", "1"); } catch {}
    setShow(true);
  }, []);

  useEffect(() => {
    if (!show) return;
    const t = setInterval(() => setN((i) => Math.min(i + 1, lines.current.length)), 150);
    const done = setTimeout(() => setShow(false), 2300); // matches CSS boot-out (1.7s delay + 0.5s)
    const skip = () => setShow(false);
    window.addEventListener("keydown", skip);
    return () => { clearInterval(t); clearTimeout(done); window.removeEventListener("keydown", skip); };
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="boot-overlay"
      role="status"
      aria-live="polite"
      onClick={() => setShow(false)}
    >
      <pre className="ascii-art phosphor-live" aria-label="EcoDharma" style={{ color: "rgb(var(--accent))" }}>
        {WORDMARK}
      </pre>
      <div className="boot-log">
        {lines.current.slice(0, n).map((l, i) => (
          <div key={i}>
            {l.includes("...") || l.includes("live") || l.includes("ok") ? (
              <span>{l.replace(/\b(ok|live|\d+ \w+|\d+\+)\s*$/, "")}<b>{(l.match(/\b(ok|live|\d+ \w+|\d+\+)\s*$/) || [""])[0]}</b></span>
            ) : (
              l || " "
            )}
          </div>
        ))}
        {n < lines.current.length && <span className="caret" />}
      </div>
      <p className="font-mono text-2xs uppercase tracking-eyebrow text-muted/60">press any key · or wait</p>
    </div>
  );
}
