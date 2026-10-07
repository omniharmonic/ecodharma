"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// The glyph compass: the only chrome in the dreamscape. A slowly turning sigil;
// open it and the destinations appear as glyphs on a circle in the dark.

type Dest = { href: string; glyph: string; label: string; hint: string };

const SIGNED_IN: Dest[] = [
  { href: "/altar", glyph: "☉", label: "Altar", hint: "soul's becoming" },
  { href: "/journal", glyph: "☽", label: "Journal", hint: "reflections on the water" },
  { href: "/journey", glyph: "⟡", label: "Journey", hint: "the path of practice" },
  { href: "/inquiry", glyph: "◈", label: "Inquiry", hint: "the seven chambers" },
  { href: "/profile", glyph: "✶", label: "Reading", hint: "the sky you were born under" },
  { href: "/constellations", glyph: "⁂", label: "Constellations", hint: "those co-arising with you" },
  { href: "/settings", glyph: "⚙", label: "Settings", hint: "membership · consent · data" },
];
const SIGNED_OUT: Dest[] = [
  { href: "/", glyph: "☉", label: "Threshold", hint: "the beginning" },
  { href: "/signup", glyph: "✧", label: "Begin", hint: "receive your reading" },
  { href: "/login", glyph: "☽", label: "Return", hint: "sign in" },
];

function Sigil({ open }: { open: boolean }) {
  return (
    <svg viewBox="-20 -20 40 40" width="34" height="34" aria-hidden className={open ? "" : "altar-spin-slow"}>
      <g fill="none" stroke="rgb(var(--accent))" strokeWidth="0.8">
        <circle r="17" opacity="0.6" />
        <circle r="6" />
        {Array.from({ length: 6 }, (_, i) => <circle key={i} r="6" cx={6 * Math.cos((i * Math.PI) / 3)} cy={6 * Math.sin((i * Math.PI) / 3)} opacity="0.7" />)}
        <path d="M0,-17 L0,17 M-17,0 L17,0" opacity="0.35" />
      </g>
      <circle r="2" fill="rgb(var(--halo))" />
    </svg>
  );
}

export function GlyphCompass({ signedIn, logout }: { signedIn: boolean; logout: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const dests = signedIn ? SIGNED_IN : SIGNED_OUT;
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  return (
    <>
      <header className="dream-chrome">
        <Link href={signedIn ? "/altar" : "/"} className="dream-wordmark">ecodharma</Link>
        <button type="button" className="dream-compass" onClick={() => setOpen((o) => !o)} aria-label="Open the compass" aria-expanded={open} data-testid="compass">
          <Sigil open={open} />
        </button>
      </header>
      {open && (
        <div className="compass-overlay" onClick={() => setOpen(false)} data-testid="compass-menu">
          <nav className="compass-ring" onClick={(e) => e.stopPropagation()}>
            {dests.map((d, i) => {
              const a = (i / dests.length) * Math.PI * 2 - Math.PI / 2;
              const active = pathname === d.href || (d.href !== "/" && pathname?.startsWith(d.href));
              return (
                <Link key={d.href} href={d.href} className={`compass-node ${active ? "is-active" : ""}`}
                  style={{ transform: `translate(calc(-50% + ${Math.cos(a) * 150}px), calc(-50% + ${Math.sin(a) * 150}px))`, animationDelay: `${i * 45}ms` }}>
                  <span className="compass-glyph">{d.glyph}</span>
                  <span className="compass-label">{d.label}</span>
                  <span className="compass-hint">{d.hint}</span>
                </Link>
              );
            })}
            <div className="compass-center"><Sigil open /></div>
          </nav>
          {signedIn && <div className="compass-foot" onClick={(e) => e.stopPropagation()}>{logout}</div>}
        </div>
      )}
    </>
  );
}
