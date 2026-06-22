---
title: "EcoDharma — Front-End Design Briefing"
type: design-brief
author: "Benjamin Life (@omniharmonic)"
status: draft
version: 0.1
created: 2026-06-20
audience: "Front-end design agent / implementer"
description: "Art direction and a concrete design-token system for EcoDharma's interface: solarpunk design-science retrofuturism — the Whole Earth Catalog and Buckminster Fuller's patent drawings, brought into a 21st century where design science actually won, warmed by lo-fi ASCII and 60s–70s eco-movement poster craft."
companions:
  - "ecodharma-prd.md"
  - "ecodharma-technical-architecture.md"
  - "ecodharma-implementation-plan.md"
---

# EcoDharma — Front-End Design Briefing

**For the design agent:** this is the art direction and a starting token system. Treat the tokens as a tuned instrument, not a cage — but hold the *north star* and the *anti-brief* as hard constraints. Stack is Next.js + Tailwind; all named typefaces below are open-licensed (OFL) so you can ship without licensing friction. Consult the `frontend-design` skill before building.

---

## 1. North star

> **What if Buckminster Fuller's design-science revolution had actually won — and the interface is the field manual for the regenerative civilization it produced?**

EcoDharma should feel like a **living instrument for whole-systems thinking**: half *Whole Earth Catalog*, half patent application, half solarpunk almanac, rendered with the warmth of a 1970s risograph and the soul of a lo-fi terminal. It is earthy and hand-made *and* technical and precise — a planet's worth of tools, drawn in blueprint ink and printed on manila. It is hopeful without being naive; it carries the revolutionary optimism of the classic environmental movement, not the sterile minimalism of a SaaS dashboard.

The product itself — reading a person through many lenses and mapping their unique gifts into the regenerative transition — *is* a design-science act: it takes the "comprehensive anticipatory design" Fuller dreamed of and applies it to a human life. The interface should make that legible. A person's Gift Profile should feel like **a patent for their own contribution to the world.**

### The lineage (name-check these; characterizations so you don't have to guess)

- **Whole Earth Catalog (1968–72)** — oversized newsprint, dense collaged pages of boxed "articles," "access to tools" ethos, organized by *use* (Whole Systems, Land Use, Shelter, Craft, Community, Nomadics…). Typographically: **Windsor** (a splayed, warm old-style serif) for headings over **Univers** (clean grotesque) for body. Every page different, yet browsable and searchable. *This is our structural and typographic soul.*
- **Buckminster Fuller's patent drawings & Dymaxion work** — geodesic line-work, dimension callouts, numbered figures, the Dymaxion map, tensegrity diagrams. Precise technical draftsmanship as beauty. *This is our diagram language.*
- **Earth Liberation Studio / 60s–70s eco-movement poster art** — hand-drawn, screenprinted, woodcut-edged, slogan-forward, revolutionary-optimist, ecosocialist. Riso inks, halftone grit, the warmth of the human hand. *This is our texture and emotional register.* (Reference the lineage, not any specific living artist's piece.)
- **Lo-fi terminal / ASCII demoscene** — the rotating ASCII globe, monospace data readouts, the charm of constraint. *This is our signature soul (see §5).*

---

## 2. The anti-brief (avoid)

These would kill it:

- **The default "AI earthy" look:** warm cream `#F4F1EA` + high-contrast serif + lone terracotta accent. Our paper is *manila/newsprint*, not cream; our reds are *oxblood/brick*, not terracotta; and the palette is multi-ink riso, not a single accent.
- **Clichéd "eco" signifiers:** leaf icons, gradient greens, recycling arrows, generic "sustainability" stock aesthetics.
- **Wellness-app softness:** rounded blobs, pastel gradients, floating 3D orbs, breathy minimalism.
- **Crypto/SaaS techno-futurism:** neon-on-black, glassmorphism, grid-of-glowing-cards.
- **Mysticism kitsch:** purple galaxies, glowing mandalas, zodiac-glyph soup. We are *mythopoetic, not astrology.com.* Restrain the cosmic.

When an axis is left free, do not spend that freedom on any of the above.

---

## 3. Design tokens

### 3.1 Color — two modes, one world

Build **both** modes; they're not light/dark toggles of the same skin, they're two printings of the same press.

**MODE A — "Newsprint" (default / day):** manila catalog paper, printing-ink text, riso accents.

```
--paper    #E4DCC6   /* aged manila newsprint — warm, dull, NOT cream */
--ink      #1A1C16   /* warm near-black printing ink (never pure #000) */
--solar    #E8A13A   /* marigold/solar amber — the sun, primary accent */
--pine     #1F4733   /* deep living green — growth, solarpunk, structure */
--ferro    #18556E   /* ferro-blueprint blue — diagram line-work, links */
--clay     #B5482E   /* oxblood/brick — revolutionary red, used sparingly */
```

**MODE B — "Blueprint" (night / deep-work):** the patent plotted on cyanotype.

```
--bg       #0C2A2E   /* deep ferro teal-black (cyanotype ground) */
--line     #4FA3B8   /* cyan hairline — drafting lines, structure */
--chalk    #DCE8E0   /* pale chalk text */
--solar    #E8A13A   /* same solar amber carries across modes */
--phosphor #9BE8B0   /* phosphor-green — live data, highlights */
```

**Usage discipline:** `solar` is the one warm constant across modes — the sun never changes. Greens and ferro-blue do the structural/quiet work; `clay` is rare and load-bearing (a single revolutionary punctuation, never a fill). Color should read as *limited-run screenprint*: 3–4 inks per view, knockouts and overprints rather than gradients.

### 3.2 Typography — three voices

All OFL / free. Named "spiritual reference" = the historical face we're evoking (license it later if you want the real thing).

| Role | Face (ship this) | Evokes | Use |
|---|---|---|---|
| **Display** | **Fraunces** (high `SOFT`/`WONK` axes) | Windsor / WEC cover | Headlines, section titles, the one big statement per screen. Wonky, warm, human. Use with restraint. |
| **Text / UI** | **Archivo** (grotesque) | Univers / International Typographic Style | Body, controls, navigation. Rational, calm, mid-century-modern backbone. |
| **Technical / mono** | **IBM Plex Mono** | Patent labels, drafting annotations, teletype | Data, figure numbers, eyebrows, callouts, metadata, and the ASCII art. The "design-science" workhorse. |

- **Treatment:** lean on the **mono** for structure — uppercase tracked labels (`FIG. 03 · WHOLE SYSTEMS`), dimension-line annotations, key/value data readouts. This is what makes it read "patent/Catalog" rather than "blog."
- **Scale:** set a deliberate type scale with real jumps (e.g. 0.75 / 0.875 / 1 / 1.5 / 2.5 / 4rem). Display sizes earn the Fraunces wonk; small sizes stay rational.
- *(Optional flavor: **Space Mono** specifically for the ASCII Earth if you want extra lo-fi grit — but don't add a fourth functional face. Chanel rule: remove one accessory.)*

### 3.3 Layout & structure — Catalog collage meets drafting table

- **Modular, boxed, collaged.** Channel the WEC: content lives in **boxed cells with hairline rules and softly rounded corners**, arranged on a visible modular grid. Pages can feel *assembled* — different cell sizes, a browsable density — without becoming chaotic.
- **The grid is visible and honest.** Show structure: thin rules, registration marks, a baseline you can feel. Structure *is* information here.
- **Patent/diagram annotation is a real device, not decoration.** Numbered **figure callouts** (`FIG. 1`), **dimension lines**, **leader lines** pointing from a label to a part of a diagram — these *encode meaning* (this is a design-science manual), so they pass the "is the numbering真 meaningful?" test. Use them where there's an actual diagram (the Profile, the Constellation).
- **Eyebrows & section names** borrow the Catalog's use-based taxonomy energy: `ACCESS TO GIFTS`, `WHOLE SYSTEMS`, `THE KINSHIP JOURNEY`.

### 3.4 Texture & material

- **Riso/screenprint grain + halftone.** A subtle paper tooth and halftone dot texture (especially on `solar`/`clay` fills) gives the human-hand warmth. Keep it tasteful — a whisper, not a filter.
- **Blueprint line-work** in Mode B: cyan hairlines, drafting cross-hatch, grid.
- **Overprint / knockout** instead of drop shadows and gradients. Where two inks meet, let them feel slightly mis-registered — the charm of the press.

### 3.5 Iconography & illustration

- **Technical line-drawing**, single-weight, like patent figures or field-guide plates. Geodesic, tensegrity, watershed, mycelial, orbital motifs — drawn as *diagrams*, not icons.
- Where illustration is richer, evoke **woodcut / linocut poster** edges (the eco-movement lineage), not flat vector blobs.
- No emoji, no rounded "friendly" icon sets.

### 3.6 Motion

Spend it deliberately (the skill warns scattered effects read as AI-generated):

- **Draw-on linework.** Blueprint diagrams and leader lines *plot themselves* on load (SVG `stroke-dashoffset`), like a pen drafting them. This is the core motion idiom.
- **The rotating ASCII Earth** (§5) — the one ambient, always-alive element.
- **Hover = drafting pen:** crisp, mechanical micro-interactions; a label's leader line extends, a cell's rule thickens. No bounce, no float.
- **Respect `prefers-reduced-motion`:** Earth holds a still frame; lines appear drawn.

---

## 4. The signature element — the ASCII Earth 🜨

> Per the skill: spend your boldness in one place and let everything else stay quiet. **This is that place.**

A **slowly rotating globe rendered in monospace ASCII** — a lo-fi, telnet-era Whole Earth, continents drifting in characters. It is the emblem, the loading state, and the substrate of the constellation map, all at once.

- **Hero:** on the landing/entry screen, the ASCII Earth turns at the center — the literal "whole earth," the Catalog cover reincarnated as living text. The single Fraunces statement sits beside it; everything else is mono and quiet.
- **The compute moment:** while a person's charts are being calculated and interpreted, the Earth turns and mono readouts tick (`COMPUTING WESTERN CHART…`, `DERIVING GENE-KEY SEQUENCES…`) — turning unavoidable latency into the most on-brand moment in the app.
- **The constellation substrate:** in the Constellation view, the same Earth becomes the ground on which collaborators appear as plotted points/nodes in a geodesic network — a Dymaxion social map.

**Implementation direction:** render to a `<pre>` of monospace glyphs updated on `requestAnimationFrame` (a classic rotating-ASCII-globe routine: sample a sphere, project to character cells, shade by a ramp like `.:-=+*#%@`). Keep it performant and `reduced-motion`-aware (serve a static frame). It should feel *computed*, not video — the realness is the point. Color the glyphs in `pine`/`ferro` (Newsprint) or `phosphor`/`line` (Blueprint), with `solar` for the terminator/sunlit edge.

---

## 5. Surface-by-surface direction

**Onboarding / birth data** — a **field-guide intake form**. Mono labels, drafting-style inputs, a small diagram of "what we read and why." The unknown-birth-time path is handled with honesty and warmth (a callout, not an error): explain plainly what becomes uncertain.

**The reading/compute moment** — the ASCII Earth + mono readouts (§4). Make the wait feel like instrumentation coming online.

**The Gift Profile — "a patent for your contribution."** This is the showpiece. Lay it out like a **patent sheet / Dymaxion data plate**: a titled figure (the person as a diagram — gifts as labeled parts with leader lines), then boxed Catalog-style cells for *Unique Gifts*, *Domains*, *Trim-Tabs* (each a numbered "figure" with its upward-spiral logic drawn as a small feedback-loop diagram), *Shadow*, and the EcoDharma-voice *Narrative* set in readable Archivo with a Fraunces opening line. Solar amber marks the live, load-bearing insights.

**The Constellation** — a **geodesic social diagram** over the ASCII Earth. People are plotted nodes; complementarities and frictions are drawn as labeled connection lines (think synastry-as-drafting). The 1:many read is a field-guide spread: collective gifts, gaps, "what to make explicit." Consent state is visible and dignified (a node only appears once it has opted in).

**Navigation / app shell** — quiet, mono, like a catalog's running header: section name, figure/page metadata, registration marks. Let the content cells carry the personality; keep the chrome disciplined.

---

## 6. Microcopy & voice in the UI

Two registers, kept distinct:

- **Functional controls** follow the writing rules: plain, active, end-user-side. "Compute my readings," not "Submit." The button that says "Compose constellation" produces "Constellation composed." Errors state what happened and how to fix it, in the interface's voice — never vague, never apologizing.
- **Atmospheric copy** (section eyebrows, empty states, the compute readouts, the Profile narrative) carries the **EcoDharma voice** — relational, deep-but-not-preachy, a fellow traveler (per PRD §9). Empty states are invitations to act, phrased in that voice. Let the Catalog's "access to tools" spirit flavor the labels (`ACCESS TO GIFTS`, `THE WORK THAT IS ONLY YOURS`).

Keep the two from bleeding: a label labels; the narrative sings.

---

## 7. Accessibility & quality floor

Non-negotiable, built in quietly: WCAG AA contrast in **both** modes (watch `solar`-on-`paper` and `line`-on-`bg`); visible keyboard focus styled *as a drafting bracket*, not a default ring; `prefers-reduced-motion` honored everywhere (Earth and draw-on lines degrade gracefully); responsive from 360px up — the Catalog collage reflows to a single honest column on mobile, the Earth scales down to an emblem; screen-reader text for the ASCII art and all diagrams.

---

## 8. Implementation notes (Next.js + Tailwind)

- **Fonts:** load via `next/font/google` (Fraunces, Archivo, IBM Plex Mono); expose as CSS variables; subset for performance. Fraunces: use the optical/`SOFT`/`WONK` axes at display sizes only.
- **Tokens → Tailwind theme:**

```js
// tailwind.config — design tokens (Newsprint defaults; Blueprint via .mode-blueprint)
theme: {
  extend: {
    colors: {
      paper:'#E4DCC6', ink:'#1A1C16', solar:'#E8A13A',
      pine:'#1F4733', ferro:'#18556E', clay:'#B5482E',
      bp: { bg:'#0C2A2E', line:'#4FA3B8', chalk:'#DCE8E0', phosphor:'#9BE8B0' },
    },
    fontFamily: {
      display: ['var(--font-fraunces)','serif'],
      sans:    ['var(--font-archivo)','system-ui','sans-serif'],
      mono:    ['var(--font-plex-mono)','ui-monospace','monospace'],
    },
    borderRadius: { cell: '6px' },            // WEC soft-cornered boxes
  },
}
```

- **Blueprint draw-on lines (idiom sample):**

```css
.draft-line { stroke: theme(colors.ferro); stroke-width: 1;
  stroke-dasharray: 1000; stroke-dashoffset: 1000;
  animation: draft 1.2s ease-out forwards; }
@keyframes draft { to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) {
  .draft-line { animation: none; stroke-dashoffset: 0; } }
```

- **ASCII Earth:** a self-contained client component rendering to `<pre>` on `requestAnimationFrame`; pause off-screen (IntersectionObserver) and under reduced-motion. Keep it under control on the main thread; consider an offscreen canvas if needed.
- **Texture:** ship grain/halftone as a tiny tiling PNG or SVG `feTurbulence` overlay at low opacity; never let it hurt contrast or performance.
- **No browser-storage of sensitive data client-side** (consistent with the architecture's privacy posture).

---

## 9. First thing to prototype

Before any full page: build the **hero with the rotating ASCII Earth + one Fraunces statement + mono readout**, in **both** Newsprint and Blueprint modes. If that single screen makes you feel like you've opened a 21st-century Whole Earth Catalog that someone drafted by hand on a drafting table lit by the sun — the direction is right, and everything else follows from it. Show that screen first.

**Deliverables:** the two-mode hero (above), then the design-token implementation, then the Gift Profile "patent sheet" as the second proving surface.

---

*Authored with and for Benjamin Life (@omniharmonic). Offered toward the commons.*
