import * as React from "react"; // in scope for the classic JSX transform (test harness)
import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Social share card renderer (next/og / Satori). Kept free of server-only deps
// (no db, no "server-only") so it can be unit-rendered in a test harness.

// EcoDharma palette (blueprint / cyanotype printing — reads best as a card).
const GROUND = "#0A272B";
const DEEP = "#071B1F";
const CHALK = "#DCE8E0";
const SOLAR = "#E8A13A";
const PHOSPHOR = "#9BE8B0";
const CYAN = "#4FA3B8";

export type SizeKey = "og" | "square" | "story";
export const SIZES: Record<SizeKey, { w: number; h: number }> = {
  og: { w: 1200, h: 630 },
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
};

// Per-format layout budget. `maxTitle` is the *largest* the hero text is ever
// drawn; it shrinks from there to guarantee a fit (see fitTitle).
type Layout = {
  pad: number;
  eyebrow: number;
  footer: number;
  gap: number; // between hero text and the archetype pills
  maxW: number; // hero text wrap width
  maxTitle: number;
  pill: number;
};
const LAYOUT: Record<SizeKey, Layout> = {
  og: { pad: 76, eyebrow: 21, footer: 34, gap: 26, maxW: 1010, maxTitle: 48, pill: 26 },
  square: { pad: 90, eyebrow: 26, footer: 40, gap: 40, maxW: 920, maxTitle: 52, pill: 24 },
  story: { pad: 90, eyebrow: 26, footer: 40, gap: 40, maxW: 920, maxTitle: 76, pill: 30 },
};

function fontFile(name: string): Buffer {
  // cwd is the function root on Vercel; try a couple of candidates for dev too.
  const candidates = [
    join(process.cwd(), "public/fonts", name),
    join(process.cwd(), "apps/web/public/fonts", name),
  ];
  for (const p of candidates) {
    try {
      return readFileSync(p);
    } catch {
      /* try next */
    }
  }
  throw new Error(`font not found: ${name}`);
}

const fraunces = fontFile("Fraunces-SemiBold.ttf");
const plex = fontFile("IBMPlexMono-Medium.ttf");

// --- Adaptive fit -----------------------------------------------------------
// Satori can't shrink text to fit a box, so we compute the font size up front.
// The model is deliberately CONSERVATIVE (over-estimate width, add a slack
// line, keep a height safety margin) so the result is a guarantee, not a guess:
// the hero text is NEVER clipped or ellipsized, at any length.

const HERO_LINE_HEIGHT = 1.2;
const FRAUNCES_ADVANCE = 0.54; // avg glyph advance (em) — rounded UP for safety
const PLEX_ADVANCE = 0.62; // IBM Plex Mono, uppercase pills

/** How many rows the archetype pills wrap into at a given content width. */
function pillRows(archetypes: string[], pillFont: number, contentW: number): number {
  const gap = 16;
  const widthOf = (a: string) => a.length * pillFont * PLEX_ADVANCE + 64; // 44 padding + ~20 dot/gap
  let rows = 1;
  let x = 0;
  for (const a of archetypes) {
    const w = widthOf(a);
    if (x === 0) {
      x = w;
    } else if (x + gap + w <= contentW) {
      x += gap + w;
    } else {
      rows += 1;
      x = w;
    }
  }
  return rows;
}

/** Largest hero font size (px) whose wrapped text is guaranteed to fit. */
export function fitTitle(
  text: string,
  archetypes: string[],
  size: SizeKey,
): number {
  const cfg = LAYOUT[size] ?? LAYOUT.og;
  const dim = SIZES[size] ?? SIZES.og;
  const len = Math.max(1, text.replace(/\s+/g, " ").trim().length);
  const contentW = dim.w - 2 * cfg.pad;

  // Vertical budget between the header eyebrow and the footer.
  const headerH = cfg.eyebrow * 1.3;
  const footerH = cfg.footer * 1.3;
  const availBody = dim.h - 2 * cfg.pad - headerH - footerH;

  // Space the pills claim inside that budget (they sit below the hero).
  const rows = pillRows(archetypes.length ? archetypes : ["Your gifts"], cfg.pill, contentW);
  const pillRowH = cfg.pill + 26; // 24 vertical padding + border
  const pillsH = rows * pillRowH + (rows - 1) * 16 + 8; // +8 pill container marginTop

  // What's left for the hero, minus a safety margin.
  const availHero = availBody - pillsH - cfg.gap - 28;

  for (let fs = cfg.maxTitle; fs >= 12; fs--) {
    const charsPerLine = Math.max(1, Math.floor(cfg.maxW / (fs * FRAUNCES_ADVANCE)));
    const lines = Math.ceil(len / charsPerLine) + 1; // +1 slack for word-boundary wrapping
    const textH = lines * fs * HERO_LINE_HEIGHT;
    if (textH <= availHero) return fs;
  }
  return 12; // floor — only reachable for pathological (thousands of chars) input
}

// --- Render -----------------------------------------------------------------

export function renderCard(opts: { size: SizeKey; recognition: string; archetypes: string[] }): ImageResponse {
  const { w, h } = SIZES[opts.size] ?? SIZES.og;
  const cfg = LAYOUT[opts.size] ?? LAYOUT.og;
  const tall = h >= w; // square / story

  const recognition = (opts.recognition || "A field manual for the work that is only yours.")
    .replace(/\s+/g, " ")
    .trim();
  const archetypes = opts.archetypes.length ? opts.archetypes : ["Your gifts"];

  const pad = cfg.pad;
  const titleSize = fitTitle(recognition, archetypes, opts.size);

  return new ImageResponse(
    (
      <div
        style={{
          width: w,
          height: h,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: pad,
          backgroundColor: GROUND,
          backgroundImage: `linear-gradient(180deg, ${GROUND} 0%, ${DEEP} 100%)`,
          fontFamily: "IBM Plex Mono",
          position: "relative",
        }}
      >
        {/* atmospheric glows (single radial each — Satori-safe) */}
        <div style={{ position: "absolute", top: -260, right: -200, width: 760, height: 760, display: "flex", backgroundImage: "radial-gradient(circle at center, rgba(232,161,58,0.20), rgba(232,161,58,0) 60%)" }} />
        <div style={{ position: "absolute", bottom: -300, left: -220, width: 760, height: 760, display: "flex", backgroundImage: "radial-gradient(circle at center, rgba(155,232,176,0.12), rgba(155,232,176,0) 60%)" }} />

        {/* faint hairline frame */}
        <div
          style={{
            position: "absolute",
            top: pad * 0.55,
            left: pad * 0.55,
            right: pad * 0.55,
            bottom: pad * 0.55,
            border: `1px solid rgba(79,163,184,0.28)`,
            display: "flex",
          }}
        />

        {/* geodesic corner motif — concentric rings + a struck triangle */}
        <div style={{ position: "absolute", top: -180, right: -180, width: 520, height: 520, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", width: 520, height: 520, borderRadius: 520, border: `1px solid rgba(79,163,184,0.22)`, display: "flex" }} />
          <div style={{ position: "absolute", width: 380, height: 380, borderRadius: 380, border: `1px solid rgba(79,163,184,0.28)`, display: "flex" }} />
          <div style={{ position: "absolute", width: 240, height: 240, borderRadius: 240, border: `1px solid rgba(232,161,58,0.5)`, display: "flex" }} />
        </div>

        {/* header eyebrow */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, color: CYAN, letterSpacing: 4, fontSize: cfg.eyebrow, textTransform: "uppercase" }}>
          <div style={{ width: 46, height: 2, backgroundColor: SOLAR, display: "flex" }} />
          <span>EcoDharma · The work that is only yours</span>
        </div>

        {/* body: recognition line */}
        <div style={{ display: "flex", flexDirection: "column", gap: cfg.gap, marginTop: "auto", marginBottom: "auto" }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Fraunces",
              color: CHALK,
              fontSize: titleSize,
              lineHeight: HERO_LINE_HEIGHT,
              letterSpacing: -0.5,
              maxWidth: cfg.maxW,
            }}
          >
            {recognition}
          </div>

          {/* archetype tags */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8 }}>
            {archetypes.map((a, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 22px",
                  border: `1px solid rgba(232,161,58,0.55)`,
                  color: SOLAR,
                  fontSize: cfg.pill,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                }}
              >
                <div style={{ width: 8, height: 8, backgroundColor: PHOSPHOR, display: "flex" }} />
                {a}
              </div>
            ))}
          </div>
        </div>

        {/* footer — CTA on the left so its arrow points at the URL on the right */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, color: SOLAR, fontSize: tall ? 28 : 24, letterSpacing: 3, textTransform: "uppercase" }}>
            <span>Get your free reading</span>
            <span style={{ display: "flex", color: PHOSPHOR }}>→</span>
          </div>
          <div style={{ display: "flex", fontFamily: "Fraunces", color: CHALK, fontSize: tall ? 40 : 34, letterSpacing: -0.5 }}>
            ecodharma.xyz
          </div>
        </div>
      </div>
    ),
    {
      width: w,
      height: h,
      fonts: [
        { name: "Fraunces", data: fraunces, weight: 600, style: "normal" },
        { name: "IBM Plex Mono", data: plex, weight: 500, style: "normal" },
      ],
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
