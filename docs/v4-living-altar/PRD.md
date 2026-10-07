# EcoDharma v4: The Living Altar
## Product Requirements Document

*By Benjamin Life (@omniharmonic). v1.0, 2026-10-07. Companion docs: [Vision & Taxonomy](./VISION_AND_TAXONOMY.md) · [Technical Architecture](./TECHNICAL_ARCHITECTURE.md) · [Implementation Plan](./IMPLEMENTATION_PLAN.md)*

---

## 1. Summary

EcoDharma v1–v3 produced a **reading**: a multi-lens portrait of a person's gifts (Western and Vedic astrology, Human Design, Gene Keys, Ikigai), read through a framework of regenerative civilization. People look at it once and put it down.

v4 turns the reading into the ground of an **ongoing reflection practice**. Each person states the **Prayer** of their life, names the **Roots** it stands on, the **Paths** they take to live it, and the **Measures** that tell them they're living it. Then they reflect on a living ritual calendar (weekly, lunar, monthly, quarterly, solstice and equinox, solar return). Claude reads those reflections, structures them into a graph, asks the next good question, and pulls in evidence from the rest of the person's life through MCP. The result is shown as **Soul's Becoming**: a living systems dashboard with sacred flourishes, rendered as a star in a night sky (**Sky**), a node in a mycelial web (**Soil**), and a spiral of time (**Becoming**). The people co-arising with you form your **Dharma Constellation**.

**Aesthetic north star:** *immanent metaphysics × cybernetic living systems × sacred geometry.* It should feel like a mission-control console for a soul: feedback loops, signal flows, and phase states, drawn with the care of an illuminated manuscript and the motion of a living organism.

## 2. Problem

1. **Readings are static.** One-time insight decays. Nothing helps a person *live* their reading.
2. **Readings were inaccurate.** Friends reported readings that didn't fit them. A code audit found critical computation bugs (midnight births, Gene Keys sphere mapping, invented nakshatras, prose that can contradict the chart). Trust has to be repaired before anything else is built on it.
3. **Nudges were broken.** The weekly email sent Claude's meta-replies ("I need the person's Ikigai words…") and generic templates instead of personal invitations.
4. **Reflection tools split the sacred from the practical.** Journaling apps lack structure. Goal and OKR tools lack soul. Nothing holds *what my life is for* together with *what I did on Tuesday*, or lets the frame itself evolve.

## 3. Goals and non-goals

### Goals
- **G1 Accuracy.** Every computed placement is provably correct against independent oracles. CI enforces it.
- **G2 Continuity.** People return weekly. The practice deepens over seasons and years.
- **G3 Reflexivity.** The system supports single, double, and triple-loop inquiry: action, method, and purpose can all be questioned.
- **G4 Specificity.** Reflections connect concretely to the person's constitution (chart, gifts) and to real evidence (their work, calendar, notes).
- **G5 Aliveness.** The dashboard feels alive and responsive: every reflection visibly changes the living picture.
- **G6 Kinship.** People see and support each other's becoming in Dharma Constellations, with consent at every boundary.
- **G7 Sovereignty.** The person holds the pen. AI proposes; only the person changes their Prayer, Roots, or Measures.

### Non-goals (v4)
- Prediction, fortune-telling, or deterministic claims.
- Public social network or feeds.
- Reproducing proprietary Human Design or Gene Keys text.
- E2E encryption (server-side encryption at rest is enough for the friends-and-family audience; revisit before public launch).
- Native mobile apps (PWA + Telegram + Claude cover mobile).

## 4. Audience

**Phase audience: Benjamin plus friends and family (~10–50 people).** That allows invite-only access, a high-touch onboarding, fast iteration, and qualitative feedback over metrics. The design should still scale to a public launch.

| Persona | Need |
|---|---|
| **The Practitioner** (Benjamin) | Deep MCP integration with Claude and Parachute; seasonal rituals; sees how years of work relate to the prayer |
| **The Seeker friend** | Gentle onboarding from an accurate reading into a first Prayer; weekly Telegram or email ritual that takes 10 minutes |
| **The Pod / Constellation** | A shared prayer, accountability pairs, witnessing each other's offerings |

## 5. Product principles

1. **The person holds the pen.** AI never silently edits the Prayer, a Root, or a Measure. Changes are proposed diffs that need explicit acceptance.
2. **Mirror, not oracle.** Chart-derived content is reflective, never predictive.
3. **Truth before beauty.** No visualization or invitation is built on an unverified chart.
4. **Qualities over grades.** Alignment can be qualitative *and* quantitative, but numbers are never the headline, never compared across people, and never shaming. A neglected altar dims; it never turns red.
5. **Breath, not blink.** Motion is slow, organic, and meaningful. Every animation shows a real state change.
6. **Private by default, offered by choice.** Reflections are private. Sharing is a deliberate act of *offering*.
7. **Compost, don't delete.** Retired elements keep their history; growth is visible.

## 6. Feature requirements

Priorities: **P0** must ship for v4 · **P1** should ship · **P2** later.

### 6.1 Accuracy repair (Phase 0): P0

| ID | Requirement |
|---|---|
| ACC-1 | Fix midnight-birth bug (hour 0 treated as missing) |
| ACC-2 | Correct Gene Keys sequences: Attraction=D.Moon, IQ=P.Venus, EQ=P.Mars, SQ=D.Venus, Core=D.Mars, Vocation=D.Mars, Culture=D.Jupiter, Brand=P.Sun, Pearl=P.Jupiter (+ Activation: Life's Work=P.Sun, Evolution=P.Earth, Radiance=D.Sun, Purpose=D.Earth) |
| ACC-3 | Compute Vedic nakshatra + pada for Moon, Lagna, and all grahas; whole-sign houses from lagna; Rahu/Ketu (mean node) for Vedic |
| ACC-4 | HD authority rules: Self-Projected requires G→Throat connection; Ego-Manifested vs Ego-Projected; "Mental/Environmental" naming |
| ACC-5 | Boundary-sensitivity flags: any activation within 5′ of a gate or line boundary, or a time-sensitive field that would flip within ±10 minutes of the birth time, is marked `sensitive` and shown with a gentle caveat |
| ACC-6 | DST-fold/gap detection; show the resolved UTC offset and place back to the person for confirmation |
| ACC-7 | Swiss Ephemeris data files (SE) instead of Moshier when available, with Moshier fallback |
| ACC-8 | Differential oracle test suite: ≥1,000 randomized births compared against an independent engine (`natalengine` on `astronomy-engine`), plus a curated golden set of edge cases. Zero unexplained mismatches |
| ACC-9 | Interpretation guard: every placement claim in AI prose is validated against chart JSON; unsupported claims are repaired or removed |
| ACC-10 | Recompute all stored charts; diff the structure; regenerate affected readings; notify the person with an honest "what changed" note |

### 6.2 Invitations (nudges rebuilt): P0

| ID | Requirement |
|---|---|
| INV-1 | A dedicated invitation prompt (never the reading voice), fed a grounding packet: Prayer, gift names + how carried, Ikigai words, chart facts, open inquiries, last reflection, last 6 invitations, cycle position |
| INV-2 | Grounding contract checked before sending: ≥2 packet references, no meta-language, length bounds, novelty vs recent invitations. One retry, then a *personalized* deterministic fallback |
| INV-3 | Invitations store `refs` (the element ids they touched) and rotate across the altar |
| INV-4 | Reply-to-reflect: replies via Telegram (and email when inbound is configured) become Reflections |
| INV-5 | Each person chooses their ritual day, time, channel(s), and time zone |

### 6.3 The Altar: P0

| ID | Requirement |
|---|---|
| ALT-1 | The person can create and edit a **Prayer** (versioned; every revision appends a new version, like a tree ring) with optional facets: *for whom / toward what / through what* |
| ALT-2 | **Devotions:** beings, places, causes, lineages the prayer is offered to |
| ALT-3 | **Roots:** a prioris with status `held · questioning · composting · renewed`, each status change logged with a note |
| ALT-4 | **Paths:** Works (projects, roles, offerings) and Practices (disciplines), each linkable to devotions, gifts (constitution refs), and external refs (URLs, Parachute notes) |
| ALT-5 | **Measures:** the five standing lenses (Aliveness, Fidelity, Constitution, Reciprocity, Fruit), plus personal measures in the person's words; versioned |
| ALT-6 | **Seeding:** first-run "altar kindling" flow offers a starting draft drawn from the reading (gifts → candidate Paths; HD strategy/authority → Constitution measures; Ikigai → Prayer prompts). The person writes the Prayer themselves; Claude offers only questions and reflections |
| ALT-7 | Retiring an element composts it (keeps history, renders as decomposing) rather than deleting it |
| ALT-8 | Constitution refs: any element can cite the reading elements it draws on (gift ids, HD gates/centers, placements) |

### 6.4 Journal and Reflections: P0

| ID | Requirement |
|---|---|
| JRN-1 | Create a Reflection from web, Telegram (text or voice), MCP, or email reply; tagged with cadence and source |
| JRN-2 | Encrypted at rest (AES-256-GCM, server-held key, key versioning) |
| JRN-3 | **Strands:** Claude (or the deterministic extractor when Claude is off) proposes typed links: element + relation (`embodies · strains · questions · evidences · nourishes · releases · discovers`) + charge (−2…+2) + grounding quote. The person confirms, edits, or rejects |
| JRN-4 | **Alignment readings:** per reflection, optional per-lens values (1–5) with qualitative notes, per element or overall |
| JRN-5 | **Inquiries:** open questions with lifecycle `opened → living → integrated` and an integration note |
| JRN-6 | Journal view: chronological, filterable by element, relation, cadence, and charge; strands highlighted inline |
| JRN-7 (P1) | **Threads:** Claude proposes cross-reflection patterns; the person accepts, renames, or dismisses |
| JRN-8 (P1) | **Root-strain detection:** repeated `strains` on a Root triggers an offer to open an Inquiry |

### 6.5 Cycles (the ritual calendar): P0

| ID | Requirement |
|---|---|
| CYC-1 | Cadences: weekly (person-chosen day), lunar (new/full moon, opt-in), monthly, quarterly, equinoxes and solstices (hemisphere-aware), solar return (computed exactly from the natal Sun) |
| CYC-2 | Each cadence has a **depth** (single, double, triple loop) and a tailored prompt set |
| CYC-3 | A guided ritual flow on web (step through prompts → reflection → strand confirmation) |
| CYC-4 | "What's due" computed per person; shown on the dashboard, sent as invitations, and exposed over MCP |
| CYC-5 (P1) | Seasonal and annual **Story**: Claude assembles the period's narrative from the person's own quoted words |
| CYC-6 (P2) | Transit context for seasonal and annual rituals (mirror framing only) |

### 6.6 Soul's Becoming dashboard: P0 (core views), P1 (full polish)

| ID | Requirement |
|---|---|
| VIZ-1 | **Sky:** 3D celestial sphere; Prayer as central breathing star; natal planets at true longitudes on the ecliptic ring; gifts as named stars with constellation lines; Works orbit at radius ∝ (1 − Fidelity), glow ∝ Aliveness; reflections as stardust nebulae; Dharma Constellation kin as neighboring stars |
| VIZ-2 | **Soil:** mycelial network; Roots as taproots styled by status; Practices as hyphae; Inquiries as fruiting bodies; a pulse travels the network on each new reflection; reciprocity shown as nutrient flow |
| VIZ-3 | **Becoming:** year spiral (one turn per year, solstices, equinoxes, and solar return marked; reflections as points colored by charge) + tree rings (one per Prayer version) + element life histories |
| VIZ-4 | **Cybernetic console chrome:** live telemetry readouts (cycle phase, moon phase, season, days to next threshold, loop state), feedback-loop diagrams, signal-flow traces: "mission control for a soul" |
| VIZ-5 | **Sacred flourishes:** sacred-geometry overlays (Flower of Life lattice, vesica, Metatron lines) at low opacity; glyph sets for planets, signs, HD centers; illuminated drop-caps on the Prayer |
| VIZ-6 | **Living motion:** breath cycles (4–8 s), pulses on cause, germination and composting transitions, seasonal palette shift, real moon phase |
| VIZ-7 | Reduced-motion and low-power fallbacks (static SVG renders); 60 fps on a mid-range laptop; dashboard interactive < 2.5 s |
| VIZ-8 | Works in both Blueprint (dark, default) and Newsprint (light) themes |

### 6.7 MCP v2 (Claude integration): P0

Hosted JSON-RPC endpoint (existing OAuth). Tools: `get_altar`, `get_ritual`, `log_reflection`, `propose_strands`, `confirm_strands`, `list_reflections`, `open_inquiry`, `update_inquiry`, `propose_element_change`, `get_becoming`, `constellation_pulse`, `assemble_story`, plus the existing `my_reading`, `reflect`, `my_constellations`, `get_framework`. Write tools that change the core altar return a **proposal** the person accepts in the web app (or with an explicit `confirm` call made after the person has said yes in chat).

### 6.8 Telegram: P0

| ID | Requirement |
|---|---|
| TG-1 | Ritual invitations delivered at the chosen time |
| TG-2 | Replying to an invitation (text) creates a Reflection linked to that ritual; voice notes transcribed (P1, when a transcription key is configured) |
| TG-3 | Commands: `/reflect <text>`, `/ritual`, `/prayer`, `/inquiry <question>`, `/pulse`, `/help` |
| TG-4 | Proposed strands are returned as a compact summary with an "open in app to confirm" link (inline buttons P1) |

### 6.9 Dharma Constellations v2: P1

| ID | Requirement |
|---|---|
| CON-1 | Member roles: kin, witness, accountability, mentor, collaborator |
| CON-2 | Shared Prayer and shared Works for a constellation (versioned) |
| CON-3 | **Offerings:** a person offers a Reflection (or excerpt) to a constellation; revocable |
| CON-4 | Accountability pacts: partners see each other's ritual completion (not content) and can send a witness note |
| CON-5 | Constellation view in Sky (3D group) and Soil (shared mycelium) |
| CON-6 (P2) | Opt-in resonance discovery by Prayer, Devotion, and Work similarity plus gift complementarity |

### 6.10 Evolution intelligence: P1–P2
Threads (JRN-7), root strain (JRN-8), Story (CYC-5), transit context (CYC-6), year-in-review at solar return.

## 7. Key user journeys

1. **Kindling (first run, ~15 min).** Accurate reading → "What is your life in service to?" Three prompts (Ikigai-grounded) → the person writes a Prayer → names 1–3 Devotions → accepts or edits suggested Paths and Measures → chooses ritual day and channel → sees their Sky light up for the first time (the Prayer star ignites).
2. **Weekly ritual (Telegram, ~5 min).** Sunday 7pm: an invitation grounded in a specific Work and Measure → the person replies → a Reflection is saved and strands are proposed → the dashboard pulses next time they open it.
3. **Weekly ritual (Claude + MCP, ~15 min).** "Do my EcoDharma weekly." → `get_ritual` → Claude reads calendar and Parachute for evidence → asks 3 grounded questions → `log_reflection` + `propose_strands` → the person confirms in chat → Claude notices root strain and offers an Inquiry.
4. **Solstice (web, ~45 min).** A triple-loop ritual: review the season's Story, each Root's status, the Prayer → write a new Prayer version → a new tree ring forms; composting Roots dissolve into soil.
5. **Constellation.** The person offers a Reflection to their pod → an accountability partner sends a witness note → Reciprocity flow appears in both people's Soil views.

## 8. Success metrics (friends-and-family phase)

| Metric | Target |
|---|---|
| Oracle mismatches in CI | **0** unexplained |
| Invitations failing the grounding contract that reach a person | **0** |
| People who complete Kindling | ≥ 80% of invited |
| Weekly ritual completion (rolling 4 weeks) | ≥ 50% |
| Seasonal (solstice/equinox) ritual completion | ≥ 60% of active |
| Qualitative: "this feels alive / true to me" | majority yes in interviews |
| Strand confirmation rate (accepted as proposed or edited) | ≥ 70% (proposal quality signal) |

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Chart computations still wrong somewhere | Triangulated oracles, golden edge cases, boundary flags, honest "what changed" notes |
| AI over-reach on sacred material | Pen-holding principle enforced in the API (proposals only); voice guidelines; no AI-written Prayers |
| Gamification creeping in | No streaks, no leaderboards, no red states; numbers optional and secondary |
| Intimate data exposure | Encryption at rest, owner-only RLS, consent-gated offerings, minimal data in invitations |
| 3D performance on low-end devices | Lazy-load, LOD, reduced-motion static fallback |
| IP (HD/GK text) | Positions and structure only; original language |

## 10. Decisions log

| Decision | Status |
|---|---|
| Sacred names (Prayer, Altar, Roots, Devotions…) | **Adopted** |
| Alignment: qualitative and/or quantitative (1–5), person's choice | **Adopted** |
| Journal encryption: server-side at rest | **Adopted** (revisit pre-public) |
| Audience: friends and family | **Adopted** |
| HD oracle: OpenHumanDesign MCP unavailable → independent-engine differential testing (`natalengine`/`astronomy-engine`) + manual spot checks | **Adopted** |
| Friends' reports had no specific errors → broad differential + golden edge-case testing instead of case-by-case | **Adopted** |
