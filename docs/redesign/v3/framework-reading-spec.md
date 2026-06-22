# EcoDharma v3 — Framework Enrichment & Comprehensive Reading Spec

Status: locked direction (v3 overhaul). This spec governs three things:
1. How the 10 archetypes (gifts) get **enriched** into thorough, consistent descriptions.
2. The new, **much richer reading architecture** (TypeScript types, back-compat preserved).
3. The new **interpreter prompt** (Claude path, model `claude-opus-4-8`) and the **upgraded deterministic fixture**.

Guiding principle (the whole point of v3): **the reading goes DEEP, the framework goes QUIET.** Pre-v2 readings were rich and satisfying; v2 thinned them to fix "too prescriptive / regurgitating theory." That was the wrong fix. The right fix: keep the reading lush and personal, and move all prescriptive / advocacy-flavored content OUT of the reading prose and INTO the archetype descriptions (specifically each archetype's `great_turning_contribution`). The reading reads as a deep personal synthesis; the framework's opinions live inside the archetypes where the reader rarely sees them raw.

Ground-truth files this spec extends:
- `framework/framework.json` (v2.0.0 — 10 gifts, 3 dimensions, 9 domains, 32 trim_tabs, ikigai_lens)
- `apps/web/src/lib/types.ts` (`Gift`, `Domain`, `TrimTab`, `CoreProfile`, `GiftProfile`, `Charts`, `Pairing`, `Ikigai`)
- `apps/web/src/lib/interpret.ts` (fixture + Claude path, `PROFILE_TOOL`, `slimFramework`)
- `apps/web/src/lib/trimtabs.ts` (`resolveTrimTab`, `personalizeTrimTab`, `TrimTabRow`) — KEPT AS-IS
- `framework/voice/ecodharma-voice@2.0.0.md`

The 10 gift ids (canonical, do not rename): `the-weaver`, `the-builder`, `the-steward`, `the-healer`, `the-convener`, `the-storyteller`, `the-toolmaker`, `the-guardian`, `the-elder`, `the-seer`.
The 9 domain ids: `protection-advocacy`, `care-relief`, `land-living-systems`, `regenerative-economy`, `governance-commons`, `tools-infrastructure`, `knowledge-learning`, `healing-wholeness`, `story-imagination-sacred`.
The 3 dimension ids: `holding-actions`, `life-sustaining-systems`, `shift-in-consciousness`.

---

## SECTION 1 — ARCHETYPE ENRICHMENT GUIDE

### 1.1 Goal
Each of the 10 gifts is enriched by one dedicated agent (10 agents, one gift each). The output must be **consistent in shape, rich in substance, and original in language**. This is where the framework's prescriptive voice lives. The enriched archetypes are stored back into `framework.json` under each gift object, and a new `EnrichedGift` type (Section 2.0) describes them.

### 1.2 What "thorough" means (the required parts)
Every enriched archetype MUST contain, in order:
- **essence** — one line. The gift in a single sentence. (Already exists — keep / refine.)
- **portrait** — 3–5 sentences. The inner experience: psychology, orientation, how this gift *feels from the inside*, what such a person is drawn toward and repelled by, the felt texture of carrying it. Written in third person about "this kind of person," warm and recognizable, NOT a horoscope, NOT advice.
- **strengths** — 4–7 concrete capacities (short noun/verb phrases). What they can actually *do* well.
- **shadow** — keep the existing single-sentence `shadow` string (back-compat). The nuance moves into `shadow_detail`.
- **shadow_detail** — an object naming HOW the gift over-reaches and HOW to relate to it (not "fix"; the voice frames shadow as a gift over-reaching, with warmth).
- **chart_signatures** — for each of the four lenses, 2–4 **soft, recognizable signatures in our own words**. These are richer than the existing terse `modality_signals` term-lists: each is a short phrase a reader could plausibly recognize. NEVER reproduce proprietary Gene Keys / Human Design descriptive text — positions, gate numbers, channels, center names, and our own plain gloss only.
- **great_turning_contribution** — THE prescriptive home. What this archetype is FOR in the Great Turning: which dimension(s) and domain(s) it most serves and why, and what the world specifically needs from it. This is where advocacy lives so it stays OUT of the personal reading.

### 1.3 EXACT JSON field names each enrichment agent MUST return
Each agent returns ONE JSON object merged into the matching gift in `framework.json`. The existing fields (`id`, `name`, `essence`, `description`, `shadow`, `modality_signals`) are PRESERVED; the agent adds the keys below. Use these exact names:

```jsonc
{
  "id": "the-weaver",                      // unchanged, identifies which gift this enriches
  "essence": "string",                      // one line (refine existing)
  "portrait": "string",                     // 3-5 sentences, third person, inner experience
  "strengths": ["string", "..."],          // 4-7 concrete capacity phrases
  "shadow": "string",                       // KEEP existing single-sentence string (back-compat)
  "shadow_detail": {
    "over_reach": "string",                 // how the gift, pushed too far, becomes the shadow
    "how_to_relate": "string"               // how to tend it (not fix); warm, gift-over-reaching framing
  },
  "chart_signatures": {                      // OUR OWN WORDS, soft signatures (NOT proprietary text)
    "western": ["string", "..."],          // 2-4; e.g. "Venus strong by sign or aspect — harmony reads as a need, not a nicety"
    "vedic": ["string", "..."],            // 2-4; nakshatra/graha glosses in plain language
    "human_design": ["string", "..."],     // 2-4; type/center/channel signatures, our gloss only
    "gene_keys": ["string", "..."]         // 2-4; gate numbers + our own one-line gloss, never GK prose
  },
  "great_turning_contribution": {
    "summary": "string",                    // 1-2 sentences: what this gift is FOR in the Great Turning
    "dimensions": ["holding-actions" | "life-sustaining-systems" | "shift-in-consciousness"], // 1-2 ids
    "domains": ["domain-id", "..."],        // 2-3 domain ids this gift most serves
    "what_its_for": "string"                // 2-4 sentences of the prescriptive/advocacy content
  }
}
```

### 1.4 Consistency rules for the 10 agents (so outputs interlock)
- **Length budget:** `portrait` 60–110 words; `what_its_for` 50–90 words; each `strengths` item ≤ 8 words; each `chart_signatures` item ≤ 14 words.
- **Person, not advice:** `portrait`, `strengths`, `shadow_detail` describe the archetype; they NEVER address "you" and NEVER tell the reader what to do. All "should / go do / the world needs you to" energy belongs ONLY in `great_turning_contribution.what_its_for`.
- **IP boundary (hard):** gate numbers, channel pairs (e.g. `37-40`), center names, type names, profile lines, sign/planet/nakshatra names are ALL allowed. Reproducing or paraphrasing Gene Keys / Human Design *descriptive prose* is forbidden. Every gloss must be original.
- **Domain/dimension ids must be valid** (from the lists above) so the reading layer and visuals can resolve them.
- **Voice:** follow `ecodharma-voice@2.0.0` — warm, grounded, specific over grand, gifts-not-deficits.
- **Stay general:** these are GENERAL archetypes. Do not invent sub-types. Depth comes from richness of description, not from splitting the archetype.
- The enrichment agents do NOT touch `modality_signals` (the terse term-lists used for fixture scoring) — they ADD `chart_signatures` alongside it. Both coexist: `modality_signals` powers deterministic scoring; `chart_signatures` powers human-readable hints in the UI and gives the Claude path richer priors.

---

## SECTION 2 — COMPREHENSIVE READING ARCHITECTURE

The reading must be **much richer** than the current terse `CoreProfile`. We KEEP every existing field so nothing breaks (`recognition`, `unique_gifts`, `domains`, `pairings`, `shadow`, `narrative`, and the `trim_tabs`/`pairings` mechanism), and we ADD the deep fields. The interpretive layer drawn over the chart visuals is powered by the new `chart_threads` array.

### 2.0 Enriched framework types (add to `types.ts`)

```ts
export type ShadowDetail = {
  over_reach: string;     // how the gift over-reaches into shadow
  how_to_relate: string;  // how to tend it (not fix)
};

export type ChartSignatures = {
  western: string[];
  vedic: string[];
  human_design: string[];
  gene_keys: string[];
};

export type GreatTurningContribution = {
  summary: string;
  dimensions: string[];   // dimension ids (1-2)
  domains: string[];      // domain ids (2-3)
  what_its_for: string;   // the prescriptive/advocacy content lives HERE
};

// Gift, enriched. Extends the existing Gift; all new fields optional for back-compat
// during the migration window, but the 10 enrichment agents fill them all.
export type EnrichedGift = Gift & {
  portrait?: string;
  strengths?: string[];
  shadow_detail?: ShadowDetail;
  chart_signatures?: ChartSignatures;
  great_turning_contribution?: GreatTurningContribution;
};
```

`Framework.gifts` stays typed as `Gift[]`; readers that need the rich fields cast to `EnrichedGift`. (Or widen `Framework.gifts` to `EnrichedGift[]` — preferred once migration lands.)

### 2.1 The four chart lenses (shared union)

```ts
export type ChartLens = "western" | "vedic" | "human_design" | "gene_keys";
```

### 2.2 ChartThread — the interpretive layer over the visuals

Each thread ties a SPECIFIC placement to plain meaning and to Great-Turning participation. This array is what the natal wheel, the bodygraph, and the Gene Keys chart render their callouts/overlays from. Keep them concrete and few (quality over quantity).

```ts
export type ChartThread = {
  lens: ChartLens;
  placement: string;        // the literal, specific placement, e.g.
                            //   "Sun in Scorpio in the 8th house"
                            //   "Emotional authority, defined Solar Plexus"
                            //   "Channel 37-40 (Throat to Solar Plexus)"
                            //   "Life's Work in Gate 25"
  plain_meaning: string;    // 1-2 sentences: what this means about the person, plainly,
                            //   NO jargon, NO framework theory. About THIS person.
  great_turning_link: string; // 1-2 sentences: "because X, that means Y for how you can
                            //   participate in the Great Turning" — the interpretive bridge.
  gift_id?: string;         // optional: which of the person's gifts this placement feeds
  anchor?: string;          // optional stable key for the visual to attach the overlay to,
                            //   e.g. "Sun", "Throat", "channel:37-40", "lifes_work"
};
```

Authoring rules for `chart_threads`:
- Span ALL FOUR lenses: aim for ~3–5 western, ~2–3 vedic, ~3–4 human_design, ~2–3 gene_keys (8–14 total). Fewer is fine if a lens is sparse or birth time is unknown.
- `placement` must be specific enough to locate on the visual (sign + house, channel by gate pair, named gate/line, authority/type). The `anchor` field gives the visual a machine key.
- `great_turning_link` is the heart of v3: it must read like "because this placement is here, that means this about how you show up for the work." Plain, warm, causal, never deterministic ("a leaning," "tends to," not "you will").
- Never recite framework theory and never reproduce proprietary HD/GK prose.

### 2.3 GiftCarry — the gift constellation (how THIS person carries each dominant gift)

```ts
export type GiftCarry = {
  gift_id: string;          // one of the 10 gift ids
  prominence?: number;      // optional 0..1 relative weight among the chosen gifts
  how_they_carry: string;   // 2-4 sentences: how THIS person specifically embodies this gift,
                            //   grounded in their charts + ikigai. NOT the archetype definition.
  evidence?: string[];      // optional: short placement references that point to this gift,
                            //   e.g. ["Sun in Scorpio", "defined Spleen", "Gate 18"]
};
```

The constellation is the 2–3 dominant gifts. `unique_gifts` (back-compat, ≤15-word phrases) is DERIVED from / parallel to this — keep populating it, but `gift_constellation` carries the depth.

### 2.4 The new CoreProfile (literal recommended type — extends current, fully back-compat)

```ts
export type CoreProfile = {
  // ---- BACK-COMPAT FIELDS (keep; nothing downstream breaks) ----
  recognition: string;                       // short, warm opener — the first thing read
  unique_gifts: string[];                    // <=15 words each, 2nd person, how this person carries a gift
  domains: { domain_id: string; why: string }[];
  pairings: Pairing[];                       // gift x domain; first = the lead move (drives trim_tabs)
  shadow: { pattern: string; how_to_relate: string }[];
  narrative: string;                         // KEEP — now the closing/"fuller reflection"; see note

  // ---- NEW RICH FIELDS (v3) ----
  portrait: string;                          // LONG-FORM (250-500 words): the person's background,
                                             //   psychology, gifts, and orientations, woven from ALL
                                             //   FOUR charts + ikigai. Warm, plain, deeply personal.
                                             //   This is the centerpiece of the reading.
  chart_threads: ChartThread[];              // the interpretive layer for the chart visuals (2.2)
  gift_constellation: GiftCarry[];           // the 2-3 dominant gifts + how THIS person carries each (2.3)
  orientations?: string[];                   // optional 3-6 short phrases naming the person's leanings
                                             //   (e.g. "moves toward the wound, not away", "thinks in
                                             //   systems before people") — distilled, plain.
  edges?: { pattern: string; how_to_relate: string }[]; // optional richer shadow/edges; if present the
                                             //   UI may prefer this; `shadow` stays populated for compat.
};
```

Notes / migration semantics:
- `recognition` becomes the SHORT warm opener (1–3 sentences). `portrait` is the long body. `narrative` is kept and now holds the closing/synthesis paragraph (so old UI that renders `narrative` still shows something coherent; new UI renders `portrait` as the body and `narrative` as the coda). If an engine only fills `portrait`, set `narrative = ""`; if only `narrative` (legacy), the new UI can fall back to it.
- `shadow` (array of `{pattern, how_to_relate}`) stays REQUIRED for back-compat. `edges` is the optional richer alias; when both exist, treat `edges` as canonical.
- `gift_constellation` is the source of truth for the dominant gifts; `unique_gifts` is still emitted (derive each as a ≤15-word line from a `GiftCarry`).
- `pairings` unchanged in meaning and still resolve trim-tabs via `resolveTrimTab` + `personalizeTrimTab` (KEEP the mechanism exactly).

### 2.5 GiftProfile (unchanged shape, inherits the richer CoreProfile)

```ts
export type GiftProfile = CoreProfile & {
  trim_tabs: {
    trim_tab_id?: number;
    action: string;
    domain_id: string;
    gift_basis?: string;
    upward_spiral?: string;
    ikigai_fit?: string;
  }[];
  meta?: { engine: string; framework_version: string; voice_version: string };
};
```

No change to `trim_tabs` resolution: `generateGiftProfile` still calls `resolveTrimTab(gift_id, domain_id)` then `personalizeTrimTab(...)` per pairing, lead first, capped at `MAX_PAIRINGS` (3). The richer CoreProfile just rides along via `...core`.

### 2.6 Reading render order (informs the visual spec, not binding here)
1. `recognition` (opener)
2. globe / chart visuals with `chart_threads` overlaid (interpretive layer)
3. `portrait` (long body)
4. `gift_constellation` (the 2–3 gifts, how carried)
5. `domains` + `pairings` → resolved `trim_tabs` (lead first)
6. `orientations`, then `edges`/`shadow`
7. `narrative` (coda)

---

## SECTION 3 — INTERPRETER PROMPT DESIGN

Target model: `claude-opus-4-8` (already the `MODEL` const). The Claude path produces the comprehensive, chart-grounded, plain-language reading; the fixture produces a deterministic fallback that fills the same richer fields (more modestly). Both must satisfy the new `CoreProfile`.

### 3.1 New tool schema (`PROFILE_TOOL` replacement)

Replace the current terse `gift_profile` tool with one that requires the rich fields. Keep the back-compat fields required so downstream never sees `undefined`.

```jsonc
{
  "name": "gift_profile",
  "description": "A deep, person-centered reading. Recognition leads; the framework stays invisible scaffolding. Weave all four charts. Plain, warm, original language.",
  "input_schema": {
    "type": "object",
    "properties": {
      "recognition": { "type": "string", "description": "1-3 plain, warm sentences that make THIS person feel seen. No jargon, no metadata, no preamble. The first thing they read." },
      "portrait": { "type": "string", "description": "250-500 words. The person's background, psychology, gifts, and orientations, woven from ALL FOUR charts and weighted by their ikigai words. Deeply personal, plain, warm. Never recite theory; never reproduce proprietary HD/Gene Keys text." },
      "chart_threads": {
        "type": "array",
        "description": "8-14 specific placements that power the interpretive layer over the chart visuals. Span all four lenses.",
        "items": {
          "type": "object",
          "properties": {
            "lens": { "type": "string", "enum": ["western", "vedic", "human_design", "gene_keys"] },
            "placement": { "type": "string", "description": "the literal specific placement, e.g. 'Sun in Scorpio in the 8th house', 'Channel 37-40', 'Life's Work in Gate 25'" },
            "plain_meaning": { "type": "string", "description": "1-2 sentences, plain, about THIS person, no jargon" },
            "great_turning_link": { "type": "string", "description": "1-2 sentences: because this placement, that means this for how they can take part in the Great Turning. Causal, warm, non-deterministic." },
            "gift_id": { "type": "string", "description": "optional framework gift id this placement feeds" },
            "anchor": { "type": "string", "description": "optional stable key for the visual, e.g. 'Sun', 'Throat', 'channel:37-40', 'lifes_work'" }
          },
          "required": ["lens", "placement", "plain_meaning", "great_turning_link"]
        }
      },
      "gift_constellation": {
        "type": "array",
        "description": "the 2-3 dominant gifts and how THIS person carries each. Use framework gift ids.",
        "items": {
          "type": "object",
          "properties": {
            "gift_id": { "type": "string" },
            "prominence": { "type": "number" },
            "how_they_carry": { "type": "string", "description": "2-4 sentences, how THIS person embodies the gift, grounded in chart + ikigai. NOT the archetype definition." },
            "evidence": { "type": "array", "items": { "type": "string" } }
          },
          "required": ["gift_id", "how_they_carry"]
        }
      },
      "unique_gifts": { "type": "array", "items": { "type": "string" }, "description": "<=15 words each, second person, one per dominant gift; derived from gift_constellation." },
      "domains": { "type": "array", "items": { "type": "object", "properties": { "domain_id": { "type": "string" }, "why": { "type": "string", "description": "one plain sentence" } }, "required": ["domain_id", "why"] } },
      "pairings": { "type": "array", "description": "gift x domain intersections, most-alive first; use framework ids.", "items": { "type": "object", "properties": { "gift_id": { "type": "string" }, "domain_id": { "type": "string" } }, "required": ["gift_id", "domain_id"] } },
      "orientations": { "type": "array", "items": { "type": "string" }, "description": "optional 3-6 short phrases naming the person's leanings, plain." },
      "shadow": { "type": "array", "items": { "type": "object", "properties": { "pattern": { "type": "string" }, "how_to_relate": { "type": "string" } }, "required": ["pattern", "how_to_relate"] } },
      "edges": { "type": "array", "items": { "type": "object", "properties": { "pattern": { "type": "string" }, "how_to_relate": { "type": "string" } } } },
      "narrative": { "type": "string", "description": "a short closing synthesis paragraph (coda). Plain, about the person." }
    },
    "required": ["recognition", "portrait", "chart_threads", "gift_constellation", "unique_gifts", "domains", "pairings", "shadow", "narrative"]
  }
}
```

`max_tokens`: raise from 6000 to ~12000 (portrait + chart_threads are long). Keep `tool_choice: {type:"tool", name:"gift_profile"}` and the two cached system blocks (voice + slimFramework).

### 3.2 `slimFramework` upgrade

The model needs the enriched archetype material as priors (especially `great_turning_contribution` so it knows what each gift is FOR), but must NOT recite it. Add the rich gift fields and keep it compact:

```ts
function slimFramework(fw: Framework) {
  return {
    great_turning_dimensions: (fw.dimensions || []).map((d) => ({ id: d.id, name: d.name, description: d.description })),
    domains: fw.domains.map((d) => ({ id: d.id, name: d.name, dimension: d.dimension, gist: d.description })),
    gifts: (fw.gifts as EnrichedGift[]).map((g) => ({
      id: g.id,
      name: g.name,
      gist: g.essence || g.description,
      strengths: g.strengths,                          // priors for recognizing the gift
      chart_signatures: g.chart_signatures,            // our-words soft signatures across 4 lenses
      great_turning_contribution: g.great_turning_contribution, // what the gift is FOR (prescriptive lives here)
    })),
    ikigai_lens: fw.ikigai_lens,
  };
}
```

### 3.3 System prompt (composition)

Three cached `system` blocks, in order:
1. `loadVoice()` — `ecodharma-voice@2.0.0` (unchanged), `cache_control: ephemeral`.
2. A short v3 reading directive (NEW, see text below), `cache_control: ephemeral`.
3. `FRAMEWORK (reason WITH this; never recite it):\n${JSON.stringify(slimFramework(framework))}`, `cache_control: ephemeral`.

NEW v3 directive block (verbatim suggested text):

```
You are writing a DEEP, personal reading — much richer than a summary. Hold these rules:

1. LEAD WITH RECOGNITION. The first thing the person reads (`recognition`) must make them feel seen as a specific human, in plain language, before any data.

2. WEAVE ALL FOUR CHARTS. The `portrait` and `chart_threads` must draw on the western chart, the vedic chart, the Human Design bodygraph, AND the Gene Keys sequences. Do not lean on one lens. Where lenses agree, say so plainly; where a lens is uncertain (e.g. unknown birth time → rising sign and Human Design), hold it lightly and say so.

3. BUILD THE INTERPRETIVE BRIDGE. Each `chart_threads` entry ties a SPECIFIC placement to plain meaning AND to how this person can take part in the Great Turning — "because this is here, that tends to mean this for how you show up." Causal, warm, never deterministic. These power overlays drawn on the actual chart visuals, so name placements specifically (sign + house, channel by gate pair, named gate/line, type/authority).

4. THE FRAMEWORK IS INVISIBLE SCAFFOLDING. Reason with it; never recite it. A reader who never heard "trim-tab" or "Great Turning" must still feel met and given something useful. Use at most one or two framework terms in the whole output, and only after making the point plainly. Never paste a gift's or domain's definition as if it were a fact about the person — say how THIS person carries it, in your own words.

5. WEIGHT THEIR IKIGAI WORDS ABOVE CHART SIGNALS. The charts' signatures are soft priors. If the person's own words and a chart signal disagree, trust the person.

6. IP BOUNDARY (hard). You may name computed positions (Generator, 3/5 profile, Gate 34, Sun in Gemini, a nakshatra). NEVER reproduce or paraphrase proprietary Gene Keys / Human Design descriptive prose — speak entirely in your own words.

7. SHADOW AS GIFT OVER-REACHING. Frame edges with warmth, as a gift pushed too far — something to tend, never a verdict.

Produce: a warm `recognition` opener; a 250-500 word `portrait` weaving all four charts; 8-14 `chart_threads` spanning the four lenses; a `gift_constellation` of the 2-3 dominant gifts naming how THIS person carries each; `domains` + most-alive-first `pairings` (framework ids); plain `orientations`; gentle `shadow`/`edges`; and a short `narrative` coda.
```

### 3.4 User message (composition)

```
Write a deep, personal reading of this specific person. LEAD with recognition, then a long
portrait that weaves their western, vedic, Human Design, and Gene Keys charts together and is
weighted by their own ikigai words. Produce chart_threads that tie SPECIFIC placements to plain
meaning and to how they can take part in the Great Turning. Name the 2-3 gifts that dominate and
say how THIS person carries each. Choose gift x domain `pairings` (framework ids), most-alive first.
Original language only; never recite the framework; never reproduce proprietary Gene Keys / Human
Design text.

CHARTS:
<JSON.stringify(charts)>

IKIGAI:
<JSON.stringify(ikigai)>
```

### 3.5 Claude path post-processing (in `claudeCore`)
- Validate required: `recognition`, `portrait`, `chart_threads.length`, `gift_constellation.length`, `pairings.length`. Throw → fixture fallback (existing pattern).
- Default the optionals: `domains ||= []`, `shadow ||= []`, `unique_gifts ||= []` (or derive from `gift_constellation`), `orientations ||= []`, `edges ||= []`, `narrative ||= ""`.
- If `unique_gifts` empty but `gift_constellation` present, derive each as a ≤15-word line from `how_they_carry`.
- Keep `dedupePairings` and the existing trim-tab resolution untouched.

### 3.6 Deterministic fixture upgrade (`fixtureCore`)

The fixture stays fully offline/deterministic but must now fill the richer fields from the enriched `framework.json` + extracted chart signals (`extractSignals` already gives `sunSign`, `ascSign`, `hdType`, `hdProfile`, `hdAuthority`, `definedCenters`, `channels`, `signs`, `unknownTime`). Concretely:

- **Gift selection:** unchanged (`scoreGift` ranks; take top 2–3). These become `gift_constellation`.
- **gift_constellation:** for each chosen gift `g`, set `gift_id=g.id`, `prominence` = normalized score, and `how_they_carry` = a deterministic stitch of `g.essence` recast in second person + the strongest matching signal, e.g. `"You carry ${name} through ${strongest signal phrase}; ${essence, lowercased}."` Pull `evidence` from the chart signals that matched (sun sign, defined centers, channels).
- **portrait:** assemble from templated sentences over the extracted signals across all four lenses — Sun/Asc (western), an available vedic sign, HD type/authority/profile + 1–2 defined centers, and Gene Keys life's work gate number — plus an ikigai-rooted sentence (clip `ikigai.love`/`skill`/`world_need`). Include the unknown-time caveat when `sig.unknownTime`. Aim ~150–250 words (shorter than Claude's, honest about being a fallback).
- **chart_threads:** generate one thread per available strong signal, with a templated `placement`, a generic `plain_meaning`, and a `great_turning_link` derived from the chosen gifts' `great_turning_contribution.summary`. Set `anchor` to the body/center/channel key so visuals still attach overlays. Cover whatever lenses have data (skip time-sensitive ones when `unknownTime`).
- **domains / pairings / trim_tabs:** unchanged from current fixture logic.
- **orientations:** 3–4 deterministic phrases from chosen gifts' `strengths`.
- **shadow / edges:** `shadow` from each chosen gift's `shadow` string + the generic `how_to_relate` (existing). `edges` mirrors `shadow_detail` when present.
- **recognition + narrative:** keep the existing templated `recognition`; `narrative` becomes the short coda (existing narrative text is fine as the coda). The new long body lives in `portrait`.
- Engine tag stays `fixture-interpreter@2.0.0` (bump to `@3.0.0` when the richer fixture ships).

### 3.7 Acceptance checks
- Both paths return a `CoreProfile` satisfying the new required set; UI never sees `undefined` for required fields.
- `chart_threads` reference real placements present in `charts` (Claude) or available signals (fixture); each has a non-empty `great_turning_link`.
- No proprietary HD/GK prose appears in output (spot-check); only positions + our gloss.
- `pairings` still resolve via `resolveTrimTab`/`personalizeTrimTab`, lead first, ≤ 3.
- A reader who never heard "trim-tab"/"Great Turning" still feels seen (voice rule held).

---

## APPENDIX A — file change checklist
- `types.ts`: add `ShadowDetail`, `ChartSignatures`, `GreatTurningContribution`, `EnrichedGift`, `ChartLens`, `ChartThread`, `GiftCarry`; extend `CoreProfile` (new fields), keep `GiftProfile` shape.
- `framework.json`: each gift gains `portrait`, `strengths`, `shadow_detail`, `chart_signatures`, `great_turning_contribution` (10 enrichment agents).
- `interpret.ts`: replace `PROFILE_TOOL`, extend `slimFramework`, add v3 system directive block, raise `max_tokens`, upgrade `fixtureCore` + Claude post-processing.
- `trimtabs.ts`: UNCHANGED.
```
