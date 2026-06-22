# EcoDharma v3 — Visual System Spec

Ancient-future CRT terminal · eco-socialist poster · Buckminster Fuller drafting table.
Two printings of one press: **vellum** (light, `:root`) and **blueprint** (dark, `.mode-blueprint`).
NO new dependencies. Pure CSS / SVG / canvas + React. Reduced-motion safe everywhere.

This spec covers four build targets:
1. Deeper CRT / ancient-future aesthetic — concrete `globals.css` additions.
2. 3D Framer-style transitions — `<PageTransition>` / `<SectionReveal>` client components + keyframes.
3. Accurate ASCII globe — algorithm + a real, recognizable equirectangular landmask to replace `AsciiEarth.tsx`.
4. Mock constellations — sample data + a `/constellations/sample` route to demo the experience.

All new tokens reuse existing CSS vars: `--bg --surface --fg --muted --rule --accent` (SOLAR amber, constant across modes) `--solar-ink --link --live` (phosphor/pine) `--flag`. Fonts: `font-display` (Fraunces), `font-sans` (Archivo), `font-mono` (IBM Plex Mono). Utility classes already present: `.row .plate .pill .btn-line .btn-solar .input .label .eyebrow .fig .kv .h-display .rule-x .riso-solar .animate-rise`.

---

## 0. New CSS variables (add to `globals.css`)

Add inside `:root` and `.mode-blueprint` so the CRT treatment is mode-aware (lighter touch in vellum, full phosphor in blueprint).

```css
:root {
  /* ...existing... */
  --crt-scan-alpha: 0.030;     /* scanline darkness — whisper on vellum */
  --crt-scan-size: 3px;        /* scanline period */
  --crt-glow: 154 106 30;      /* phosphor glow color = solar-ink on light */
  --crt-glow-alpha: 0.10;
  --crt-grain-alpha: 0.025;
  --crt-flicker-alpha: 0.010;  /* near-zero on light */
  --box: 21 25 27;             /* box-drawing rule color (ink) */
}
.mode-blueprint {
  /* ...existing... */
  --crt-scan-alpha: 0.075;     /* darker, true CRT on blueprint */
  --crt-scan-size: 3px;
  --crt-glow: 155 232 176;     /* phosphor green */
  --crt-glow-alpha: 0.22;
  --crt-grain-alpha: 0.05;
  --crt-flicker-alpha: 0.035;
  --box: 79 163 184;           /* cyan rule */
}
```

---

## 1. DEEPER CRT / ANCIENT-FUTURE AESTHETIC

### 1.1 Global scanline + vignette overlay — `body::after`
The existing `body::before` (paper tooth) stays. Add a SECOND fixed overlay for scanlines, applied to `body::after` so it never intercepts pointer events and layers above content vignette-style but below `#app-root` text legibility (kept very low alpha).

```css
/* CRT scanlines + faint vignette — fixed, non-interactive, above paper tooth */
body::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 2;                 /* over content's z-1, but pointer-events:none */
  pointer-events: none;
  background:
    repeating-linear-gradient(
      to bottom,
      rgb(0 0 0 / var(--crt-scan-alpha)) 0,
      rgb(0 0 0 / var(--crt-scan-alpha)) 1px,
      transparent 1px,
      transparent var(--crt-scan-size)
    ),
    radial-gradient(120% 100% at 50% 50%,
      transparent 62%, rgb(0 0 0 / 0.12) 100%);
}
.mode-blueprint body::after {
  background:
    repeating-linear-gradient(
      to bottom,
      rgb(0 0 0 / var(--crt-scan-alpha)) 0,
      rgb(0 0 0 / var(--crt-scan-alpha)) 1px,
      transparent 1px,
      transparent var(--crt-scan-size)
    ),
    radial-gradient(120% 100% at 50% 50%,
      transparent 55%, rgb(0 0 0 / 0.30) 100%);
}
```

### 1.2 Optional flicker + grain — `.crt-live` (opt-in, reduced-motion gated)
Do NOT flicker the whole page by default (nauseating). Provide an opt-in class for the hero / globe figure only. Flicker is sub-perceptual (1–3.5% opacity jitter), driven by a slow keyframe.

```css
@keyframes crt-flicker {
  0%, 100% { opacity: 1; }
  48% { opacity: 1; }
  49% { opacity: calc(1 - var(--crt-flicker-alpha)); }
  50% { opacity: 1; }
  82% { opacity: calc(1 - var(--crt-flicker-alpha) * 0.6); }
  83% { opacity: 1; }
}
.crt-live { animation: crt-flicker 7s steps(1, end) infinite; will-change: opacity; }

/* moving grain — tiny translate of an SVG noise tile, slow */
@keyframes crt-grain {
  0% { transform: translate(0, 0); }
  25% { transform: translate(-2%, 1%); }
  50% { transform: translate(1%, -2%); }
  75% { transform: translate(-1%, 2%); }
  100% { transform: translate(0, 0); }
}
.crt-grain { position: relative; }
.crt-grain::before {
  content: "";
  position: absolute;
  inset: -6%;
  pointer-events: none;
  opacity: var(--crt-grain-alpha);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E");
  animation: crt-grain 6s steps(4) infinite;
}
```

### 1.3 Phosphor glow — `.phosphor` and `.phosphor-solar`
Text glow that reads as CRT bloom. Use sparingly on display headings, the globe, live readouts. Glow color is mode-aware (`--crt-glow`).

```css
.phosphor {
  text-shadow:
    0 0 1px rgb(var(--crt-glow) / var(--crt-glow-alpha)),
    0 0 6px rgb(var(--crt-glow) / calc(var(--crt-glow-alpha) * 0.7)),
    0 0 18px rgb(var(--crt-glow) / calc(var(--crt-glow-alpha) * 0.4));
}
.phosphor-solar {
  color: rgb(var(--accent));
  text-shadow:
    0 0 2px rgb(var(--accent) / 0.35),
    0 0 12px rgb(var(--accent) / 0.25);
}
/* phosphor for the live/pine readout color */
.phosphor-live { color: rgb(var(--live)); text-shadow: 0 0 8px rgb(var(--live) / 0.4); }
```

### 1.4 Terminal chrome framing — `.crt-frame` and `.crt-screen`
A bordered "screen" container with a title bar, registration corners, and inset glow — the housing for instrument plates (charts, globe). Replaces ad-hoc `.plate` for the big set-pieces.

```css
.crt-frame {
  position: relative;
  border: 1px solid rgb(var(--rule) / 0.45);
  border-radius: 3px;
  background: rgb(var(--surface) / 0.55);
  box-shadow:
    inset 0 0 40px rgb(var(--crt-glow) / calc(var(--crt-glow-alpha) * 0.5)),
    inset 0 0 1px rgb(var(--fg) / 0.4);
}
.crt-frame::before {  /* title strip */
  content: attr(data-title);
  position: absolute;
  top: 0; left: 0; right: 0;
  padding: 4px 10px;
  font: 500 0.6875rem/1 var(--font-plex-mono, monospace);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgb(var(--muted));
  border-bottom: 1px solid rgb(var(--rule) / 0.25);
  background: rgb(var(--bg) / 0.6);
}
.crt-frame > .crt-screen { padding: 2.25rem 1.25rem 1.25rem; } /* room for title strip */

/* registration corner ticks (Fuller drafting marks) */
.crt-frame::after {
  content: "";
  position: absolute; inset: 6px;
  pointer-events: none;
  background:
    linear-gradient(rgb(var(--accent)) 0 0) left top,
    linear-gradient(rgb(var(--accent)) 0 0) left top,
    linear-gradient(rgb(var(--accent)) 0 0) right top,
    linear-gradient(rgb(var(--accent)) 0 0) right top,
    linear-gradient(rgb(var(--accent)) 0 0) left bottom,
    linear-gradient(rgb(var(--accent)) 0 0) left bottom,
    linear-gradient(rgb(var(--accent)) 0 0) right bottom,
    linear-gradient(rgb(var(--accent)) 0 0) right bottom;
  background-repeat: no-repeat;
  background-size: 10px 1px, 1px 10px;  /* horizontal + vertical tick per corner */
  opacity: 0.55;
}
```

Usage: `<figure className="crt-frame" data-title="Fig. 1 · whole earth"><div className="crt-screen">…</div></figure>`

### 1.5 ASCII / box-drawing dividers — `.rule-ascii`, `.rule-box`, `.divider-glyph`
Eco-socialist-poster boldness via typographic rules made of box-drawing glyphs. Pure CSS using `::before` content fills; no markup churn.

```css
/* full-width dashed box-drawing rule: ───────── */
.rule-ascii {
  border: 0;
  height: 1.1em;
  color: rgb(var(--muted) / 0.6);
  font-family: var(--font-plex-mono, monospace);
  overflow: hidden;
  white-space: nowrap;
  line-height: 1.1em;
}
.rule-ascii::before {
  content: "────────────────────────────────────────────────────────────────────────────────────────";
}
/* double rule for section heads: ═══ */
.rule-box::before { content: "════════════════════════════════════════════════════════════════════════════════════════"; }

/* centered glyph divider: ──◇── style. Use as <p class="divider-glyph">◇</p> */
.divider-glyph {
  display: flex; align-items: center; gap: 0.75rem;
  font-family: var(--font-plex-mono, monospace);
  color: rgb(var(--muted) / 0.5);
}
.divider-glyph::before, .divider-glyph::after {
  content: ""; flex: 1; height: 1px; background: rgb(var(--rule) / 0.25);
}
```

Box-drawing palette for the build agent to use in JSX content (poster headers, table borders): corners `┌ ┐ └ ┘ ╔ ╗ ╚ ╝`, tees `├ ┤ ┬ ┴ ╠ ╣`, lines `─ │ ═ ║`, blocks `█ ▓ ▒ ░`, marks `◇ ◆ ✦ ✧ ⊢ ⊣ ＋ ·`.

### 1.6 Poster boldness — `.poster-mega`, `.slab`
Eco-socialist propaganda-poster scale moments (used once per page max).

```css
.poster-mega {
  font-family: var(--font-display, serif);
  font-size: clamp(3.5rem, 11vw, 8rem);
  line-height: 0.9;
  letter-spacing: -0.02em;
  text-transform: uppercase;
}
/* solar slab callout block — riso fill, ink text, hard edges */
.slab {
  background: rgb(var(--accent));
  color: rgb(var(--fg));
  padding: 0.15em 0.4em;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
.mode-blueprint .slab { color: #0A272B; } /* dark ground text on solar */
```

### 1.7 Reduced-motion guard (extend existing block)
```css
@media (prefers-reduced-motion: reduce) {
  .draft-line { animation: none; stroke-dashoffset: 0; }
  .animate-rise { animation: none; }
  .crt-live, .crt-grain::before { animation: none; }
  .pt-stage, .pt-stage > * { animation: none !important; transform: none !important; opacity: 1 !important; }
}
```

---

## 2. 3D FRAMER-STYLE TRANSITIONS (no library)

Two client components in `src/components/`:
- `PageTransition.tsx` — wraps each route's content; replays a 3D "boot/tilt-in" on route change (keyed off `usePathname()`).
- `SectionReveal.tsx` — wraps individual sections; staggered depth reveal via `animation-delay`, optionally triggered on scroll with `IntersectionObserver`.

### 2.1 Keyframes (add to `globals.css`)
```css
/* page boots in: from far on the Z axis, tilted back, into place */
@keyframes pt-in {
  from { opacity: 0; transform: perspective(1200px) translateZ(-140px) translateY(26px) rotateX(7deg); }
  to   { opacity: 1; transform: perspective(1200px) translateZ(0)      translateY(0)    rotateX(0deg); }
}
/* section panels rise with subtle parallax depth */
@keyframes sr-in {
  from { opacity: 0; transform: perspective(1000px) translateZ(-60px) translateY(20px) rotateX(4deg); }
  to   { opacity: 1; transform: perspective(1000px) translateZ(0)     translateY(0)    rotateX(0deg); }
}
.pt-stage { transform-style: preserve-3d; animation: pt-in 0.55s cubic-bezier(.16,.84,.3,1) both; }
.sr-item  { opacity: 0; animation: sr-in 0.6s cubic-bezier(.16,.84,.3,1) both; }
/* stagger via data-index → inline style --i; delay = i * 70ms */
.sr-item { animation-delay: calc(var(--i, 0) * 70ms); }
```

### 2.2 `PageTransition.tsx`
```tsx
"use client";
import { usePathname } from "next/navigation";
import { useRef } from "react";

// Replays the 3D boot-in whenever the path changes by re-keying the wrapper.
// Pure CSS animation; respects reduced-motion via the globals.css guard.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div key={pathname} ref={ref} className="pt-stage">
      {children}
    </div>
  );
}
```
Wire-up: in `layout.tsx`, wrap the `{children}` of `<main>`:
```tsx
<main className="mx-auto max-w-6xl px-5 pb-28">
  <PageTransition>{children}</PageTransition>
</main>
```
`key={pathname}` forces React to remount the subtree on navigation, so the CSS animation re-fires. No state, no library.

### 2.3 `SectionReveal.tsx`
```tsx
"use client";
import { useEffect, useRef, useState } from "react";

// Staggered 3D reveal. `index` sets the stagger delay (--i). When `onView` is
// true, it waits for IntersectionObserver before animating (for below-the-fold).
export function SectionReveal({
  children, index = 0, onView = false, className = "", as: Tag = "div",
}: {
  children: React.ReactNode; index?: number; onView?: boolean;
  className?: string; as?: any;
}) {
  const ref = useRef<HTMLElement>(null);
  const [show, setShow] = useState(!onView);
  useEffect(() => {
    if (!onView || !ref.current) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShow(true); io.disconnect(); } },
      { threshold: 0.15 },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [onView]);
  return (
    <Tag
      ref={ref as any}
      className={`${show ? "sr-item" : ""} ${className}`}
      style={{ ["--i" as any]: index, ...(onView && !show ? { opacity: 0 } : {}) }}
    >
      {children}
    </Tag>
  );
}
```
Usage on the hero / framework sections (replaces ad-hoc `.animate-rise`):
```tsx
<SectionReveal index={0}>…hero copy…</SectionReveal>
<SectionReveal index={1} onView>…three dimensions grid…</SectionReveal>
<SectionReveal index={2} onView>…framework…</SectionReveal>
```
Notes: `transform-style: preserve-3d` + a per-element `perspective()` inside the transform keeps each panel independently dimensional (no shared scene needed). Keep `translateZ` modest (≤140px) to avoid clipping/blur. Always pair animations with `both` fill so end-state sticks.

---

## 3. ACCURATE ASCII GLOBE (replace `AsciiEarth.tsx`)

Keep the orthographic ray-sampling structure already in `AsciiEarth.tsx` (sphere → per-cell `z`, illumination, `lat/lon`, run-length `<span>` tiers, ~18fps, IntersectionObserver, reduced-motion static frame). The ONLY substantive change: **replace the fake blob `isLand()` with a lookup against a real equirectangular landmask** so continents are recognizable.

### 3.1 Sampling algorithm (unchanged shape, corrected lon convention)
For each cell `(i,j)`:
```
x = (i/(cols-1))*2 - 1
y = (j/(rows-1))*2 - 1     // +y is screen-down → invert for latitude
r2 = x*x + y*y; if r2 > 1 → space (tier 0)
z = sqrt(1 - r2)
ill = x*lx + y*ly + z*lz   // light upper-right; lx=.82 ly=.32 lz=.48
lat =  asin(-y) in radians                 // NOTE: -y so north is up
lon =  atan2(x, z) + angle                 // rotation
land = isLand(latDeg, lonDeg)              // see 3.3
brightness = 0.16 + 0.84*max(0,ill); if (!land) brightness *= 0.52
glyph = RAMP[round(brightness*(RAMP.len-1))]   // RAMP = " .,:;ox%#@"
tier  = ill > 0.74 ? 3(sun) : land ? 2(land) : 1(sea)
```
Tier → color (Tailwind on the `<pre>`, unchanged): `.e1` = `text-live/45` (sea), `.e2` = `text-live` (land), `.e3` = `text-accent` (sunlit limb). For an even more "ancient-future" read, the build agent MAY add `.e2` → `phosphor-live` and wrap the `<pre>` in `.crt-grain`.

### 3.2 Mode awareness
Globe colors already come from CSS vars via Tailwind tiers, so it re-inks automatically: pine/phosphor land + solar limb on both grounds. In vellum, optionally reduce sea tier to `text-muted/40` so ocean reads as faint graphite rather than green — pass a `mode` prop or read `document.documentElement.classList.contains("mode-blueprint")` once in the effect and pick a class set.

### 3.3 The landmask — real, recognizable, compact (REPLACES `LAND` blobs)
Equirectangular boolean grid, **72 columns × 36 rows** (5° per cell). Encoded as **run-length land spans per row** — compact, human-verifiable, and trivial to expand. Column→longitude: `lon = -180 + col*5 + 2.5`. Row→latitude: `lat = 90 - row*5 - 2.5`. Each entry is a list of inclusive `[startCol, endCol]` land runs; empty = all ocean.

```ts
// LANDMASK_72x36 — inclusive [startCol,endCol] land runs per row, row 0 = ~+88N.
// Recognizable: N&S America, Greenland, Europe, Africa, Asia, India, SE-Asia
// islands, Australia, Antarctica. col 0 = -180°, col 36 = 0°, col 71 = +177.5°.
export const LANDMASK_RUNS: ReadonlyArray<ReadonlyArray<[number, number]>> = [
  /* 0  +88N */ [],
  /* 1  +83N */ [[27,30]],
  /* 2  +78N */ [[18,22],[26,31],[38,38],[58,60]],
  /* 3  +73N */ [[8,24],[26,31],[40,68]],
  /* 4  +68N */ [[3,7],[9,24],[27,31],[37,70]],
  /* 5  +63N */ [[3,8],[9,24],[28,30],[31,31],[35,71]],
  /* 6  +58N */ [[3,8],[9,25],[31,31],[35,71]],
  /* 7  +53N */ [[9,25],[33,34],[36,69],[70,71]],
  /* 8  +48N */ [[10,24],[35,71]],
  /* 9  +43N */ [[11,23],[34,71]],
  /* 10 +38N */ [[11,22],[33,71]],
  /* 11 +33N */ [[11,22],[32,71]],
  /* 12 +28N */ [[13,22],[31,71]],
  /* 13 +23N */ [[14,20],[31,49],[50,71]],
  /* 14 +18N */ [[15,20],[31,49],[50,64]],
  /* 15 +13N */ [[16,20],[31,48],[50,63]],
  /* 16 +08N */ [[17,20],[33,47],[52,63]],
  /* 17 +03N */ [[20,22],[34,46],[55,64]],
  /* 18 -03S */ [[20,29],[35,45],[56,64]],
  /* 19 -08S */ [[21,29],[36,45],[57,65]],
  /* 20 -13S */ [[21,29],[37,45],[58,66]],
  /* 21 -18S */ [[22,29],[38,45],[47,47],[57,66]],
  /* 22 -23S */ [[23,28],[38,44],[47,48],[57,66]],
  /* 23 -28S */ [[23,27],[39,43],[57,66]],
  /* 24 -33S */ [[23,27],[40,43],[58,65]],
  /* 25 -38S */ [[24,27],[60,63],[64,64]],
  /* 26 -43S */ [[24,26]],
  /* 27 -48S */ [[24,26]],
  /* 28 -53S */ [[25,26]],
  /* 29 -58S */ [],
  /* 30 -63S */ [[22,24]],
  /* 31 -68S */ [[0,71]],
  /* 32 -73S */ [[0,71]],
  /* 33 -78S */ [[0,71]],
  /* 34 -83S */ [[0,71]],
  /* 35 -88S */ [[0,71]],
];
```

`isLand` lookup (replaces the blob loop):
```ts
const COLS = 72, ROWS = 36;
function isLand(latDeg: number, lonDeg: number): boolean {
  // normalize lon to [-180,180)
  let lon = ((lonDeg + 180) % 360 + 360) % 360 - 180;
  let col = Math.floor((lon + 180) / 5);
  if (col < 0) col = 0; if (col > COLS - 1) col = COLS - 1;
  let row = Math.floor((90 - latDeg) / 5);
  if (row < 0) row = 0; if (row > ROWS - 1) row = ROWS - 1;
  const runs = LANDMASK_RUNS[row];
  for (const [a, b] of runs) if (col >= a && col <= b) return true;
  return false;
}
```
This is geographically accurate enough to read the continents at 56×30 glyphs. The build agent MAY upscale later (e.g. expand to a 144×72 bitmask string), but the 72×36 run table is the canonical replacement for the fake blobs and must be used. Optional polish: bilinear-soften coastlines by sampling the 4 neighbor cells and treating a cell as "coast" (dimmer land glyph) if mixed — purely cosmetic.

### 3.4 Sunlit limb
Keep `tier 3` for `ill > 0.74` rendered in `text-accent` (solar). Add a thin terminator shimmer: cells where `0.0 < ill < 0.06` get glyph `·` in `.e1` — reads as the day/night boundary. Reduced-motion: render one static frame at `angle = 0.6` (already implemented), continents now real.

---

## 4. MOCK CONSTELLATIONS

Goal: let anyone SEE the constellation experience with zero real users. Ship static sample data + a public demo route that renders with the EXISTING `ConstellationRead` shape and the SAME visual language as `/constellations/[id]`.

### 4.1 Sample data file — `src/lib/sample-constellations.ts`
Three believable constellations. Member archetypes map to the framework gift ids (`weaver healer builder steward storyteller protocol-smith convener way-shower` …). Each constellation has members + one `ConstellationRead` matching `src/lib/types.ts`.

```ts
import type { ConstellationRead } from "@/lib/types";

export type SampleMember = {
  name: string;
  archetype: string;     // e.g. "The Weaver"
  giftId: string;        // framework gift id
  blurb: string;         // one warm sentence
  placements?: string;   // tiny mono detail e.g. "Sun ♎ · Generator · 19/49"
};
export type SampleConstellation = {
  slug: string;
  name: string;
  tagline: string;
  members: SampleMember[];
  read: ConstellationRead;
};

export const SAMPLE_CONSTELLATIONS: SampleConstellation[] = [
  {
    slug: "cascadia-weavers",
    name: "Cascadia Weavers",
    tagline: "A watershed cell turning a flooded valley into a learning commons.",
    members: [
      { name: "Maren",  archetype: "The Weaver",        giftId: "weaver",        blurb: "Holds the threads between the land trust, the school, and the elders.", placements: "Sun ♎ · 7th house · Generator · 19/49" },
      { name: "Tomas",  archetype: "The Builder",       giftId: "builder",       blurb: "Turns consensus into standing structures and repaired pumps.",        placements: "Sun ♑ · Mfg-Generator · defined Sacral" },
      { name: "Priya",  archetype: "The Healer",        giftId: "healer",        blurb: "Tends the grief of a changed river so the work stays human.",          placements: "Chiron rising · 12th house · emotional authority" },
      { name: "Wren",   archetype: "The Storyteller",   giftId: "storyteller",   blurb: "Keeps the valley's memory and tells its next chapter out loud.",       placements: "Mercury ♐ · defined Throat · 25th gift" },
      { name: "Diego",  archetype: "The Protocol-smith",giftId: "protocol-smith",blurb: "Open-sources the gauge data so the next watershed can fork it.",       placements: "Sun ♒ · defined Ajna · 4/49" },
    ],
    read: {
      collective_gifts: [
        "A complete loop: grief tended, story kept, structures built, code shared.",
        "Relational gravity (Maren) paired with the will to ship (Tomas).",
        "Memory and protocol together — the valley can both remember and replicate.",
      ],
      complementarities: [
        "Maren's weaving gives Tomas's building a living mandate instead of a brief.",
        "Priya's pacing keeps Diego's protocols humane rather than merely efficient.",
        "Wren's story turns Tomas's pump repairs into something people show up for.",
      ],
      frictions: [
        "Tomas wants to ship; Priya wants to feel — name the tempo out loud each week.",
        "Diego abstracts to protocol; Wren particularizes to story. Let them edit each other.",
      ],
      gaps: [
        "No clear Steward of money/land tenure — funding may drift.",
        "No outward Convener; the cell is strong inside, quiet to the wider region.",
      ],
      make_explicit: [
        "Who decides when 'good enough to ship' overrides 'not yet grieved'?",
        "Name a treasury steward before the next grant lands.",
      ],
      pairwise: [
        { a: "Maren", b: "Tomas", dynamic: "Mandate-giver and maker — the spine of the cell. Watch that Maren doesn't carry Tomas's emotional load." },
        { a: "Priya", b: "Diego", dynamic: "Slow body, fast mind. Their friction, if honored, is the group's wisdom dial." },
        { a: "Wren",  b: "Diego", dynamic: "Story and schema describing the same river. Pair them on the public field guide." },
      ],
      weaving_guidance:
        "You are nearly a closed regenerative loop; your missing piece is outward and fiscal, not relational. Recruit a Steward and let Maren step back from holding-everyone so her own thread can grow. Make tempo a standing agenda item.",
      narrative:
        "Cascadia Weavers reads as a rare thing: a cell that already metabolizes both feeling and function. Maren is the relational field everyone else stands in; Tomas converts that trust into things that hold water — literally. Priya keeps the work from outrunning the people, and Wren makes sure the valley can tell itself what it is becoming. Diego quietly future-proofs all of it by giving the data away.\n\nThe risk is not collapse but enclosure: you could become so complete you forget the wider bioregion. Your growth edge is a Steward who holds tenure and treasury, and a Convener who carries your story over the ridgeline.",
      meta: { engine: "sample", framework_version: "0.0.0-stub" },
    },
  },
  {
    slug: "mutual-credit-guild",
    name: "The Mutual-Credit Guild",
    tagline: "Four makers prototyping a bioregional currency in a rustbelt city.",
    members: [
      { name: "Aisha",  archetype: "The Convener",       giftId: "convener",      blurb: "Calls the rooms and keeps the table bigger than any ego at it.",      placements: "Sun ♌ · 1st house · Projector · invitation" },
      { name: "Jonah",  archetype: "The Protocol-smith", giftId: "protocol-smith",blurb: "Designs the credit-clearing rules so trust can scale past friendship.",placements: "Sun ♒ · defined Ajna & Throat" },
      { name: "Lin",    archetype: "The Steward",        giftId: "steward",       blurb: "Guards the float and the commons so circulation stays honest.",       placements: "Saturn strong · Taurus moon · 2nd house" },
      { name: "Bea",    archetype: "The Way-shower",     giftId: "way-shower",    blurb: "Walks two steps ahead and keeps pointing at what's possible.",        placements: "Sun ♐ · 9th house · Manifestor" },
    ],
    read: {
      collective_gifts: [
        "A coordination engine: convened, specced, stewarded, and pointed somewhere.",
        "Strong governance instincts — rules and float are in careful hands.",
      ],
      complementarities: [
        "Aisha fills the room Jonah's protocol then makes fair.",
        "Lin's caution is the brake on Bea's accelerator — together they steer.",
      ],
      frictions: [
        "Bea outpaces the group; Lin slows it. Make the speed limit a shared decision.",
        "Jonah can mistake the spec for the territory — Aisha must keep humans central.",
      ],
      gaps: [
        "No Healer — burnout and conflict have nowhere soft to land.",
        "No Storyteller — the currency may stay legible only to its builders.",
      ],
      make_explicit: [
        "What is the currency actually FOR, in one sentence a stranger understands?",
        "Where does interpersonal repair happen when the guild strains?",
      ],
      pairwise: [
        { a: "Aisha", b: "Bea", dynamic: "Host and scout. Aisha must occasionally rein Bea in without dimming her." },
        { a: "Jonah", b: "Lin", dynamic: "Rules and reserves — the fiscal nervous system. Keep it transparent to the rest." },
      ],
      weaving_guidance:
        "You can build the mechanism; you cannot yet tell its story or tend its wounds. Invite a Storyteller and a Healer before launch — not after the first conflict.",
      narrative:
        "The Mutual-Credit Guild is a governance organism more than a friendship. Aisha's invitation makes the table safe; Jonah's protocols make it scalable; Lin's stewardship keeps it honest; Bea keeps it from settling for the present. It is unusually equipped to actually ship a working currency.\n\nWhat it lacks is interiority and narrative. Without a Healer the first real conflict could fracture trust; without a Storyteller the currency risks staying a tool only its makers love. Recruit for warmth and story now.",
      meta: { engine: "sample", framework_version: "0.0.0-stub" },
    },
  },
  {
    slug: "story-and-soil",
    name: "Story & Soil",
    tagline: "A three-person cultural cell re-mythologizing a peri-urban farm.",
    members: [
      { name: "Noor",  archetype: "The Storyteller", giftId: "storyteller", blurb: "Carries the new-and-ancient story of the land into festival and zine.", placements: "Sun ♊ · defined Throat · 1st house" },
      { name: "Sam",   archetype: "The Steward",     giftId: "steward",     blurb: "Keeps the soil, the seed library, and the calendar of the land.",      placements: "Taurus stellium · Saturn 6th · defined Root" },
      { name: "Kaya",  archetype: "The Weaver",      giftId: "weaver",      blurb: "Threads the artists, farmers, and neighbors into one table.",          placements: "Sun ♎ · Generator · 17/62" },
    ],
    read: {
      collective_gifts: [
        "Story bound to soil — meaning that is literally rooted in a place.",
        "Small enough to move fast, warm enough to draw a crowd.",
      ],
      complementarities: [
        "Sam's groundedness keeps Noor's myth from floating free of the dirt.",
        "Kaya's weaving turns Noor's festivals into lasting relationships.",
      ],
      frictions: [
        "Noor performs meaning; Sam lives it slowly. Honor both clocks.",
      ],
      gaps: [
        "No Builder — beautiful events, fragile infrastructure.",
        "No Protocol-smith — nothing is documented to outlast the founders.",
      ],
      make_explicit: [
        "What happens to the seed library and the story if one of the three leaves?",
      ],
      pairwise: [
        { a: "Noor", b: "Sam", dynamic: "Myth and matter. Their tension is the whole point — keep it generative, not resentful." },
      ],
      weaving_guidance:
        "You are a seed, not yet a structure. Bring in a Builder and document your practices so the magic survives a founder leaving.",
      narrative:
        "Story & Soil is the smallest constellation here and in some ways the most alive: it binds narrative directly to a patch of ground. Noor gives the farm a mythology; Sam keeps that mythology accountable to actual seasons; Kaya makes sure it lives in a community rather than a founder's head.\n\nIts fragility is structural. Without a Builder the infrastructure stays improvised, and without anyone documenting practice, the cell is one departure away from amnesia. Grow roots in process, not just soil.",
      meta: { engine: "sample", framework_version: "0.0.0-stub" },
    },
  },
];

export function getSampleConstellation(slug?: string) {
  if (!slug) return SAMPLE_CONSTELLATIONS[0];
  return SAMPLE_CONSTELLATIONS.find((c) => c.slug === slug) ?? SAMPLE_CONSTELLATIONS[0];
}
```

### 4.2 Demo route — `src/app/constellations/sample/page.tsx`
Public (no auth, no DB). Renders the same layout as `/constellations/[id]`, fed by `SAMPLE_CONSTELLATIONS`. Reuses `DymaxionMap` (pass `names={members.map(m => m.name)}`) and the same `ReadList` / pairwise / weaving-guidance blocks. Add a constellation switcher (the existing single-key nav still works) and a member roster that shows archetype + placements in mono. Wrap the read in `.crt-frame data-title="Fig. C · sample constellation read"`.

Server component shape:
```tsx
import { SAMPLE_CONSTELLATIONS, getSampleConstellation } from "@/lib/sample-constellations";
import { DymaxionMap } from "@/components/DymaxionMap";

export default function SampleConstellationPage({
  searchParams,
}: { searchParams: { c?: string } }) {
  const c = getSampleConstellation(searchParams.c);
  const read = c.read;
  return (
    <div className="max-w-measure pt-10">
      {/* eyebrow "Sample · no real users" + switcher chips linking ?c=slug */}
      {/* member roster: name / archetype (pill) / placements (kv) */}
      {/* <figure class="crt-frame" data-title>…DymaxionMap…</figure> */}
      {/* read.narrative, ReadList x5, pairwise, weaving guidance — copy from [id]/page.tsx */}
    </div>
  );
}
```
Reuse strategy: extract the read-render JSX from `constellations/[id]/page.tsx` into a shared `ConstellationReadView({ read, names })` client/server component so both the real page and the sample page render identically. The `ReadList` helper already exists there — promote it into the shared component.

### 4.3 Surfacing the demo
- Add a `[c] constellations` already exists in `TerminalNav`; add a sub-link or a banner on `/constellations` (and a card on the home page) → "See a sample constellation →" linking `/constellations/sample`.
- On the empty state of `/constellations` ("None yet."), add a `btn-line` → `/constellations/sample` so a brand-new user can preview the experience before inviting anyone.
- Optional home-page demo card under the framework section: a `.crt-frame` teaser with the first sample's name, tagline, and member archetypes.

---

## 5. Build checklist (order of operations)
1. `globals.css`: add new vars (§0), `body::after` scanlines (§1.1), flicker/grain (§1.2), phosphor (§1.3), `.crt-frame/.crt-screen` (§1.4), ASCII rules (§1.5), poster (§1.6), reduced-motion guard (§1.7), transition keyframes (§2.1).
2. `components/PageTransition.tsx` + wrap `<main>` in `layout.tsx` (§2.2).
3. `components/SectionReveal.tsx`; swap `.animate-rise` usages on `page.tsx`, constellation pages (§2.3).
4. Rewrite `components/AsciiEarth.tsx`: keep render loop, drop `LAND` blobs, add `LANDMASK_RUNS` + new `isLand` (§3.3), corrected lat/lon (§3.1), mode-aware tiers (§3.2), terminator shimmer (§3.4). Wrap call site in `.crt-frame`.
5. `lib/sample-constellations.ts` (§4.1); `app/constellations/sample/page.tsx` (§4.2); shared `ConstellationReadView`; surface links (§4.3).
6. Verify both modes; verify `prefers-reduced-motion` kills flicker/grain/transitions and shows a static globe frame.
