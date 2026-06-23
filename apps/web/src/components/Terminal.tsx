import type { ReactNode } from "react";
import { NODE } from "./ascii/art";

// A terminal window: traffic-light dots + a mono titlebar + the "screen".
// Server-safe (no hooks). The phosphor screen + scanlines come from CSS.
export function TermPane({
  title,
  corner,
  children,
  className,
  bodyClassName,
  testid,
  grain = false,
}: {
  title: string;
  corner?: string; // small right-aligned label (e.g. "live", "fig. A")
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  testid?: string;
  grain?: boolean;
}) {
  return (
    <figure
      className={["term-window", className].filter(Boolean).join(" ")}
      data-testid={testid}
    >
      <div className="term-titlebar">
        <span className="term-dots" aria-hidden>
          <i /><i /><i />
        </span>
        <span className="term-title">{title}</span>
        <span className="term-corner" aria-hidden>{corner || NODE}</span>
      </div>
      <div className={["term-body", grain ? "crt-grain" : "", bodyClassName].filter(Boolean).join(" ")}>
        {children}
      </div>
    </figure>
  );
}

// A monospace ASCII art block, centered, phosphor-glowing, never overflowing.
export function Ascii({
  art,
  className,
  glow = "live",
  label,
}: {
  art: string;
  className?: string;
  glow?: "live" | "solar" | "none";
  label?: string;
}) {
  const glowClass = glow === "live" ? "phosphor-live" : glow === "solar" ? "phosphor-solar" : "";
  return (
    <pre
      className={["ascii-art", glowClass, className].filter(Boolean).join(" ")}
      role="img"
      aria-label={label || "ascii art"}
    >
      {art}
    </pre>
  );
}

// A section divider with a centered glyph and box-drawing rules either side.
export function AsciiDivider({ glyph = NODE, label }: { glyph?: string; label?: string }) {
  return (
    <div className="ascii-divider" aria-hidden>
      <span className="ascii-divider-line" />
      <span className="ascii-divider-glyph">{label ? `${glyph} ${label} ${glyph}` : glyph}</span>
      <span className="ascii-divider-line" />
    </div>
  );
}
