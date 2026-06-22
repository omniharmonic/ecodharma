# EcoDharma — Visual Deepening Spec: "Solarpunk Terminal / Drafting Table"

## 1. Aesthetic thesis (refined)

EcoDharma is a **field terminal for whole-systems thinking**: a big, quiet sheet of drafting vellum (day) or cyanotype (night), drawn in hairlines and ASCII, operated by keyboard. We move decisively away from the dense boxed-card catalog toward an **open canvas governed by rules, registration, and silence** — Fuller's drafting table, not a content site. Boldness is rationed to one move per screen (a mega-Fraunces statement, the ASCII Earth, or a Dymaxion net) while everything else stays mono, hairline, and calm. The press still runs three inks; it just prints far more white space between them.

This *evolves* the brief's "modular, boxed, collaged" mandate (which the brief itself licenses: "tokens as a tuned instrument, not a cage") while holding the **anti-brief as a hard wall**: the new light mode is cool engineering *vellum*, explicitly NOT warm AI-cream, NOT a wellness content site — the exact failure mode the anti-brief names.

---

## 2. Token revisions

### 2.1 Light mode — re-spec as "DRAFTING TABLE" (was warm "Newsprint")

The current `--paper #E4DCC6` reads as warm manila content-paper. Re-ink it to cool drafting vellum + ferro/ink linework. Concrete RGB-triplet values (matching the existing `rgb(var() / a)` setup):

```css
:root {                       /* DRAFTING TABLE (day) */
  --bg:      237 238 231;     /* #EDEEE7 cool vellum — the open sheet (brightest) */
  --surface: 230 231 223;     /* #E6E7DF faintly recessed inset (RARE) */
  --fg:      21 25 27;        /* #15191B cool graphite ink (NOT warm #1A1C16) */
  --muted:   84 91 97;        /* #545B61 cool slate — AA at body sizes (~5.3:1) */
  --rule:    21 25 27;        /* ink hairline, used at low alpha (0.18–0.30) */
  --ferro:   20 91 121;       /* #145B79 deepened blueprint blue — links, AA (~6:1) */
  --accent:  232 161 58;      /* #E8A13A SOLAR — the one constant, FILLS/large only */
  --solar-ink: 154 106 30;    /* #9A6A1E darkened marigold for small warm TEXT (AA) */
  --live:    28 74 54;        /* #1C4A36 deep pine — structure/live data (AA ~7:1) */
  --flag:    168 65 42;       /* #A8412A deepened oxblood — rare, AA (~5.4:1) */
  color-scheme: light;
}
```

**Why cooler is still on-brief:** the anti-brief forbids *warm cream wellness* (`#F4F1EA` + lone terracotta). Cool blue-gray vellum + ferro ink + multi-ink riso is the opposite register — engineering paper, not a content site. Keep the paper tooth, drop the warmth.

**Contrast notes (WCAG AA):**
- `--fg` on `--bg`: ~13:1 — AAA.
- `--muted` on `--bg`: ~5.3:1 — AA body. (Current warm `--muted` was borderline; this fixes it.)
- `--ferro` link on `--bg`: ~6:1 — AA.
- **`--solar` on `--bg` ≈ 1.9:1 — FAILS.** Discipline: solar is for fills, dimension ticks, the sunlit limb, and ≥`fig` display weight only. For small warm emphasis text use `--solar-ink` (#9A6A1E ~4.6:1) or `--flag`.
- `--flag` / `--live` text on `--bg`: AA.

### 2.2 Dark mode — keep "Blueprint" teal, push minimalism

Values stay essentially as-is (they're liked); only deepen the ground slightly and demote `--surface` so cells stop reading as boxes:

```css
.mode-blueprint {             /* BLUEPRINT (night) */
  --bg:      10 39 43;        /* #0A272B a hair deeper/cleaner than #0C2A2E */
  --surface: 13 46 50;        /* #0D2E32 used ONLY for the one plate per screen */
  --fg:      220 232 224;     /* #DCE8E0 chalk (keep) */
  --muted:   142 178 178;     /* #8EB2B2 dim cyan — nudged up for AA (~4.6:1) */
  --rule:    79 163 184;      /* #4FA3B8 cyan hairline (keep) */
  --ferro:   79 163 184;
  --accent:  232 161 58;      /* solar carries across */
  --live:    155 232 176;     /* #9BE8B0 phosphor */
  --flag:    214 104 78;
  color-scheme: dark;
}
```
Push: in Blueprint, structure is *cyan hairline + space*, never lifted teal boxes. Reserve `--surface` for the single titleblock/instrument plate.

### 2.3 Type scale — bigger jumps, one mega for the hero

Keep Fraunces / Archivo / IBM Plex Mono. Re-cut the scale so the single statement per screen earns enormous size and small sizes stay rational:

```
2xs  0.6875rem  (mono labels, eyebrows, figs)
xs   0.75rem
sm   0.875rem
base 1rem        (Archivo body, measure capped ~66ch)
lg   1.125rem
fig  1.5rem      (sub-statements, domain titles)
title 3rem       (was 2.5 — section statements)
hero  clamp(3rem, 7vw, 5.5rem)
mega  clamp(3.5rem, 11vw, 8rem)   /* the ONE hero statement, Fraunces SOFT/WONK */
```
Display sizes get `line-height: 0.95–1.0` and tight tracking; mega uses Fraunces high `WONK`. Body Archivo stays ~1.6 line-height. Mono labels keep `0.18em` tracking.

### 2.4 Spacing / rhythm — felt baseline grid, larger silences

- **8px baseline grid.** All vertical rhythm in multiples of 8.
- **Section spacing scale:** `8 / 16 / 24 / 40 / 64 / 96 / 160`. Default gap between major sections jumps to `--space-7` (96px) on desktop (currently `space-y-12` ≈ 48px). Silence is the primary separator.
- **Page gutters:** widen to `clamp(20px, 6vw, 96px)`; cap text measure at ~66ch even though the canvas is wide — wide margins are the drafting-table feel.
- **Left "schedule margin":** reserve a fixed left column (~`8ch` mono) across content pages for figure numbers / dimension callouts, like a drawing's title strip.

### 2.5 Radius & rules — sharpen

- `--radius-edge: 0` (default — square drafting corners).
- `--radius-soft: 2px` (inputs only).
- **Retire `borderRadius.cell: 6px`** as the default; the WEC "soft-cornered box" is no longer the primary container.
- **Rule weights:** hairline `1px` at alpha 0.18–0.30 (`--rule`); a structural "register rule" `1px` solid ferro; emphasis rule `2px` ink, used once.

### 2.6 Decision rule — space vs rule vs box

1. **Pure space** = default. Relationship implied by alignment to the grid. Use first, always.
2. **Hairline rule** = when alignment alone won't register a relationship: under an eyebrow, between schedule rows, dividing a two-column spread, as a baseline/dimension tick.
3. **Box / framed plate** = RARE, max **one per screen**. Reserved for genuine "instrument plates": the ASCII Earth figure, the patent titleblock, the Dymaxion map frame. A box now means "this is a drawing on the sheet," not "this is a card."

---

## 3. Layout & navigation system

### 3.1 The terminal / keyboard model

A real keyboard-first model layered over fully working mouse + links (progressive enhancement; nothing keyboard-only).

**Command palette — `Cmd/Ctrl-K` (or `/`)**
- Opens a mono overlay: a single `> ` prompt on a vellum/cyanotype sheet, caret blinking. Fuzzy-filter over routes + actions ("compute my reading", "re-draft profile", "compose constellation", "toggle blueprint"). `↑/↓` to move, `Enter` to run, `Esc` to close. This is the primary nav for power users and the on-brand "terminal" centerpiece.

**Single-key "go" rail (the press-a-key nav)**
- A persistent quiet rail (in the running header, mirrored at page foot): `[p] profile  [c] constellations  [w] work  [u] curate  [d] data  [k] ⌘palette  [?] keys`.
- Letters are the bracketed initial; pressing the key navigates **only when focus is on `<body>`** (never while typing in an input). Implemented as `keydown` with an `isEditableTarget()` guard.
- Optional vim chord `g` then letter (`g p`) as a collision-proof alias; document both.

**In-page focus movement**
- `j / k` (and `↑ / ↓`) move focus between **schedule rows / figures**; `Enter` activates the row's primary link; `h/l` or `←/→` page between profile sections. All rows are real `<a>`/`<button>` in tab order; j/k just accelerate.
- `?` opens a keyboard-shortcut overlay (drawn as a patent legend). `Esc` universally closes/clears.

**Focus = drafting bracket (not a ring)**
Replace the solid solar outline with corner brackets — `⌐ ¬ / L ⌐` rendered via two layered `box-shadow` insets or `::before/::after` corner marks in `--accent`, offset 3px. Reads as a draftsman bracketing a part. Must remain ≥3:1 against both grounds (solar brackets clear AA-UI on both).

Accessibility floor: every shortcut maps to a visible, focusable control; shortcuts are additive; `?` documents them; `prefers-reduced-motion` honored; SR text on all ASCII/diagrams.

### 3.2 Page archetypes (minimal & expansive)

**Hero** — full-bleed open vellum, one bold move.
- Left/center: ASCII Earth, **larger** (≈64×34) as the living emblem. Right/below: the **mega Fraunces statement** with enormous silence around it (no card). One mono readout line beneath (`> comprehensive anticipatory design · ONLINE`). A single `btn-solar` primary action.
- Kill the 3-cell stat box grid → replace with **one inline dimension line** in mono: `⊢ 7 domains · 24 gifts · 60+ trim-tabs ⊣`, hairline-ruled, no boxes.
- Command rail sits quietly at the bottom edge.

**Profile (patent sheet)** — schedule/parts-list, not card grid.
- One framed **titleblock plate** (holder / filed / framework / voice) — the screen's single box.
- **Fig. 1 person-as-diagram** drawn large in linework with draw-on leader-line labels (the bold element).
- **Narrative** as a single wide column, Fraunces lede + Archivo at ~66ch measure, big top/bottom silence.
- **Gifts / Domains / Trim-tabs / Shadow** become **ruled rows**, not `.cell` cards: figure number in the left schedule margin (mono), content in the measure column, dimension/leader annotation in the right margin, a hairline between rows. One row may carry a solar dimension tick (the live insight). This converts ~5 card grids into one continuous, navigable drawing.

**List (constellations / work)** — a "register."
- A mono index table: hairline row rules, columns (`node · domain · resonance`), `j/k` navigable, small inline linework glyph per node. The **Dymaxion map** above is the bold element; the register below is quiet.

---

## 4. Component direction

**Strip:**
- Demote `.cell`: it should no longer wrap most content. Introduce `.row` (content + `border-bottom: 1px var(--rule)/0.2`, generous `py`) as the new default container, and `.plate` (the rare framed instrument: 1px ferro border, square corners, `--surface`) used once per screen.
- Drop `cell-solar` tint fills as a general device; solar becomes a **marginal mark** (dimension tick, leader dot, sunlit limb) and at most one fill per screen.
- Pills → mono inline tags separated by `·` middots, or small ticked labels; remove `rounded-full`.
- Inputs → **drafting underline** style: transparent bg, `border-bottom: 1px var(--rule)`, label as mono eyebrow above; focus thickens the underline to ferro. (Retire full-boxed `.input`.)

**Make bolder (sparingly):**
- The mega-Fraunces statement (one per screen, huge silence).
- The ASCII Earth (bigger, more present).
- One woodcut/poster-weight moment per key screen — e.g. a solar riso knockout on the hero verb or the patent titleblock seal.
- Fuller line-work as *real structure*: dimension lines that actually annotate, leader lines that point at real parts, the geodesic net.

**Keep (load-bearing patent devices):** eyebrows (`ACCESS TO GIFTS`), `fig` labels, `kv` readouts, draw-on lines. These are what make it read "patent/terminal," not "blog."

**Buttons:** sharpen to square; `btn-solar` reserved for the single primary action per screen; demote `btn-line` to a bracketed mono text-link (`[ open field manual ]`) for secondary actions to reduce filled chrome.

---

## 5. Signature elements

**ASCII Earth — use more, register linework over it.**
- Three roles, escalating: hero emblem (large) → **compute moment** (near-full-screen Earth + ticking mono readouts: `COMPUTING WESTERN CHART…`, `DERIVING GENE-KEY SEQUENCES…`) → **constellation substrate** (the ground for plotted nodes).
- Overlay a faint **SVG great-circle / geodesic graticule** registered to the globe, drawn-on via `stroke-dashoffset`. Glyph color stays `pine`/`ferro` (day), `phosphor`/`line` (night), `solar` terminator. Keep the existing rAF/IntersectionObserver/reduced-motion implementation; just scale `cols/rows` up and add the SVG layer.

**Dymaxion constellation map.**
- Build Fuller's **icosahedral Dymaxion net** as a static SVG: the ~20 unfolded triangular faces as hairline paths (`--rule`/ferro), simplified coastlines inside, drawn-on on load via `.draft-line`. This is the constellation screen's bold element, framed in one `.plate`.
- **Nodes** = consenting people, placed by mapping lon/lat → triangle-face barycentric coords (or, v1, a precomputed static layout per face). Each node is a small linework glyph, **focusable + `j/k` navigable**.
- **Edges** = complementarity/friction drawn as **labeled leader lines** (synastry-as-drafting): solid ferro for resonance, dashed clay for friction, each with a tiny mono label. Consent-gated: a node renders only after opt-in.

**Riso halftone — CSS/SVG, fills only.**
- Add a reusable `.riso-solar` / `.riso-clay`: base ink fill + a **halftone dot layer** (`background-image` of a tiled SVG dot pattern, or `radial-gradient(circle, ink 0 1px, transparent 1px) 0 0 / 4px 4px`, `mix-blend-mode: multiply`, low opacity) + a **1px misregistration offset** (a second ink layer nudged 1px via `text-shadow`/pseudo) for the overprint charm.
- Apply only to: the hero verb knockout, the patent titleblock seal, and solar dimension ticks. Never on text needing AA, never as a full-page filter. Reuse the existing `feTurbulence` body tooth for paper grain; the dot-screen is additive on fills only.

**Motion budget (deliberate, ~one sequence per screen + Earth):**
- **Draw-on linework** (the core idiom): Dymaxion net, leader lines, the Fig.1 figure, register rules plot themselves via `stroke-dashoffset` on load/scroll-in.
- **ASCII Earth** rotation = the one ambient always-alive element.
- **Hover = drafting pen:** leader line extends, a rule thickens, the focus bracket snaps in. No bounce, no float, no parallax, no scattered fades.
- **Command palette:** instant open, mono caret blink only.
- `prefers-reduced-motion`: Earth holds a frame, all lines render pre-drawn (already wired via `.draft-line` / `animate-rise` guards).

---

## 6. Prioritized implementation checklist (highest impact first)

1. **Re-ink light mode to Drafting Table** — swap `:root` tokens in `globals.css` (§2.1), add `--solar-ink`; update `viewport.themeColor` to `#EDEEE7`. Highest visual payoff, lowest effort.
2. **Sharpen radius + retire default boxes** — set radius to 0/2px; add `.row` and `.plate` component classes; keep `.cell` only as alias for `.plate`. (Tailwind `borderRadius.cell → 2px`.)
3. **Expand the spacing scale & measure** — bump section rhythm to 64–96px, add the left schedule margin, cap measure at 66ch (§2.4).
4. **Rebuild the hero** (`page.tsx`) — mega Fraunces statement + larger ASCII Earth + single mono readout + inline dimension-line stats (delete the 3-cell box grid); one `btn-solar`.
5. **Drafting-bracket focus + keyboard nav core** — corner-bracket `:focus-visible`; a small client `KeyboardNav` provider handling single-key go, `g`-chords, `j/k`, `?`, with `isEditableTarget()` guard.
6. **Command palette** (`Cmd/Ctrl-K`) — mono overlay over routes + server actions; the terminal centerpiece.
7. **Convert Profile to a schedule** (`profile/page.tsx`) — titleblock as the one `.plate`; gifts/domains/trim-tabs/shadow → ruled rows with margin figure numbers; widen narrative.
8. **Bump the type scale** (`tailwind.config.ts`) — add `mega`, raise `title` to 3rem, clamp `hero`.
9. **ASCII Earth scale-up + geodesic SVG overlay** — larger grid, draw-on graticule layer.
10. **Dymaxion constellation map** — SVG icosahedral net + draw-on + focusable nodes + labeled leader edges; consent-gated.
11. **Riso halftone utilities** — `.riso-solar`/`.riso-clay` dot-screen + misregistration; apply to hero verb + titleblock seal only.
12. **Strip remaining chrome** — pills→mono tags, inputs→underline, demote `btn-line` to bracketed text-links; audit every screen for "one bold thing, everything else quiet."

---

## Files this targets
- Tokens/components: `/Users/benjaminlife/iCloud Drive (Archive)/Documents/cursor projects/ecodharma/apps/web/src/app/globals.css`
- Theme/scale/radius: `/Users/benjaminlife/iCloud Drive (Archive)/Documents/cursor projects/ecodharma/apps/web/tailwind.config.ts`
- Shell/nav + command rail + `themeColor`: `/Users/benjaminlife/iCloud Drive (Archive)/Documents/cursor projects/ecodharma/apps/web/src/app/layout.tsx`
- Hero rebuild: `/Users/benjaminlife/iCloud Drive (Archive)/Documents/cursor projects/ecodharma/apps/web/src/app/page.tsx`
- Profile→schedule: `/Users/benjaminlife/iCloud Drive (Archive)/Documents/cursor projects/ecodharma/apps/web/src/app/profile/page.tsx`
- Earth + geodesic overlay: `/Users/benjaminlife/iCloud Drive (Archive)/Documents/cursor projects/ecodharma/apps/web/src/components/AsciiEarth.tsx`
- New: `KeyboardNav` provider + `CommandPalette` + `DymaxionMap` components under `/Users/benjaminlife/iCloud Drive (Archive)/Documents/cursor projects/ecodharma/apps/web/src/components/`

Constraint check: honors north star (Fuller/WEC/solarpunk terminal), respects the anti-brief (cool vellum, not AI-cream; oxblood not terracotta; multi-ink, no eco clichés/glassmorphism), keeps AA in both modes, and spends boldness in ≤1 place per screen per the frontend-design ethos.