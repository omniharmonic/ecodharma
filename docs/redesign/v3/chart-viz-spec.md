# EcoDharma v3 — Chart Visualization Spec

Build specs for three dependency-free React/SVG components that **draw the real
charts** in the ancient-future / blueprint aesthetic, with an **interpretive
layer** integrated (readable, never overwhelming):

- **(A) `NatalWheel`** — astrological natal wheel (works for both `western` and `vedic`)
- **(B) `BodyGraph`** — Human Design bodygraph
- **(C) `GeneKeysViz`** — the three Gene Keys sequences as a hologenetic constellation

All three: **pure SVG + React only. No new deps. No canvas, no WebGL.** Server-
renderable by default (no hooks in the core render); optional interactivity lives
in a thin `"use client"` wrapper. Mode-aware purely through CSS custom properties.
Reduced-motion safe by reusing the existing `.draft-line` draw-on (already guarded
in `globals.css`) and never running continuous animation.

File locations (new):
- `src/components/charts/NatalWheel.tsx`
- `src/components/charts/BodyGraph.tsx`
- `src/components/charts/GeneKeysViz.tsx`
- `src/components/charts/chartGeometry.ts` (shared constants: glyph maps, HD layout, GK layout)
- `src/components/charts/types.ts` (chart raw_json shapes + `ChartThread`)

---

## 0. Shared conventions (read first)

### 0.1 Color / mode tokens (NEVER hardcode hex)
Every stroke/fill uses `rgb(var(--token) / <alpha>)` or a Tailwind class that maps
to one. This is the only thing that makes the components mode-aware (light vellum
↔ `.mode-blueprint` cyanotype). Token roles, reused exactly as the rest of the app:

- `--rule` — hairline structure (rings, cusps, center outlines, net). Use at low alpha (`0.15`–`0.4`).
- `--fg` — primary glyph/label ink.
- `--muted` — secondary labels (house numbers, degrees, NODE tags).
- `--accent` (SOLAR amber) — the live/highlighted element, defined HD centers, Activation sequence, conjunctions.
- `--live` (phosphor/pine) — trines, "harmony" aspects, Pearl sequence, resonance.
- `--link` (ferro) — sextiles, Venus sequence, structural spines.
- `--flag` (oxblood) — squares & oppositions (tension aspects), shadow-toned annotations. RARE, load-bearing.
- `--bg` — used as a 2.5–3px stroke halo behind text (`paintOrder="stroke"`) so labels stay legible over lines (same trick as `DymaxionMap`).
- `--solar-ink` — small warm text that must pass AA (figure captions).

### 0.2 Typography inside SVG
- `className="font-mono"` for all labels/glyphs (IBM Plex Mono), `font-display` only for the big numerals in GeneKeys spheres.
- Sizes: structural micro-labels `fontSize=8`, glyph labels `9–11`, hero numerals `18–22`.
- Uppercase + `letterSpacing:"0.1em"` for taxonomy labels (matches `.eyebrow`/`.fig`).
- Wrap every floating text in the `--bg` halo (`stroke="rgb(var(--bg))" strokeWidth={3} paintOrder="stroke"`).

### 0.3 Draw-on motion (reduced-motion safe, free)
Add `className="draft-line"` to any path/line/circle you want to plot itself on
mount. `globals.css` already sets `stroke-dasharray:1200; stroke-dashoffset:1200`
and `@media (prefers-reduced-motion: reduce)` resets offset to 0 (drawn, static).
**Do not write new keyframes.** No `requestAnimationFrame`, no rotation. A
highlight "pulse" is forbidden unless wrapped in a reduced-motion guard; prefer a
static solar ring for emphasis instead.

### 0.4 The interpretive layer — `ChartThread` (shared)
The reading produces an array of `chart_threads`. This is the bridge between the
prose reading and the drawn charts: each thread anchors one interpretive sentence
("because X is here, that means Y for the Great Turning") to a specific glyph.

```ts
// src/components/charts/types.ts
export type Modality = "western" | "vedic" | "human_design" | "gene_keys";
export type ThreadTone = "gift" | "shadow" | "orientation" | "background";

export type ChartThread = {
  modality: Modality;
  /** Anchor key. Western/Vedic: a body name ("Sun","North_Node","Ascendant").
   *  HD: a center ("Sacral") OR a channel ("34-20") OR a gate ("34").
   *  Gene Keys: a sphere id ("lifes_work","attraction","vocation"). */
  ref: string;
  /** Optional explicit visual anchor; defaults to `ref` if it is a drawable key. */
  body?: string;
  /** Our-words interpretive line. Plain, warm, original. Placement → meaning.
   *  NEVER reproduce proprietary GK/HD descriptive text. */
  note: string;
  tone?: ThreadTone;
};
```

Tone → color: `gift`→`--accent`, `orientation`→`--link`, `background`→`--muted`,
`shadow`→`--flag`. The components select the threads they can anchor and ignore
the rest, so the parent can pass the full `chart_threads` array to all three.

**Anti-clutter rule (all three):** at most **4 leader-line callouts** drawn on the
SVG at once (the highest-priority threads, order preserved). Every anchored glyph
still gets a small numbered solar marker + an SVG `<title>` (native tooltip) and
`aria-label`, and the parent renders the full numbered legend list **below** the
SVG as plain `.kv`/`.row` markup. The drawing stays calm; the depth lives in the
legend and the reading prose.

### 0.5 Coordinate philosophy
Trig is computed once from the data — same "computed, not decorative" spirit as
`DymaxionMap`/`AsciiEarth`. All layouts are deterministic functions of the
raw_json, so the same component renders any chart.

---

## A. `NatalWheel`

Astrological chart wheel. One component serves **both** `western` and `vedic`
(identical shape; vedic just carries an `ayanamsa` field we ignore for drawing and
surface only as a caption).

### A.1 Prop signature
```ts
import type { ChartThread } from "./types";

export type WheelPositions = Record<string, { lon: number; sign: string; deg_in_sign: number }>;
export type WheelHouses = {
  ascendant: { lon: number; sign: string; deg_in_sign: number };
  midheaven: { lon: number; sign: string; deg_in_sign: number };
  cusps: number[]; // 12 ecliptic longitudes
};
export type WheelAspect = {
  p1: string; p2: string;
  aspect: "conjunction" | "sextile" | "square" | "trine" | "opposition";
  angle: number; orb: number;
};

export type NatalWheelProps = {
  positions: WheelPositions;
  houses: WheelHouses;
  aspects?: WheelAspect[];
  size?: number;                 // px square; default 400 (viewBox is fixed 0 0 400 400, size scales via width/height)
  system?: "western" | "vedic"; // affects only the corner caption / ayanamsa note
  ayanamsa?: number;             // vedic caption only
  glyphMode?: "abbr" | "unicode";// default "abbr" (3-letter, renders reliably in Plex Mono)
  ascendantLeft?: boolean;       // default true: rotate so the Ascendant sits at 9 o'clock
  highlight?: string[];          // body names to emphasize (solar ring)
  annotations?: ChartThread[];   // interpretive layer; western/vedic threads, anchored by body
  className?: string;
};
```

### A.2 ViewBox + radii (fixed `0 0 400 400`, center `C=(200,200)`)
```
R_signOuter   = 195   // outer edge of zodiac band
R_signInner   = 165   // inner edge of zodiac band (glyph band = 30px wide, glyph at r=180)
R_houseRing   = 162   // cusp lines run from here out to R_signInner... actually:
                      //   sign band:   165..195
                      //   cusp lines:  drawn 96..165 (hub ring to inner edge of sign band)
R_planet      = 140   // default planet placement radius (declustered outward in tiers)
R_houseNum    = 116   // house number labels
R_hub         = 96    // inner "aspect hub" circle; all aspect chords drawn at this radius
R_callout     = 205   // leader-line callout anchor just outside the wheel (margin)
```
`size` only sets the rendered `width`/`height`; geometry stays in the 400 space so
all math is constant.

### A.3 Longitude → screen mapping
0° = 0° Aries. Standard wheel: 0° Aries at left, increasing counter-clockwise.
```ts
const offset = ascendantLeft ? houses.ascendant.lon : 0;
function polar(lon: number, r: number) {
  const a = ((180 - (lon - offset)) * Math.PI) / 180; // CCW, anchor at left
  return { x: 200 + r * Math.cos(a), y: 200 - r * Math.sin(a) }; // SVG y-down → minus
}
```
Check: with `offset=0`, lon 0 → left (9 o'clock); lon 90 → top (12 o'clock). With
`ascendantLeft`, the Ascendant longitude lands exactly at the left, the canonical
1st-house cusp position.

### A.4 Layers (draw order, back → front)
1. **Registration ticks** — 4 corner drafting marks, `--rule/0.4` (copy from `DymaxionMap`/`GiftFigure`).
2. **Sign band** — two concentric circles at `R_signInner`,`R_signOuter` (`--rule/0.25`); 12 radial dividers at lon = 0,30,…,330; in each 30° sector place the sign glyph/abbr at `polar(k*30+15, 180)`, `--muted`, `fontSize=10`. Alternating sectors get a faint `--rule/0.06` fill wedge (`<path>` annulus segment) for the houses-style banding — optional, keep subtle.
3. **House cusps** — for each `cusps[i]`, radial line `polar(cusps[i],96)`→`polar(cusps[i],165)`. Angular cusps (the Ascendant = cusp[0], IC = cusp[3], Descendant = cusp[6], MC = cusp[9]) drawn heavier (`--link`, `1.4`) and labeled `ASC / IC / DSC / MC`; intermediate cusps `--rule/0.25`, `1`. House number `i+1` at `polar(midLon(cusps[i],cusps[i+1]), R_houseNum)` where `midLon` averages on the circle (handle 360 wrap). `--muted`, `fontSize=9`.
4. **Hub circle** — circle r=`R_hub`, `--rule/0.2`; this is the boundary the aspect chords live inside.
5. **Aspect chords** — for each aspect draw a line `polar(p1.lon,R_hub)`→`polar(p2.lon,R_hub)`. Style table:

   | aspect | stroke token | width | dash | note |
   |---|---|---|---|---|
   | conjunction | `--accent` | 1.4 | — | bodies near-coincident; draw a short accent tie-arc at the rim instead of a center chord |
   | sextile | `--link` | 1 | `4 3` | |
   | square | `--flag` | 1.4 | — | tension |
   | trine | `--live` | 1.4 | — | harmony |
   | opposition | `--flag` | 1.2 | — | straight across center |

   **Orb → opacity:** `op = clamp(0.30, 0.85, 0.85 - (orb / maxOrbFor(aspect)) * 0.5)` with `maxOrbFor` ≈ 8° major / 6° minor. Tighter = bolder. Apply via `stroke="rgb(var(--live) / ${op})"`.
6. **Planet ticks + glyphs** — for each body in `positions`: a short radial tick from `R_signInner` inward 6px, then the glyph at `R_planet` (declustered, see A.5), `--fg`, `fontSize=11`, with `--bg` halo. Below glyph a tiny degree label `{deg_in_sign}°` `--muted fontSize=7`. North/South Node use ☊/☋ (abbr "NN"/"SN").
7. **Highlight ring** — for each name in `highlight`, an open solar ring r=8 around its glyph (`--accent`, `1.6`, `.draft-line`).
8. **Interpretive callouts** — see A.6.

### A.5 Declustering (planet collisions)
Planets within 6° of arc would overlap. Sort bodies by `lon`; sweep; when the gap
to the previous placed body < `MIN_SEP=6°`, bump this body's draw radius by one
tier (`R_planet - tier*14`, max 2 tiers) so stacked planets nest inward. Glyph
angle stays true to `lon`; only the radius changes. Keeps positions honest while
legible.

### A.6 Interpretive layer
`annotations` = the `chart_threads` with `modality ∈ {western,vedic}`, anchored by
`body` (or `ref`). For up to 4 highest-priority threads:
- draw a numbered solar marker (small filled `--accent` circle, r=7, white index numeral) on the planet glyph;
- draw a `.draft-line` leader from the glyph out to `R_callout` then a short horizontal elbow to a margin label (same elbow/leader pattern as `GiftFigure`), the label being the thread's short ref (e.g. "SUN ▸ SCORPIO · H8"), tone-colored;
- the full `note` is the SVG `<title>` of the marker group (native tooltip) and the `aria-label`.

All anchored bodies (even beyond the 4 drawn callouts) get the marker + `<title>`.
The **parent** renders the numbered legend below the wheel:
`FIG A.n — {ref}: {note}` as `.kv` rows. This keeps the drawing quiet.

### A.7 Glyph maps (in `chartGeometry.ts`)
```ts
export const SIGN_ABBR = ["Ari","Tau","Gem","Can","Leo","Vir","Lib","Sco","Sag","Cap","Aqr","Psc"];
export const SIGN_GLYPH = ["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"];
export const SIGN_INDEX: Record<string,number> = { Aries:0,Taurus:1,Gemini:2,Cancer:3,Leo:4,Virgo:5,Libra:6,Scorpio:7,Sagittarius:8,Capricorn:9,Aquarius:10,Pisces:11 };
export const PLANET_ABBR: Record<string,string> = {
  Sun:"Sun",Moon:"Moo",Mercury:"Mer",Venus:"Ven",Mars:"Mar",Jupiter:"Jup",Saturn:"Sat",
  Uranus:"Ura",Neptune:"Nep",Pluto:"Plu",North_Node:"NN",South_Node:"SN" };
export const PLANET_GLYPH: Record<string,string> = {
  Sun:"☉",Moon:"☽",Mercury:"☿",Venus:"♀",Mars:"♂",Jupiter:"♃",Saturn:"♄",
  Uranus:"♅",Neptune:"♆",Pluto:"♇",North_Node:"☊",South_Node:"☋" };
```
Default `glyphMode:"abbr"` because the unicode astro glyphs are unreliable in IBM
Plex Mono; `"unicode"` available for callers who load a glyph font.

### A.8 SSR / a11y
No hooks. `role="img"`, `aria-label` summarizing Sun/Moon/Asc sign + count of
aspects. Tooltips via `<title>`. Interactivity (click a planet → scroll reading)
is an optional `"use client"` wrapper passing `onSelectBody?(name)`.

---

## B. `BodyGraph`

The Human Design bodygraph: 9 centers in canonical fixed positions, channels
between defined gate pairs, defined centers filled in solar, open centers as
hairline outline, gate numbers shown.

### B.1 Prop signature
```ts
import type { ChartThread } from "./types";

export type HDGateActivation = { gate: number; line: number };
export type HumanDesign = {
  type: "Generator" | "Manifesting Generator" | "Manifestor" | "Projector" | "Reflector";
  profile: string;
  authority: "Emotional" | "Sacral" | "Splenic" | "Ego" | "Self-Projected" | "Mental" | "Lunar";
  definition: string;
  defined_centers: string[];   // canonical names below
  open_centers: string[];
  channels: { gates: [number, number]; centers: [string, string] }[];
  gates: { personality: Record<string, HDGateActivation>; design: Record<string, HDGateActivation> };
  incarnation_cross_gates: { personality_sun: number; personality_earth: number; design_sun: number; design_earth: number };
  low_confidence?: boolean;
};

export type BodyGraphProps = {
  hd: HumanDesign;
  size?: number;             // px; viewBox fixed 0 0 320 520
  highlight?: string[];      // center names OR "a-b" channel keys OR gate numbers as strings
  annotations?: ChartThread[]; // human_design threads, anchored by center/channel/gate
  showGateNumbers?: boolean; // default true
  className?: string;
};
```
Canonical center names (use these exact strings): `Head`, `Ajna`, `Throat`,
`G` (a.k.a. Identity), `Heart` (Ego/Will), `Spleen`, `SolarPlexus`, `Sacral`,
`Root`.

### B.2 ViewBox `0 0 320 520`. Center geometry (literal)
Vertical axis x=160. Each center = a shape + flag whether it is a **motor**
(Sacral, Heart, SolarPlexus, Root). Coordinates are SVG points.

```ts
// shape "tri-up"/"tri-down"/"tri-left"/"tri-right" = triangle apex direction; "square"/"diamond"
export const HD_CENTERS = {
  Head:       { shape:"tri-up",    pts:[[160,16],[124,70],[196,70]],               motor:false },
  Ajna:       { shape:"tri-down",  pts:[[124,84],[196,84],[160,140]],              motor:false },
  Throat:     { shape:"square",    rect:[130,152,60,60],                           motor:false }, // x,y,w,h → 130..190 / 152..212
  G:          { shape:"diamond",   pts:[[160,224],[200,266],[160,308],[120,266]],  motor:false },
  Heart:      { shape:"tri-left",  pts:[[236,210],[236,250],[206,230]],            motor:true  }, // small, apex points left toward G
  Spleen:     { shape:"tri-right", pts:[[40,300],[40,400],[118,350]],              motor:false },
  SolarPlexus:{ shape:"tri-left",  pts:[[280,300],[280,400],[202,350]],            motor:true  },
  Sacral:     { shape:"square",    rect:[130,318,60,60],                           motor:true  }, // 130..190 / 318..378
  Root:       { shape:"square",    rect:[130,432,60,60],                           motor:true  }, // 130..190 / 432..492
} as const;
```
Each center label (abbr) sits at the shape centroid; gate ports sit on the
perimeter (B.4). Defined → fill `rgb(var(--accent))` with `--bg` glyph; open →
`fill:none stroke:rgb(var(--rule)/0.5) strokeWidth:1.2`. Motors may get a faint
solar inner dot when defined (optional flair).

### B.3 The 36 channels (canonical, with center pairs)
```ts
export const HD_CHANNELS: { gates:[number,number]; centers:[string,string] }[] = [
  // Head ↔ Ajna
  {gates:[64,47],centers:["Head","Ajna"]}, {gates:[61,24],centers:["Head","Ajna"]}, {gates:[63,4],centers:["Head","Ajna"]},
  // Ajna ↔ Throat
  {gates:[17,62],centers:["Ajna","Throat"]}, {gates:[43,23],centers:["Ajna","Throat"]}, {gates:[11,56],centers:["Ajna","Throat"]},
  // Throat ↔ Spleen
  {gates:[16,48],centers:["Throat","Spleen"]}, {gates:[20,57],centers:["Throat","Spleen"]},
  // Throat ↔ G
  {gates:[31,7],centers:["Throat","G"]}, {gates:[8,1],centers:["Throat","G"]}, {gates:[33,13],centers:["Throat","G"]}, {gates:[20,10],centers:["Throat","G"]},
  // Throat ↔ Sacral
  {gates:[20,34],centers:["Throat","Sacral"]},
  // Throat ↔ SolarPlexus
  {gates:[35,36],centers:["Throat","SolarPlexus"]}, {gates:[12,22],centers:["Throat","SolarPlexus"]},
  // Throat ↔ Heart
  {gates:[45,21],centers:["Throat","Heart"]},
  // G ↔ Sacral
  {gates:[10,34],centers:["G","Sacral"]}, {gates:[15,5],centers:["G","Sacral"]}, {gates:[2,14],centers:["G","Sacral"]}, {gates:[46,29],centers:["G","Sacral"]},
  // G ↔ Spleen
  {gates:[10,57],centers:["G","Spleen"]},
  // G ↔ Heart
  {gates:[25,51],centers:["G","Heart"]},
  // Heart ↔ Spleen / SolarPlexus
  {gates:[26,44],centers:["Heart","Spleen"]}, {gates:[40,37],centers:["Heart","SolarPlexus"]},
  // Sacral ↔ Spleen
  {gates:[34,57],centers:["Sacral","Spleen"]}, {gates:[27,50],centers:["Sacral","Spleen"]},
  // Sacral ↔ SolarPlexus
  {gates:[59,6],centers:["Sacral","SolarPlexus"]},
  // Sacral ↔ Root
  {gates:[42,53],centers:["Sacral","Root"]}, {gates:[3,60],centers:["Sacral","Root"]}, {gates:[9,52],centers:["Sacral","Root"]},
  // Spleen ↔ Root
  {gates:[32,54],centers:["Spleen","Root"]}, {gates:[28,38],centers:["Spleen","Root"]}, {gates:[18,58],centers:["Spleen","Root"]},
  // SolarPlexus ↔ Root
  {gates:[30,41],centers:["SolarPlexus","Root"]}, {gates:[55,39],centers:["SolarPlexus","Root"]}, {gates:[49,19],centers:["SolarPlexus","Root"]},
]; // length 36
```

### B.4 Gate ports (anchor points for channels) — literal `GATE_PORTS`
Each gate has one perimeter anchor. A channel is drawn as a line (or 2-segment
hinge through the half-way point if you want the classic "kink") between
`GATE_PORTS[a]` and `GATE_PORTS[b]`. Coordinates chosen so same-center partner
gates align cleanly with the opposite center.

```ts
export const GATE_PORTS: Record<number,[number,number]> = {
  // Head (bottom edge → Ajna)
  64:[140,66], 61:[160,66], 63:[180,66],
  // Ajna (top edge → Head ; lower → Throat)
  47:[140,90], 24:[160,90], 4:[180,90], 17:[146,128], 43:[160,132], 11:[174,128],
  // Throat (top→Ajna, left→Spleen/G/Sacral, bottom→G, right→SP/Heart)
  62:[146,158], 23:[160,156], 56:[174,158], 16:[130,168], 20:[130,196],
  31:[140,212], 8:[160,212], 33:[180,212], 35:[190,166], 12:[190,184], 45:[190,202],
  // G (top→Throat, left→Throat/Spleen, bottom→Sacral, right→Heart)
  1:[160,228], 7:[146,236], 13:[174,236], 10:[126,258], 25:[194,258],
  15:[146,296], 2:[160,302], 46:[174,296],
  // Heart/Ego
  21:[224,212], 51:[210,228], 26:[224,240], 40:[232,248],
  // Spleen (right/apex → Throat/G/Sacral/Heart ; bottom → Root)
  48:[100,332], 57:[112,350], 44:[92,322], 50:[100,368], 32:[70,392], 28:[56,390], 18:[44,386],
  // SolarPlexus (left/apex → Throat/Sacral/Heart ; bottom → Root)
  36:[220,332], 22:[208,346], 37:[216,362], 6:[210,366], 30:[250,392], 55:[264,390], 49:[276,386],
  // Sacral (top→G, top-left→Throat/Spleen, left→Spleen, right→SP, bottom→Root)
  34:[132,322], 5:[146,318], 14:[160,318], 29:[174,318], 27:[130,340], 59:[190,340],
  42:[140,378], 3:[160,378], 9:[180,378],
  // Root (top→Sacral, left→Spleen, right→SolarPlexus)
  53:[140,432], 60:[160,432], 52:[180,432], 54:[130,444], 38:[130,460], 58:[130,476],
  41:[190,444], 39:[190,460], 19:[190,476],
};
```

### B.5 Draw order (back → front)
1. Registration ticks (`--rule/0.4`).
2. **All 36 channels as faint "ghost" hairlines** (`--rule/0.12`) so the full body
   is legible even where undefined — the classic bodygraph plate look.
3. **Active channels** — for each entry in `hd.channels`, draw the line bold in
   `--accent` (`1.8`, `.draft-line`). If both half-gates belong to the person's
   `gates` it's a full hanging channel; if only one side, draw that half in
   `--accent` and the partner half dimmed (`--accent/0.35`) — a "hanging gate".
   (Determine active gate set from `hd.gates.personality` + `hd.gates.design`.)
4. **Centers** — outline all 9 first (`--rule/0.5`), then fill the
   `defined_centers` with `--accent`. Center abbr label centered (`--bg` over solar
   fill, `--muted` over open).
5. **Gate numbers** (if `showGateNumbers`) — at each `GATE_PORTS` point, tiny
   numeral `fontSize=7`, `--muted`; gates the person carries get `--fg` + a 2px
   solar dot under the number.
6. **Highlight** — for each `highlight` entry: center → solar ring around shape;
   channel "a-b" → re-stroke that channel `--live` width 2.4; gate → ring the port.
7. **Interpretive callouts** (B.6).
8. **Type/Authority caption block** — bottom or side: `TYPE / AUTHORITY / PROFILE
   / DEFINITION` as `.kv` lines (can be SVG `<text>` or parent HTML beside the
   SVG). If `low_confidence`, add a muted "BIRTH TIME UNCERTAIN" tag.

### B.6 Interpretive layer
`annotations` = threads with `modality:"human_design"`. Anchor resolution:
- `ref` matches a center name → callout from that center's centroid;
- `ref` matches `"a-b"` (or `"34-20"`) → from that channel's midpoint;
- `ref` is a gate number string → from that `GATE_PORTS` point.

Up to 4 leader-line callouts to the left/right margins (the bodygraph is narrow;
there is room at x<40 and x>280), numbered solar markers, tone-colored short
labels, full `note` in `<title>` + parent legend (`FIG B.n`). Same anti-clutter
rule as A.6.

### B.7 SSR / a11y / mode / motion
No hooks; `role="img"`; `aria-label` = "{type}, {authority} authority, profile
{profile}; defined: {centers}." Mode via tokens. Only `.draft-line` motion. No
continuous animation.

---

## C. `GeneKeysViz`

A clean, legible **hologenetic constellation** of the three sequences. NOT the
proprietary art — our own three-column arrangement of labelled gate.line spheres.

### C.1 Prop signature
```ts
import type { ChartThread } from "./types";

export type GKSphere = { gate: number; line: number };
export type GeneKeys = {
  activation_sequence: { lifes_work: GKSphere; evolution: GKSphere; radiance: GKSphere; purpose: GKSphere };
  venus_sequence: { attraction: GKSphere; iq: GKSphere; eq: GKSphere; sq: GKSphere };
  pearl_sequence: { vocation: GKSphere; culture: GKSphere; brand: GKSphere };
  note?: string;
};

export type GeneKeysVizProps = {
  geneKeys: GeneKeys;
  size?: number;               // px; viewBox fixed 0 0 480 440
  highlight?: string[];        // sphere ids
  annotations?: ChartThread[]; // gene_keys threads, anchored by sphere id
  className?: string;
};
```

### C.2 ViewBox `0 0 480 440` — three columns
Three sequence columns; within each, spheres ascend bottom → top (the lower sphere
is the "entry"/foundation, upper is the "fruit"). Sphere radius `R=28`.

```ts
export const GK_LAYOUT: Record<string,{x:number;y:number;seq:"activation"|"venus"|"pearl";label:string;sub:string}> = {
  // CENTER column — Activation Sequence (the spine; bottom → top)
  lifes_work: { x:240, y:372, seq:"activation", label:"LIFE'S WORK", sub:"Sun · Personality" },
  evolution:  { x:240, y:278, seq:"activation", label:"EVOLUTION",   sub:"Earth · challenge" },
  radiance:   { x:240, y:184, seq:"activation", label:"RADIANCE",    sub:"Design Sun · vitality" },
  purpose:    { x:240, y:90,  seq:"activation", label:"PURPOSE",     sub:"Design Earth · core" },
  // LEFT column — Venus Sequence (relationship / heart; bottom → top)
  attraction: { x:96,  y:360, seq:"venus", label:"ATTRACTION", sub:"" },
  iq:         { x:96,  y:268, seq:"venus", label:"IQ",         sub:"mental" },
  eq:         { x:96,  y:176, seq:"venus", label:"EQ",         sub:"emotional" },
  sq:         { x:96,  y:84,  seq:"venus", label:"SQ",         sub:"spiritual" },
  // RIGHT column — Pearl Sequence (vocation / prosperity; bottom → top)
  vocation:   { x:384, y:340, seq:"pearl", label:"VOCATION", sub:"" },
  culture:    { x:384, y:215, seq:"pearl", label:"CULTURE",  sub:"" },
  brand:      { x:384, y:90,  seq:"pearl", label:"BRAND",    sub:"" },
};
export const GK_SEQ_COLOR = { activation:"--accent", venus:"--link", pearl:"--live" } as const;
```

### C.3 Draw order
1. Registration ticks; three faint column captions at the top
   (`ACTIVATION / VENUS / PEARL`) `--muted fontSize=9`.
2. **Flow paths** — within each sequence draw a `.draft-line` connecting its
   spheres in order (bottom → top) in the sequence color at low alpha
   (`/0.4`), with a small chevron/arrowhead at each upper end (reuse the
   arrowhead idiom from `diagrams.tsx FeedbackLoop`). A faint cross-link from
   `lifes_work`↔`attraction` and `lifes_work`↔`vocation` ties the three sequences
   into one profile (the spheres all derive from the same activation).
3. **Spheres** — for each entry: outer ring r=28 (sequence color, `1.6`), inner
   ring r=24 (`--rule/0.2`); the **gate number** big & centered
   (`font-display fontSize=22`, `--fg`), a small **.line** superscript to its
   upper-right (`fontSize=10`, sequence color, e.g. `34.5`); the sphere `label`
   above the circle (`.eyebrow`-style, `--muted`, `--bg` halo) and `sub` below
   (`fontSize=7`, `--muted`).
4. **Highlight** — sphere ids in `highlight` get a filled sequence-color halo
   ring (r=32, alpha 0.25) behind them.
5. **Interpretive callouts** (C.4).
6. Optional `note` rendered by the parent as a `.kv` caption below.

### C.4 Interpretive layer
`annotations` = threads with `modality:"gene_keys"`, anchored by sphere id (`ref`).
Numbered solar markers on the sphere, up to 4 leader-line callouts to the margins,
full `note` in `<title>` + parent legend (`FIG C.n`). Spheres carry the
gate.line + the structure; the interpretive sentence (what this gift means for how
the person serves the Great Turning) lives in the callout/legend/reading — we never
print proprietary Gene Keys descriptions.

### C.5 SSR / a11y / mode / motion
No hooks; `role="img"`; `aria-label` lists the three sequences and their gate.lines.
Tokens for mode; `.draft-line` only.

---

## D. Integration notes (for the page/build agents)

- **Data source:** `charts` table → `raw_json` per modality. Pass
  `charts.western.positions/houses/aspects` to `NatalWheel`; `charts.vedic.*` with
  `system="vedic"` for the sidereal wheel; `charts.human_design` to `BodyGraph`;
  `charts.gene_keys` to `GeneKeysViz`.
- **Interpretive layer source:** the reading generates `chart_threads: ChartThread[]`
  (new field on the reading artifact). Pass the **whole array** to each component;
  each filters by `modality` and ignores anchors it can't draw. The parent reading
  page renders the numbered FIG legends below each chart from the same array.
- **Reduced clutter on small screens:** below `sm`, pass `annotations={[]}` (markers
  only, no leader lines) and rely on the legend; the SVGs themselves are
  `width:100%` with `viewBox` so they scale.
- **3D page transitions** (separate v3 work) are CSS-only and live on the page
  wrapper, not in these components — the charts must remain transform-neutral so
  `.draft-line` and `<title>` hit-testing aren't broken by ancestor 3D transforms.
- **No new deps.** Everything above is SVG + token CSS + (optionally) one thin
  `"use client"` wrapper per chart for `onSelect*` interactivity. Core renders on
  the server.
