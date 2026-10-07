# EcoDharma v4: The Living Altar

**A reflection system for staying aligned with what your life serves**

*Vision, taxonomy, and build plan. By Benjamin Life (@omniharmonic). Drafted 2026-10-07.*

---

## 0. The shift in one paragraph

v1–v3 gave a person a **reading**: an accurate, beautiful mirror of their constitution that they look at once and then put down. v4 turns the reading into the **ground floor of an ongoing practice**. Each person states the prayer of their life. They name the root beliefs that prayer stands on, the paths they take to live it, and the signs that tell them they are living it. Then, week by week, season by season, they reflect on it. Claude helps by bringing in evidence (calendar, projects, conversations), pulling structure out of the reflections, and asking the next good question. Over months the result is a visible, living picture of a soul becoming. It can be seen as a **star of light** in a night sky, or as **a node in the mycelial web** underground. The people co-arising with you form your **Dharma Constellation**.

Before any of that, two things are broken and must be fixed first: **reading accuracy** and **weekly nudges**. Section 1 covers both, because a reflection practice built on a wrong chart, or invitations that read like a confused chatbot, would undermine everything above it.

---

## 1. Fix first: accuracy and nudges

### 1.1 Why the weekly nudges were "random Claude messages"

I pulled the actual nudge emails from Parachute (Aug 24 – Oct 5). Three failure modes, all confirmed:

| Date | What you received | Cause |
|---|---|---|
| Aug 24, Sep 14, Sep 28 | *"I need the person's Ikigai words and chart data to write their weekly dharma nudge. Could you share those?"* — sent as your nudge | **Wrong system prompt.** `lib/nudges.ts` sends the *full reading-generation voice prompt* (`ecodharma-voice@2.0.0.md`, which says "You receive: the person's Ikigai words… their chart data…"), then gives Claude only three clipped fragments. Claude correctly notices the inputs it was promised are missing and asks for them. |
| Same | Those meta-replies went out anyway | **No output check.** Nothing verifies that the text is a nudge and not Claude talking to the developer. |
| Oct 5 | *"A small lever this week — playing to your The Storyteller: At the opening of any community governance gathering…"* | **The fallback is generic.** When Claude fails, `fixtureNudge` sends a trim-tab template from the shared library, not anything particular to you. It also has a grammar bug ("your The Storyteller"). |

Underneath all three: the nudge **never sees what matters**. It gets no gift names (only IDs like `weaver`), no Ikigai words, no chart facts, no trim-tabs, no earlier nudges (so they repeat), and no reflections (there aren't any yet).

**Fix (Phase 0):**

1. Write a dedicated `invitation` prompt that does not reuse the reading voice. It gets the full grounding packet: prayer, gift names with how-they-carry, Ikigai words, 2–3 chart facts, open inquiries, the last reflection, the last 6 invitations, and where the person is in the cycle.
2. Add a **grounding contract**, checked in code before sending. The output must reference at least 2 specific elements from the packet, must not contain meta-phrases ("I need", "could you share", "the person's"), must stay under N words, and must not be too similar to the last 6 invitations. On failure, regenerate once, then use a *personalized* fallback. Never send the meta-reply.
3. Store **which elements each invitation touched** (`invitation_refs`), so the next one can rotate through the person's altar instead of repeating itself.
4. **Replying is reflecting.** A reply to the email or Telegram message becomes a journal entry (Section 5). That is what turns one-way nudges into a dialogue.

The Telegram bot (`lib/bot.ts`) and constellation reads also put `loadVoice()` first. They pass more context so they fail less, but they should get purpose-built prompts in the same pass.

### 1.2 Reading accuracy: bugs found by code review

These are confirmed by reading `services/ephemeris`, not guessed. Each one alone could explain a friend's "this isn't me."

| # | Bug | Who it affects | Severity |
|---|---|---|---|
| A1 | **Midnight births computed as noon.** `main.py`: `b.hour or 12`. In Python `0 or 12 == 12`, so anyone born 00:00–00:59 gets a chart for 12:00–12:59. The Moon is off by about 6°, the ascendant is wrong, and HD gates/lines, type, and authority can all change. | Everyone born in the midnight hour (~4% of people) | **Critical** |
| A2 | **Gene Keys Venus & Pearl sequences use the wrong planets.** The code maps EQ→P.Venus, SQ→D.Mars, Vocation→P.Jupiter, Brand→P.Mars, and omits Core and Pearl. The published Hologenetic Profile structure is: Attraction=D.Moon, IQ=D.Venus, **EQ=P.Mars**, **SQ=P.Venus**, **Core=D.Mars**, **Vocation=D.Mars**, Culture=D.Jupiter, **Brand=P.Sun**, **Pearl=P.Jupiter**. *(Verify against genekeys.com with the golden set before shipping. I'm confident but want it proven.)* | **Every** Gene Keys reading past the Activation Sequence | **Critical** |
| A3 | **Nakshatras are invented.** `interpret.ts` tells Claude to "name real placements (… nakshatras …)", but the ephemeris never computes nakshatras, so Claude makes them up. | Every Vedic lens reading | **High** |
| A4 | **The interpretation layer can contradict the chart.** Nothing checks that a placement named in the prose ("your Venus in Libra", "your 4th house Moon") exists in the computed chart. | Every Claude-written reading | **High** |
| A5 | **Vedic conventions aren't followed.** It uses Placidus houses on a sidereal chart (Jyotish uses whole-sign houses from the lagna) and the true node (Rahu/Ketu are usually the mean node). There are no D9/navamsa, dashas, or nakshatra padas. | Vedic readings | Medium |
| A6 | **HD authority edge cases.** "Self-Projected" is assigned whenever G is defined, but it requires the G center to be *connected to the Throat*. Ego authority isn't split into Ego-Manifested / Ego-Projected. The no-authority case is labelled "Mental" (the canonical name is "Mental/Environmental"). | Some Projectors | Medium |
| A7 | **Boundary sensitivity is hidden.** A gate line spans 0.9375°. The Moon moves that far in ~1.7 h and the ascendant in ~4 min. Births within a few arc-minutes of a gate or line boundary get a confident answer that a ±5-minute birth-time error would flip. | ~5–10% of HD/GK readings | Medium |
| A8 | **Time-zone and place resolution.** Pre-1970 local mean time / war time, DST "fold" hours (01:30 on fall-back night happens twice), and the geocoder picking the wrong same-named town. The resolved UTC offset is never shown back to the person to confirm. | Older births, some places | Medium |
| A9 | **Moshier ephemeris instead of Swiss Ephemeris data files.** Moshier is accurate to arc-seconds, so this almost never changes a sign or gate, but it isn't the canonical setup. | Rare edge cases | Low |

### 1.3 The accuracy program: canonical sources + golden tests

**Principle:** we compute in-house with **Swiss Ephemeris** (the engine Astro.com and most professional software use), and we **prove** it against the canonical oracle for each framework, both in CI and when friends report problems. A runtime dependency on third-party APIs would add cost, latency, and IP risk without adding truth. External APIs serve as **oracles**, not as the engine.

| Framework | Canonical oracle (truth) | How we use it |
|---|---|---|
| Western tropical | Astro.com (Swiss Ephemeris) / Astro-Databank AA-rated births | Golden fixtures: positions within 1′, signs/houses exact |
| Vedic sidereal | Jagannatha Hora / VedAstro (open source) / Prokerala API | Lahiri ayanamsa, whole-sign houses, nakshatra + pada, Rahu/Ketu, D9 |
| Human Design | Jovian Archive / myBodyGraph; **OpenHumanDesign MCP** (already connected but needs authorization in your claude.ai connector settings) | Type, authority, profile, definition, channels, all 26 activations exact |
| Gene Keys | genekeys.com free Hologenetic Profile | All 11 spheres, gate.line exact |
| Ikigai | Not computed, so N/A | — |

**Golden set (~40 subjects), checked into `services/ephemeris/tests/golden/`:**

- 10 AA-rated public births (Astro-Databank) spanning the 1900s–2000s
- Every friend who reported an inaccuracy (with their consent), plus their reference charts from the oracle sites
- Edge cases designed to break things: midnight birth (A1), DST fall-back hour, pre-1970 LMT, southern hemisphere, latitude above 66° (where Placidus fails), births within 2′ of a gate boundary, leap day, unknown time

**Tolerances:** sign, gate, line, type, authority, profile, and every GK sphere must match **exactly**; degrees within 1 arc-minute. CI fails on any mismatch. A property test also compares 1,000 random births between Moshier and SE data files and fails if any gate/line differs.

**Interpretation guard (A3/A4):** we extract every placement claim from Claude's prose (a cheap structured second pass), validate it against the chart JSON, and repair or remove anything unsupported. Claude may describe; it may not assert a placement we didn't compute.

**Remediation:** after the fixes, recompute every stored chart and compare the old and new structure. Anyone whose type, authority, profile, signs, or any gate/line changed gets a regenerated reading and an honest note: *"We found and fixed an error in how we computed part of your chart. Here's what changed."* Accuracy, admitted gracefully, builds trust.

---

## 2. The core idea: a reflexive system of self-inquiry

Self-reflection usually fails in one of two ways. It stays **abstract** ("am I living my purpose?") and never touches Tuesday. Or it collapses into **productivity** (tasks, OKRs) and loses the sacred. The Living Altar holds both by giving the inquiry a **structure that can itself be questioned**.

This is **triple-loop learning**, mapped onto the turning of the year:

| Loop | The question | Where it's held | Natural cadence |
|---|---|---|---|
| **Single loop: Practice** | *Am I doing what I said serves my prayer?* | Paths and Works | Weekly |
| **Double loop: Pattern** | *Are these the right ways to embody it? Are my signs of alignment the right signs?* | Paths and Measures | Monthly / lunar, quarterly |
| **Triple loop: Prayer** | *Is this still the prayer? Are the roots I stand on still true?* | Prayer and Roots | Solstices, equinoxes, solar return (birthday) |

The system's job is to ask the right *depth* of question at the right moment, keep the answers, and show the person how their answers have changed.

---

## 3. The taxonomy

Seven layers, from what is **given** to what is **becoming**. Each one is a typed, versioned object in the data model. Each has a lifecycle, so it can grow, be questioned, and be composted.

```
            ☉  THE PRAYER ─────────── what my life is in service to
           ╱│╲
     DEVOTIONS                        who/what I place on the altar
            │
   ═════════╪═════════  (the horizon: sky above, soil below)
            │
         ROOTS  ───────────────────── the a prioris: why I believe this matters
            │
  CONSTITUTION ────────────────────── the given: charts, gifts, Ikigai (the reading)
            │
         PATHS  ───────────────────── how I embody it: works + practices
            │
       MEASURES ───────────────────── how I know I'm aligned: signs & touchstones
            │
   REFLECTIONS ─── strands ─── INQUIRIES ─── THREADS   (the living record)
            │
   CONSTELLATION ──────────────────── the beings co-arising with me
```

### 3.1 The Constitution: *what you were given* (exists today)

The reading: the four lenses (Western, Vedic, Human Design, Gene Keys), the Ikigai, the gift archetypes (Weaver, Builder, Steward, Healer, Convener, Storyteller, Toolmaker, Guardian, Elder, Seer), and the world-work domains. In v4 it stops being the destination and becomes **the soil everything else grows in**. Every other element can link to the constitution elements it draws on: *"This Path uses my Convener gift and my Gate 7 leadership"*. That linkage is how a reflection becomes specific about *how my unique constitution serves the whole.*

It also contributes **embodiment instruments**: Human Design strategy and authority become standing Measures ("Did I wait to respond?", "Did I decide on emotional clarity, not in the wave?"). The chart becomes a practice, not just a description.

### 3.2 The Prayer: *the North Star*

One living statement of what your life is in service to. It's a prayer rather than a mission statement: offered, not executed. Short (1–3 sentences), in the person's own words, never written *for* them. Claude may offer reflections; the person holds the pen.

- **Versioned like tree rings.** Each re-vowing (usually at a solstice or birthday) creates a new version. Old versions are never deleted; they are the rings of the trunk.
- **Facets** (optional): *For whom* (beings served), *Toward what* (the world it longs for), *Through what* (my particular offering).

### 3.3 Devotions: *what you place on the altar*

The specific beings, places, lineages, and causes the prayer is offered to: *"my daughter," "the Front Range watershed," "the commons movement," "my ancestors."* Devotions make the prayer concrete and relational. They also make constellations computable: two people with overlapping devotions are co-arising whether or not they've met.

### 3.4 Roots: *the a prioris*

The foundational beliefs that explain **why** the prayer matters and **why this way**: *"Small coherent groups change systems faster than institutions." "My healing and the land's healing are one process." "I must be financially self-sustaining to serve well."*

Roots are the most important element for real self-inquiry, because **unexamined roots are where people get stuck.** Every root has a status:

| Status | Meaning | Visual |
|---|---|---|
| `held` | Load-bearing and trusted | Strong, glowing taproot |
| `questioning` | Under live interrogation (linked to an Inquiry) | Root pulses, filaments reaching |
| `composting` | Being released; it served but no longer holds | Root darkens, breaks into soil particles that feed nearby roots |
| `renewed` | Re-examined and re-chosen (it's now a conscious choice) | Root re-brightens, with a ring marking the renewal |

Claude's main reflexive move is noticing when reflections **strain** against a root ("you've said three times this quarter that the funding treadmill is draining you. Is *'I must be self-sustaining'* still true as stated?") and offering to open an Inquiry. Only the person changes a root's status.

### 3.5 Paths: *how you embody it*

The concrete vehicles of the prayer. Two kinds:

- **Works:** projects, roles, offerings, relationships of service (*"Building EcoDharma," "Stewarding OpenCivics pods," "Fathering"*). Each Work is linked to the prayer facets and devotions it serves, the gifts it uses, and its domain.
- **Practices:** recurring disciplines that keep the vessel clean (*"Morning sit," "Sabbath," "Weekly land walk"*).

Paths can link to outside sources through MCP: a Parachute project, a calendar series, a GitHub repo. That lets Claude bring **evidence** into reflections ("this week 70% of your calendar went to Work X, which you rated low on Aliveness last month").

### 3.6 Measures: *how you know you're aligned*

The signs and touchstones a person uses to evaluate embodiment. Every element can be evaluated against **five standing lenses of alignment** (the person can rename or add to them):

| Lens | The question | Reads from |
|---|---|---|
| **Aliveness** | Does this make me more alive, or does it drain me? | Felt sense |
| **Fidelity** | Does this actually serve the prayer and devotions, or just look like it does? | Prayer linkage |
| **Constitution** | Am I working *with* my design (strategy, authority, gifts) or against it? | The chart |
| **Reciprocity** | Is nourishment flowing both ways: am I giving *and* receiving? (the mycelial lens) | Constellation, energy |
| **Fruit** | What evidence in the world shows this bearing fruit? | Outcomes, others' words |

Plus **personal Measures** in the person's own words (*"My kids say I'm present." "I end the week with energy, not depletion."*). Measures are versioned too. Questioning whether you're measuring the right thing is the double loop.

Scores are optional (a 1–5 felt scale), never the headline, and never compared between people. The dashboard shows **qualities and patterns, not grades.** Nothing here should feel like a performance review of your soul.

### 3.7 The living record: Reflections → Strands → Inquiries → Threads

- **Reflection** *(the atomic unit)*. A journal entry: free text or voice, from any surface (web, Telegram, email reply, Claude via MCP). It carries the cadence that prompted it (weekly / lunar / monthly / quarterly / seasonal / solar-return / spontaneous) and optional evidence attachments.
- **Strand** *(the structured data)*. The links between a reflection and the altar elements it touches. Claude proposes them and the person confirms or edits. Each strand has:
  - `element` (a Work, Root, Measure, Gift, Devotion, Person…)
  - `relation`: **embodies · strains · questions · evidences · nourishes · releases · discovers**
  - `charge` (−2…+2): contracted ↔ radiant
  - `quote`: the exact span of the person's words that grounds it
- **Inquiry** *(an open question held over time)*. *"What would it mean to be sustained without hustle?"* Lifecycle: `opened → living → integrated` (with an integration note). Inquiries are how the triple loop actually happens: they turn strain on a root into a held question, and they give future invitations something real to ask about.
- **Thread** *(an emergent pattern)*. Claude periodically proposes patterns across reflections (*"Since July, every mention of teaching carries radiant charge; every mention of fundraising is contracted"*). The person accepts, renames, or dismisses them. Accepted threads become visible currents in the dashboard.

Strands are what make it possible to **see learning and adaptation over time**: every reflection is a set of typed, charged edges into a graph that changes as the person changes.

### 3.8 Cycles: *the ritual calendar*

| Cadence | Depth | Shape (~minutes) | Example invitation |
|---|---|---|---|
| **Weekly** (person picks the day) | Single loop | 3–5 prompts, ~10 min | *"Which moment this week most felt like your prayer in motion? Which Work drained you, and was it the work or the way?"* |
| **Lunar** (new/full moon, optional) | Single → double | 1 prompt | *New moon: what are you planting? Full moon: what's ripening?* |
| **Monthly** | Double loop | Review the month's strands + one Measure check | *"Your Constitution measure has dipped. Where did you override your authority?"* |
| **Quarterly** | Double loop | Path review: start / tend / release | *"Which Path would you not choose again knowing what you know now?"* |
| **Equinoxes / Solstices** | Triple loop | Prayer + Roots review | Spring: seed intention · Summer: full expression · Autumn: harvest & release · Winter: compost & re-vow |
| **Solar return** (birthday) | Triple loop, the deepest | Annual ring: re-vow the Prayer; Claude assembles the year's story | *"Here is the year in your own words. Who has this year made you?"* |

Seasons follow the person's **hemisphere** (bioregion is already stored). We can also offer **transit context** for annual and seasonal rituals ("Saturn is crossing your natal Sun this season, a classic time of structural re-commitment"), but only after the accuracy program is green, and always framed as mirror, never prediction.

### 3.9 Constellation: *the beings co-arising with you*

The existing constellations and pods become **Dharma Constellations**, with typed relationships:

| Role | Meaning |
|---|---|
| **Kin** | Shares devotions or prayer facets; co-arising |
| **Witness** | Allowed to see selected reflections; holds you in your becoming |
| **Accountability partner** | A reciprocal pact: you check in on each other's cycles |
| **Mentor / Elder** | Has walked further along a path you're on |
| **Collaborator** | Shares a Work |

**Shared elements:** a constellation can hold a *shared prayer* and *shared works*, so a pod becomes a visible co-arising body with its own rings over time.

**Resonance discovery (opt-in only):** people who mark themselves discoverable can be matched by semantic similarity of prayer, devotions, and works, plus complementarity of gifts (the HD relational engine already exists). Nothing private is ever matched. The existing Postgres RLS consent gate stays load-bearing.

**Privacy default:** reflections are **private**. A person can **offer** a specific reflection or excerpt to a constellation, the same way you'd share a dream in circle.

---

## 4. The visual language: *Sky and Soil*

The same graph, seen two ways. One toggle, and the camera travels **through the horizon line**.

### 4.1 Sky: *the star of light* (above the horizon)

- **The Prayer is the central star.** It breathes slowly (about a 5-second cycle). Its brightness reflects the *recency and warmth* of reflection, not a score. A neglected altar dims gently; it never turns red.
- **The natal sky is the backdrop.** Your actual natal planets are placed on the celestial sphere at their true longitudes (from the corrected ephemeris). The constitution is literally the sky you were born under.
- **Gifts** are the bright named stars of your personal constellation, linked by fine lines like a star chart.
- **Works** orbit the Prayer. Orbit radius = Fidelity (closer = more aligned); glow = Aliveness. Over months you can watch a Work spiral inward or drift out.
- **Reflections** fall as stardust and accumulate into **nebulae** around the elements they touched. Radiant charge glows warm gold; contracted charge glows cool violet.
- **Dharma Constellation:** kin appear as neighboring stars with luminous threads. Shared works are bridges of light. In the group view the whole constellation rotates in 3D as one body.

### 4.2 Soil: *the mycelial web* (below the horizon)

- **Roots** are taproots descending from the Prayer's trunk. Status sets their look: held (strong amber), questioning (pulsing filaments), composting (dissolving into particles that drift to feed neighbors), renewed (a bright ring).
- **Practices** are the fine hyphae: the everyday network.
- **Each new reflection sends a pulse** of light along the hyphae to every element it touched. This is the "it's alive" moment.
- **Reciprocity is visible as flow.** Nutrient particles move between you and constellation members in proportion to mutual support (accountability check-ins, witnessed reflections). One-way flow shows up as an asymmetry you can *see*.
- **Inquiries** are glowing spore-bodies at the points of strain: questions actively fruiting.

### 4.3 Becoming: *time* (the third view)

- **The Year Spiral.** Time as a spiral, one turn per year, marked at solstices, equinoxes, and the solar return. Every reflection is a point colored by charge. Threads show up as bands of color across the spiral.
- **Tree Rings.** A cross-section of the trunk, one ring per Prayer version. Click a ring to read who you were.
- **Element histories.** Any Root, Work, or Measure shows its life story: born, questioned, renewed, composted.

### 4.4 Aliveness principles

1. **Breath, not blink.** Every ambient motion runs on slow sinusoidal cycles (4–8 s). No spinners, no bounce.
2. **Cause → pulse.** Every person action (a reflection saved, a root re-chosen) causes a visible event that travels through the graph.
3. **Seasonal light.** Ambient palette shifts with the person's actual season and moon phase.
4. **Germination & composting.** New elements grow in over ~2 s; retired ones decompose rather than vanish.
5. **Calm by default, reduced-motion safe.** Every animation has a still fallback. The Blueprint (dark) theme maps naturally to Sky and Newsprint (light) to a parchment Soil, so the existing visual system extends instead of being replaced.
6. **Tech:** `three.js` via `@react-three/fiber` for Sky and Constellations (this deliberately breaks the v3 "no new dependencies" rule; 3D needs it). WebGL/canvas with `d3-force` for Soil. SVG for Spiral and Rings. Everything is lazy-loaded so the reading page stays fast.

### 4.5 The dashboard: *Soul's Becoming*

```
┌───────────────────────────────────────────────────────────────────────┐
│  ☾ waxing gibbous · 14 days to Winter Solstice · next: weekly (Sun)   │
├──────────────────────────────────────────┬────────────────────────────┤
│                                          │  THE PRAYER  (v3 · Jun 21) │
│        [  SKY  |  SOIL  |  BECOMING  ]   │  "…"                       │
│                                          ├────────────────────────────┤
│           (the living visualization)     │  OPEN INQUIRIES (2)        │
│                                          │  ROOTS IN QUESTION (1)     │
│                                          │  THIS SEASON'S THREADS     │
├──────────────────────────────────────────┴────────────────────────────┤
│  JOURNAL  · latest reflections with their strands highlighted inline  │
│  [ + Reflect now ]   [ Begin weekly ritual ]                          │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 5. Surfaces: where the practice happens

### 5.1 Claude via MCP (the deepest surface)

This is where the system gets its specificity. Claude can pull in the person's **other sources** (calendar, Parachute, email, project docs) to ground a reflection in what actually happened, then write structured results back. Proposed hosted MCP tools (extending today's `my_reading`, `reflect`, `my_constellations`, `get_framework`):

| Tool | Purpose | Writes? |
|---|---|---|
| `get_altar` | Prayer, devotions, roots (with status), paths, measures, open inquiries, accepted threads | — |
| `get_ritual` | What's due now (cadence + depth) and the tailored prompt set | — |
| `log_reflection` | Save an entry with cadence, text, and evidence links | ✔ |
| `propose_strands` / `confirm_strands` | Claude proposes structured links; the person confirms | ✔ (needs confirmation) |
| `list_reflections` | By date range, element, relation, charge | — |
| `open_inquiry` / `update_inquiry` | Hold and integrate questions | ✔ |
| `propose_element_change` | Suggest a new Path, a root status change, or a prayer revision, **as a diff the person must accept** | ✔ (needs confirmation) |
| `get_becoming` | Time series: charges per element, measure trends, thread evolution | — |
| `constellation_pulse` | Consented shared reflections and accountability check-ins from your constellations | — |
| `assemble_story` | Narrative for a period (season, year) in the person's own quoted words | — |

**Governing rule: *the person holds the pen.*** Claude can read, propose, and structure. It can never silently rewrite a Prayer, Root, or Measure. Every change to the altar's core is a proposed diff that the person accepts.

**Example flow (weekly, in Claude):** *"Do my EcoDharma weekly."* Claude calls `get_ritual`, reads the week's calendar and Parachute notes, and asks 3 grounded questions ("You spent 11 hours on the Foodshed build. Your Path note says it's 'in service of the watershed devotion.' Did it feel that way?"). It then calls `log_reflection` and proposes strands; the person confirms. Claude notices strain on a root and offers an inquiry.

### 5.2 Telegram (the daily-life surface)

- Ritual invitations arrive on the person's chosen day and time. **Replying is reflecting**: the text or **voice note** is transcribed and saved as a Reflection, and the strands are proposed back as quick-confirm buttons.
- Commands: `/reflect`, `/inquiry`, `/prayer`, `/ritual`, `/pulse` (your constellation).
- Accountability: *"Ana completed her weekly. Want to send her a witness note?"*

### 5.3 Email

Invitations rebuilt per §1.1. **Reply-to-reflect** uses Resend inbound, and the reply becomes a Reflection.

### 5.4 Web

The dashboard (§4.5), guided ritual flows for each cadence, the journal, and the altar editor.

---

## 6. Data model (Postgres, extending today's schema)

```sql
-- One altar per person; elements are typed + versioned.
altar_elements (
  id, user_id,
  kind        -- prayer | devotion | root | work | practice | measure | inquiry | thread
  title, body,
  status      -- kind-specific: held|questioning|composting|renewed ; opened|living|integrated ; active|retired
  version, supersedes_id,          -- tree rings: never update in place, append
  constitution_refs jsonb,         -- [{lens, ref}] links into the reading (gift ids, gates, placements)
  external_refs jsonb,             -- parachute note, calendar series, repo…
  created_at, retired_at
)
element_links (from_id, to_id, relation)          -- work→devotion "serves", root→prayer "grounds"…
reflections (id, user_id, cadence, source, body, voice_url, evidence jsonb, ritual_id, created_at)
strands (reflection_id, element_id, relation, charge smallint, quote, proposed_by, confirmed_at)
alignment_readings (reflection_id, element_id, lens, value smallint, note)
rituals (id, user_id, cadence, depth, due_at, prompt_set jsonb, completed_reflection_id)
invitations (id, user_id, ritual_id, channel, body, refs jsonb, sent_at, reply_reflection_id)
                                                   -- replaces `nudges`
constellation_roles (constellation_id, user_id, role)        -- kin|witness|accountability|mentor|collaborator
shared_offerings (reflection_id, constellation_id, excerpt, offered_at, revoked_at)
discoverability (user_id, on boolean, embedding vector)      -- opt-in resonance
```

All new tables use **owner-only RLS**, plus the existing consent gate for anything that crosses people. Reflections are the most intimate data in the system, so they get at-rest encryption at minimum. Whether to offer an end-to-end mode, where server-side Claude can't read entries, is an open question (§8).

**Parachute mirror (yours, optional):** reflections and prayer versions can sync into your own vault as `capture/reflection` notes, so your second brain holds your soul's record too.

---

## 7. Build plan

| Phase | Scope | Outcome |
|---|---|---|
| **0. Repair** *(first, ~1–2 wks)* | A1–A9 fixes · golden set + CI · interpretation guard · recompute + "what changed" notices · nudge rewrite with grounding contract | Readings provably correct; invitations personal |
| **1. Altar + Journal** | Tables · altar editor (Prayer, Devotions, Roots, Paths, Measures) seeded from the reading · journal · strand proposal/confirm · MCP tools v2 | The practice exists |
| **2. Cycles** | Ritual engine (weekly → solar return, hemisphere-aware) · invitations on email + Telegram · reply-to-reflect · voice notes · inquiries | The practice is ongoing |
| **3. Soul's Becoming** | Sky, Soil, and Becoming views · pulses, breath, seasonal light · reduced-motion fallbacks | The practice is visible and alive |
| **4. Dharma Constellations** | Roles · shared prayer/works · witness offerings · accountability pacts · opt-in resonance discovery · 3D group constellation | The practice is shared |
| **5. Evolution intelligence** | Thread detection · root-strain detection · seasonal/annual story assembly · transit-aware rituals | The practice learns |

Phase 0 is fully specified above and can start immediately. Phases 1–2 are where the taxonomy gets tested against real use, so I'd dogfood them with you and 3–5 friends before building the visuals around them.

---

## 8. Decisions for you

1. **Naming.** "The Prayer" and "The Altar" carry sacred weight; some users may want "North Star" / "Dashboard." I'd keep the sacred names, with a one-time option for plainer labels.
2. **Scores.** Should the five alignment lenses offer an optional 1–5 felt scale (it powers trend lines), or stay purely qualitative? I recommend optional and hidden by default.
3. **Privacy depth.** Is server-side encryption at rest enough, or do you want an E2E "sealed journal" mode where Claude can only read entries on surfaces the person runs (their own Claude via MCP)?
4. **Free vs. premium.** My suggestion: reading + weekly ritual free; Claude-powered strands, MCP, Telegram, seasonal story, and constellation features premium.
5. **OpenHumanDesign MCP.** It needs authorization in your claude.ai connector settings before I can use it as a test oracle for the golden set.
6. **Friend reports.** I need the specific friends' birth data and what they said was wrong, with their consent, as golden cases. If those reports are in Parachute or Telegram, point me at them and I'll pull them.

---

*Grounded in a code review of `services/ephemeris`, `apps/web/src/lib/{nudges,bot,interpret,voice}.ts`, and the MCP routes, and in the actual nudge emails archived in Parachute (Aug 24 – Oct 5, 2026).*
