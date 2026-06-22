export const meta = {
  name: 'ecodharma-reconceive',
  description: 'Parallel first-principles conception: Macy-centered general framework redesign, deeper solarpunk-terminal visual spec, and an audit of the current output',
  phases: [{ title: 'Conceive', detail: 'three independent first-principles specs in parallel' }],
}

const ROOT = '/Users/benjaminlife/iCloud Drive (Archive)/Documents/cursor projects/ecodharma'

phase('Conceive')

const [framework_spec, visual_spec, audit] = await parallel([
  // (A) Framework redesign — from first principles, Macy-centered, general
  () => agent(
    `You are redesigning the EcoDharma FRAMEWORK from first principles. The current framework reads like it is REGURGITATING one author's bespoke theory rather than offering a person GENERAL, usable orientation. Your job: a written spec for a v2 framework that feels like "a very well-considered, general framework for how a person participates in the Great Turning" — informed by the corpus but NOT dominated by its jargon.\n\n` +
    `READ FIRST (use Read):\n` +
    `- ${ROOT}/framework/framework.json  (the current, too-bespoke artifact — diagnose what's too specific/jargon-heavy)\n` +
    `- ${ROOT}/.claude/ecodharma-prd.md  (esp. §1 vision, §5 framework, §9 voice, §4 principles)\n` +
    `- ${ROOT}/omniharmonic-wiki/wiki/concepts/the-great-turning.md\n` +
    `- ${ROOT}/omniharmonic-wiki/wiki/writing/awakening-the-earth-dharma-part-i.md\n` +
    `- ${ROOT}/omniharmonic-wiki/wiki/writing/awakening-the-earth-dharma-part-ii.md\n` +
    `- ${ROOT}/omniharmonic-wiki/wiki/concepts/earth-dharma.md\n\n` +
    `DESIGN PRINCIPLES for v2 (think hard, from first principles):\n` +
    `1. CENTER JOANNA MACY. Use her Great Turning as the organizing SPINE — its three dimensions: (a) Holding Actions (slowing the damage), (b) Gaia Structures / Life-Sustaining Systems (building the new), (c) Shift in Consciousness (the perceptual/spiritual ground). Optionally reference her spiral of the Work That Reconnects (Gratitude → Honoring Pain → Seeing with New Eyes → Going Forth) as a movement model. The corpus should TEXTURE this general structure, not replace it. Credit Macy explicitly.\n` +
    `2. GENERAL, NOT BESPOKE. A stranger should read it and feel "this is a wise, general map of how to help," not "this is one person's idiosyncratic ontology." Strip insider neologisms or translate them to plain language. Keep the soul, lose the jargon density.\n` +
    `3. LESS IS MORE. The current artifact has too many over-specific nodes. Propose a LEANER set: a small number of clear domains (nested under Macy's 3 dimensions), ~8-12 general gift/archetype names that read as universal human contributions (not corpus-coded), and trim-tabs that are GENERIC, reusable starting actions connected to a gift.\n` +
    `4. INSIGHT, NOT LECTURE. The framework feeds an interpreter that should give a PERSON genuine, grounded feedback — "here is how YOUR gifts plug in" — not a recitation of the model. Specify how the framework should be SHAPED so the interpreter produces insight about the person rather than exposition about the theory.\n\n` +
    `DELIVERABLE (markdown spec):\n` +
    `- Diagnosis: 4-6 concrete examples from the current framework.json of what reads as too-bespoke/jargon/over-specific, and the general principle for fixing each.\n` +
    `- The v2 STRUCTURE: how Macy's 3 dimensions organize the domains; the proposed domain list (with one-line general descriptions); the proposed gift list (general, evocative-but-universal names + one-line descriptions + shadow); how trim-tabs relate (generic, gift-connected).\n` +
    `- The v2 ARTIFACT SCHEMA (JSON shape) — keep it compatible-ish with the app (domains[], gifts[], trim_tabs[], ikigai_lens, modality_signals as SOFT priors) but add a "great_turning_dimension" grouping and a top-level "lineage"/credits note (Macy, Fuller's trim-tab, etc.).\n` +
    `- A CONCRETE SAMPLE rendered in the new general voice: 1 dimension, 2 domains, 3 gifts (with shadow + soft modality_signals), 3 trim-tabs — so we can feel the new register.\n` +
    `- Re-distillation guidance: how to instruct the distillation swarm to produce this (what to extract, what to generalize, how to keep it lean), and a suggested target size (counts).\n\n` +
    `Be rigorous and opinionated. This is the load-bearing intelligence of the product.`,
    { label: 'conceive:framework', phase: 'Conceive', model: 'opus' },
  ),

  // (B) Visual redesign — deeper into the brief
  () => agent(
    `You are deepening the EcoDharma VISUAL design from first principles toward a bolder, cleaner realization of its brief. The current implementation is good but tame; the user wants it to feel CLEAN, EXPANSIVE, MINIMAL — a genuine "solarpunk TERMINAL interface": a big open canvas of lines and ASCII, keyboard-navigable, stripped down, much more like eco-socialist posters and Buckminster Fuller. The dark "Blueprint" mode is liked; the light mode should feel like a DRAFTING TABLE (not a warm content site).\n\n` +
    `READ FIRST (use Read):\n` +
    `- ${ROOT}/.claude/ecodharma-design-brief.md  (the north star + anti-brief + tokens — honor these as hard constraints)\n` +
    `- ${ROOT}/apps/web/src/app/globals.css  (current tokens/components)\n` +
    `- ${ROOT}/apps/web/tailwind.config.ts\n` +
    `- ${ROOT}/apps/web/src/app/layout.tsx  (current shell/nav)\n` +
    `- ${ROOT}/apps/web/src/app/page.tsx  (current hero)\n` +
    `- ${ROOT}/apps/web/src/app/profile/page.tsx  (the patent sheet)\n` +
    `- ${ROOT}/apps/web/src/components/AsciiEarth.tsx\n\n` +
    `DIRECTION to develop (from first principles, be bold and specific):\n` +
    `1. SOLARPUNK TERMINAL. Lean into terminal/teletype: monospace-forward, command-line affordances, a KEYBOARD navigation model (e.g. a command palette / "press a key to go" nav, focus as drafting bracket, j/k or letter keys). Define how this works without sacrificing accessibility or mouse use.\n` +
    `2. MINIMAL & EXPANSIVE. More negative space, fewer boxes, larger silences. Move AWAY from dense boxed cards toward an open canvas with hairline rules, generous margins, a felt baseline grid, and a few bold focal elements. Define the spatial system (grid, spacing scale, when to use a rule vs a box vs pure space).\n` +
    `3. DRAFTING-TABLE LIGHT MODE. Re-spec the light mode so it reads as a drafting table / blueprint-on-paper: cooler, cleaner, more white/vellum + fine ferro/ink lines, less warm-manila-content-site. Give concrete token values and contrast notes (WCAG AA). Keep dark "Blueprint" teal largely as-is but push its minimalism.\n` +
    `4. BOLDER, ECO-SOCIALIST + FULLER. Where to spend boldness: big Fraunces statements with huge silence around them; woodcut/poster-weight moments; Fuller diagram line-work (geodesic, dimension lines) as real structure. One bold thing per screen; everything else quiet.\n` +
    `5. SIGNATURE deepening: how to use the ASCII Earth more (and a DYMAXION constellation map over it); a tasteful RISO HALFTONE treatment on solar/clay fills; draw-on linework motion budget.\n\n` +
    `DELIVERABLE (markdown spec):\n` +
    `- The refined aesthetic thesis in 3-4 sentences.\n` +
    `- Concrete token revisions (light mode especially) — colors with hex, type scale, spacing/rhythm, radius (probably sharper/less rounded), rules.\n` +
    `- Layout & navigation system: the terminal/keyboard model (with specific keys + a command-palette concept), and the minimal/expansive page archetypes (hero, profile, list).\n` +
    `- Component direction: what to strip, what to make bolder; how cells become rules+space.\n` +
    `- Signature elements: ASCII Earth usage, Dymaxion constellation map approach, riso halftone implementation approach (CSS/SVG), motion.\n` +
    `- A PRIORITIZED implementation checklist (highest-impact first) the build agents can execute.\n\n` +
    `Consult the frontend-design skill's ethos: commit to a bold POV, avoid generic AI aesthetics, spend boldness in few places.`,
    { label: 'conceive:visual', phase: 'Conceive', model: 'opus' },
  ),

  // (C) Audit of current output — what reads as regurgitation / buried / poorly formatted
  () => agent(
    `You are auditing the CURRENT EcoDharma profile output for three problems the user named: (1) it sounds like it's REGURGITATING the author's theory instead of giving genuine insight; (2) the good content is BURIED and there's TOO MUCH of it; (3) the FORMATTING isn't great.\n\n` +
    `READ (use Read):\n` +
    `- ${ROOT}/framework/framework.json  (the framework that drives interpretation)\n` +
    `- ${ROOT}/framework/voice/ecodharma-voice@1.0.0.md  (the interpreter's voice/system prompt)\n` +
    `- ${ROOT}/apps/web/src/lib/interpret.ts  (how the profile is generated — Claude prompt + fixture)\n` +
    `- ${ROOT}/apps/web/src/app/profile/page.tsx  (how it's displayed)\n\n` +
    `Produce a sharp, specific PUNCH-LIST (markdown):\n` +
    `- REGURGITATION: quote specific phrases/fields in the voice prompt, framework, or interpret prompt that cause theory-recitation rather than person-centered insight; for each, the fix.\n` +
    `- BURIED / TOO MUCH: what the profile shows that should be cut, collapsed, or progressively disclosed; what the ONE thing a person should see first is; a proposed information hierarchy (what's primary vs secondary vs on-demand).\n` +
    `- FORMATTING: concrete display problems (density, hierarchy, scannability) and fixes.\n` +
    `- A proposed REVISED profile information architecture: the order and prominence of sections so the genuine insight lands first and the framework recedes into support.\n` +
    `Be concrete and cite the actual files.`,
    { label: 'conceive:audit', phase: 'Conceive' },
  ),
])

return { framework_spec, visual_spec, audit }
