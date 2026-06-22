# EcoDharma Framework v2 — Design Spec

A redesign of the load-bearing framework artifact so it reads as *a wise, general map of how a person participates in the Great Turning* — organized on Joanna Macy's spine, textured (not dominated) by the corpus.

Files reviewed: `framework/framework.json` (v1.1.0), `.claude/ecodharma-prd.md`, and the four wiki sources.

---

## 1. Diagnosis — what reads as too-bespoke in v1

**A. Domain descriptions are jargon-dense paragraphs, not plain orientation.**
Example (`economic-regenerative`): *"composting capital back into communities… community currencies, land trusts… bioregional finance, and pluralistic capital allocation… driving marginal costs toward zero through digital un-enclosure."* A stranger cannot parse this; it presumes the corpus.
→ **Principle:** a domain is named by the *human activity*, described in **one plain sentence**, with 3-4 concrete examples. All neologisms move to an optional glossary, never the primary description.

**B. Several gifts are corpus-coded, not universal.**
`The Protocol-smith` is defined by *"zero-knowledge identity, programmable treasuries, federation protocols… civic vibe coding."* That is a web3 builder, not a universal contribution-type. Someone who designs a school's daily rhythm, writes an open-source library, or codifies a community's conflict-resolution ritual is the *same gift* and won't recognize themselves.
→ **Principle:** gift names must be archetypes a stranger in any walk of life can claim. Rename to **The Toolmaker**.

**C. Lineage is name-dropped inside every node instead of credited once.**
Four gifts open with *"Extends Joe Lightfoot's ___ archetype."* This makes the artifact read like a derivative gloss on specific authors rather than its own coherent map.
→ **Principle:** credit Macy, Fuller, Lightfoot, Eisenstein, Thich Nhat Hanh **once** in a top-level `lineage` block. Nodes then speak plainly in the framework's own voice.

**D. The connective field name and rationale are re/acc-branded.**
`upward_spiral_logic` on every trim-tab encodes one author's house theory. The *idea* (a small move that compounds) is universal — it's Fuller's trim-tab — but the label and framing are bespoke.
→ **Principle:** rename to `why_it_compounds`, written in plain cause-and-effect. The compounding intuition is the universal soul; the re/acc vocabulary is the disposable shell.

**E. Four gifts carry in-group spiritual-political myth as their literal definition.**
`The Diagnostician` ("name the spiritual sickness… *wetiko*… *egregore*"), `The Composter` ("compost accumulated extractive capital"), `The Way-shower` ("die before you die… Christ consciousness as collective emergence"), `The Shambhala Warrior` ("the corridors where the weapons of the old story are made"). These are evocative but legible only to the converted.
→ **Principle:** keep the *function*, shed the myth. Generalize to **The Seer** (perceives hidden patterns and what's emerging) and **The Guardian** (protects and resists harm). Fold **The Composter** into **The Steward** (tending decay into fertility is stewardship). Macy's Shambhala image becomes *texture* inside The Guardian, credited, not a node name.

**F. `modality_signals` are over-specified and over-asserted.**
Each gift lists up to six nakshatras, multiple Human Design channels, Gene Keys, etc. The sheer density signals an esoteric proprietary ontology and quietly over-claims correspondence — exactly the "bespoke" feel to avoid.
→ **Principle:** cap at **2-3 soft signals per system**, and structurally frame them as priors (the v1 `modality_signals_note` is good — keep it, and make the data honor it).

**G. A 50+ entry `concepts[]` encyclopedia ships inside the framework.**
This turns the artifact into a corpus doctrine-compendium rather than a map of participation.
→ **Principle:** drop `concepts[]` from the framework, or reduce to a **~12-term optional glossary** that *translates* jargon to plain language (for the interpreter's reference, not the user's output).

---

## 2. The v2 structure

### Macy's three dimensions are the spine

Every domain nests under one of Joanna Macy's three dimensions of the Great Turning. This is the organizing change: v1 had eight flat domains with no spine; v2 makes Macy's structure the skeleton and hangs a *lean* set of domains on it.

**Dimension 1 — Holding Actions** *(slowing the damage)*
Work that protects life and buys time: resistance, advocacy, defense, relief, and meeting urgent need now.

**Dimension 2 — Life-Sustaining Systems** *(building the new)*
Macy's "Gaia structures": the parallel economies, governance, land practices, tools, and knowledge that the future will stand on.

**Dimension 3 — Shift in Consciousness** *(the ground)*
The perceptual and spiritual reorientation — from separation to interbeing — that makes the other two possible and keeps them from reproducing what they oppose.

### Domains (9 — lean, general, one line each)

| # | Domain | Dimension | One-line description |
|---|--------|-----------|----------------------|
| 1 | **Protection & Advocacy** | Holding Actions | Defending people, places, species, and rights from harm — resisting and slowing extraction. |
| 2 | **Care & Relief** | Holding Actions | Meeting urgent human and ecological needs now, through direct, relational care. |
| 3 | **Land & Living Systems** | Life-Sustaining Systems | Regenerating watersheds, soils, food, and habitat; tending a place over the long term. |
| 4 | **Regenerative Economy** | Life-Sustaining Systems | Building cooperative, community-rooted economies where value circulates and stays local. |
| 5 | **Governance & the Commons** | Life-Sustaining Systems | Growing participatory, place-based self-governance and shared stewardship of common resources. |
| 6 | **Tools & Infrastructure** | Life-Sustaining Systems | Making open, trustworthy technology and shared infrastructure that help communities coordinate. |
| 7 | **Knowledge & Learning** | Life-Sustaining Systems | Stewarding knowledge as a commons; sensemaking and skill that travel between communities. |
| 8 | **Healing & Wholeness** | Shift in Consciousness | Tending wounds in body, psyche, and relationship so belonging can be restored. |
| 9 | **Story, Imagination & the Sacred** | Shift in Consciousness | Shifting perception through narrative, art, ritual, and reverence for the living world. |

*(If a leaner cut is wanted: 6 and 7 can merge into "Tools & Knowledge." I keep them split because the gifts that serve each differ.)*

### Gifts (10 — universal human contributions)

Names a stranger from any walk of life can claim. Each has an `essence`, a `shadow`, and (in the artifact) soft `modality_signals`.

| Gift | Essence | Shadow |
|------|---------|--------|
| **The Weaver** | Connects what was isolated; builds relationships and networks between people and projects. | Becomes the indispensable hub everything routes through; weaves so many threads it turns into bureaucracy. |
| **The Builder** | Brings concrete things into being — enterprises, institutions, working alternatives. | Builds in isolation or at any cost; replicates the extraction or hierarchy it meant to replace. |
| **The Steward** | Tends land, resources, and commons patiently across time; turns endings into fertility. | Control dressed as care; hoards or privatizes what should be held in common; clings past the season. |
| **The Healer** | Turns toward wounds so they can transform; restores people to their bodies and belonging. | Spiritual bypass; selling peak experiences; fostering dependence instead of strength. |
| **The Convener** | Gathers people into containers where collective intelligence and trust can form. | Forces consensus; becomes the gatekeeper deciding who belongs at the table. |
| **The Storyteller** | Gives language and image to what many feel but cannot yet name; shifts how people see. | Optimizes for virality over truth; hardens the living story into doctrine or brand. |
| **The Toolmaker** | Designs tools, systems, and reusable patterns that let others coordinate without a boss. | Mistakes the tool for the relationships it serves; builds power into the tool itself; over-engineers, never ships. |
| **The Guardian** | Protects and defends people, places, and principles; meets harm without becoming it. | Becomes what it fights; armors against grief; turns insight into a weapon against "enemies." |
| **The Elder** | Holds complexity, paradox, grief, and beauty at once; mentors and walks others to thresholds. | Points to a threshold not yet crossed; mistakes a role for an identity; withholds rather than passes the torch. |
| **The Seer** | Perceives the patterns others miss — the hidden fault line *and* the thing trying to be born. | Becomes the perspective it diagnoses; abstraction unmoored from lived practice; prophet without feet on the ground. |

This drops v1 from 12 → 10, folding `Composter` into `Steward`, and generalizing `Protocol-smith → Toolmaker`, `Diagnostician + Way-shower → Seer`, `Shambhala Warrior → Guardian`.

### Trim-tabs (generic, gift-connected)

v1's trim-tabs are over-specific recipes ("issue a community currency whose transaction fees fund local public goods… through staking yield pools"). v2 trim-tabs are **generic, adaptable starting moves** keyed to a gift (and usually a domain), each with a plain `why_it_compounds`. They are *seeds the interpreter adapts to the person's actual life*, not prescriptions. Target ~3-4 per gift (~30-40 total), each readable by a stranger.

Fuller's trim-tab metaphor is credited once in `lineage`; individual nodes don't re-explain it.

---

## 3. The v2 artifact schema (JSON shape)

App-compatible (`domains[]`, `gifts[]`, `trim_tabs[]`, `ikigai_lens`, soft `modality_signals`), plus a `great_turning_dimensions[]` grouping, a `dimension_id` on each domain, a top-level `lineage`, an optional `spiral` (Work That Reconnects movement model), and an `interpretation_guidance` block that shapes the artifact toward *insight, not exposition*.

```json
{
  "framework_version": "2.0.0",
  "voice_ref": "ecodharma-voice@1.0.0",
  "summary": "A general map of how a person participates in the Great Turning — Joanna Macy's name for the shift from an extractive society to a life-sustaining one. It reads a person not as a fixed type but as a living confluence of gifts, and shows where those gifts are most needed across three kinds of work: slowing the damage, building what comes next, and shifting how we see. Every gift carries a shadow. Where a gift meets a need, a small starting move can set a larger change in motion.",

  "lineage": {
    "note": "This framework stands on others' work and names them plainly rather than absorbing their language.",
    "credits": [
      { "name": "Joanna Macy", "contribution": "The Great Turning and its three dimensions; the Work That Reconnects spiral; the Shambhala Warrior teaching that textures The Guardian." },
      { "name": "R. Buckminster Fuller", "contribution": "The trim-tab — the small move that turns the whole ship." },
      { "name": "Joe Lightfoot", "contribution": "Regenerative archetypes that informed several gifts (Weaver, Builder, Steward, Healer, Storyteller)." },
      { "name": "Thich Nhat Hanh", "contribution": "Interbeing." },
      { "name": "Charles Eisenstein", "contribution": "The story of separation and the more beautiful world." }
    ]
  },

  "great_turning_dimensions": [
    { "id": "holding-actions", "name": "Holding Actions", "description": "Work that slows the damage and protects life now — resistance, advocacy, defense, and relief.", "source": "Joanna Macy" },
    { "id": "life-sustaining-systems", "name": "Life-Sustaining Systems", "description": "Building the parallel structures the future will stand on — economy, governance, land, tools, knowledge.", "source": "Joanna Macy" },
    { "id": "shift-in-consciousness", "name": "Shift in Consciousness", "description": "The perceptual and spiritual ground — from separation to interbeing — that makes the rest possible.", "source": "Joanna Macy" }
  ],

  "spiral": {
    "note": "Macy's Work That Reconnects, offered as a movement model the interpreter can use to meet a person where they are — not a required sequence.",
    "stages": [
      { "id": "gratitude", "name": "Coming from Gratitude" },
      { "id": "honoring-pain", "name": "Honoring Our Pain for the World" },
      { "id": "new-eyes", "name": "Seeing with New Eyes" },
      { "id": "going-forth", "name": "Going Forth" }
    ],
    "source": "Joanna Macy"
  },

  "domains": [
    {
      "id": "healing-wholeness",
      "name": "Healing & Wholeness",
      "dimension_id": "shift-in-consciousness",
      "description": "Tending wounds in body, psyche, and relationship so belonging can be restored.",
      "examples": ["somatic and trauma healing", "secure attachment and reparenting", "grief work", "addiction and recovery", "restoring relationship with the body"]
    }
  ],

  "gifts": [
    {
      "id": "the-healer",
      "name": "The Healer",
      "essence": "Turns toward wounds so they can transform, and helps people come home to their bodies and to belonging.",
      "how_it_serves": "Where there is unmetabolized pain — personal or collective — the Healer creates the safety in which it can move and become wisdom rather than armor.",
      "shadow": "Spiritual bypass that skips over the wound; selling peak experiences; fostering dependence instead of strength.",
      "affinity_dimensions": ["shift-in-consciousness", "holding-actions"],
      "modality_signals": {
        "note": "Soft interpretive priors only — the person's actual chart and self-reflection always take precedence.",
        "western": ["Pisces / Neptune (compassion)", "Scorpio / Pluto (depth, transformation)", "Chiron prominent (the wounded healer)"],
        "human_design": ["Emotional (solar plexus) authority", "Channel 25-51 (love of spirit)"],
        "gene_keys": ["25 (Universal Love)", "55 (Freedom through feeling)"]
      }
    }
  ],

  "trim_tabs": [
    {
      "id": "tt-healer-healing-wholeness-grief-circle",
      "gift_id": "the-healer",
      "domain_id": "healing-wholeness",
      "starting_action": "Convene a small, regular circle where people can feel and voice what they're grieving about the world, with no agenda to fix it.",
      "why_it_compounds": "Metabolized grief frees the energy that despair was holding. People who feel held show up for one another again, and the circle becomes a place others can join — care spreading by relationship, not by program."
    }
  ],

  "ikigai_lens": {
    "love": "Does this arise from what the person genuinely loves — the thing they'd do unpaid? Work grounded in love survives difficulty; work grounded in guilt burns out.",
    "skill": "Does it engage their actual gift and competence? Leverage exists only when the right hand is on the trim-tab.",
    "world_need": "Does it serve a real need across one of the three dimensions, with a credible reason it compounds — each turn making the next easier?",
    "livelihood": "Can value circulate back so they can keep showing up for years, not one heroic season? Regeneration that bankrupts its stewards isn't regenerative."
  },

  "interpretation_guidance": {
    "purpose": "These fields exist so the interpreter produces insight ABOUT THE PERSON, not exposition about the model.",
    "do": [
      "Lead with the person's specific configuration of gifts and what it implies.",
      "Name 1-2 primary gifts and 1 latent/emerging gift; tie each to where it is most needed (a dimension + domain).",
      "Offer 2-3 trim-tabs adapted to the person's actual life, place, and stage — not quoted verbatim.",
      "Name the shadow of their primary gift as a personal caution they can watch for.",
      "Use Macy's three dimensions to orient ('your gifts land most in the building work'), and the spiral to meet where they are."
    ],
    "dont": [
      "Do not explain the framework, define the three dimensions, or lecture on the Great Turning unless asked.",
      "Do not recite multiple gifts the person doesn't hold.",
      "Do not assert deterministic correspondence between a chart placement and a gift.",
      "Do not use insider jargon (compost capital, wetiko, d/acc, protocols-of-place) in user-facing output; use plain language."
    ],
    "glossary_for_interpreter_only": {
      "interbeing": "the felt recognition that nothing exists separately (Thich Nhat Hanh)",
      "trim-tab": "a small move that turns a much larger system (Fuller)",
      "compost capital": "redirecting extractive wealth into community-owned systems",
      "cosmolocalism": "share knowledge globally, produce and govern locally"
    }
  }
}
```

Key schema changes vs v1: `great_turning_dimensions[]` + `dimension_id` (new spine); `lineage` (credits consolidated out of nodes); `spiral` (Macy movement model); gift fields renamed to plain `essence`/`how_it_serves`; trim-tab `pattern`→`starting_action`, `upward_spiral_logic`→`why_it_compounds`; `modality_signals` capped and self-labeling; `concepts[]` removed in favor of a small interpreter-only glossary; **new `interpretation_guidance`** that makes "insight not lecture" a property of the artifact.

---

## 4. Concrete sample (new general voice)

**Dimension: Shift in Consciousness** — *the perceptual ground; from separation to interbeing.*

### Domain — Healing & Wholeness
Tending wounds in body, psyche, and relationship so belonging can be restored. *(somatic and trauma healing, secure attachment, grief work, recovery)*

### Domain — Story, Imagination & the Sacred
Shifting how people see through narrative, art, ritual, and reverence for the living world. *(writing and film, ceremony, reframing the future, contemplative practice)*

### Gift — The Healer
- **Essence:** Turns toward wounds so they can transform, and helps people come home to their bodies and to belonging.
- **Shadow:** Bypassing the wound with spiritual language; selling peak experiences; fostering dependence instead of strength.
- **Soft signals:** *Western* — Pisces/Neptune, Scorpio/Pluto, Chiron prominent · *Human Design* — emotional authority · *Gene Keys* — 25 (Universal Love). *(Priors only; the person's reflection rules.)*

### Gift — The Storyteller
- **Essence:** Gives language and image to what many already feel but cannot yet name, and shifts how people see.
- **Shadow:** Chasing virality over truth; hardening a living story into doctrine or personal brand; vision with no feet under it.
- **Soft signals:** *Western* — Sagittarius (meaning), Gemini (language), Neptune (imagination) · *Human Design* — defined throat, Channel 11-56 · *Gene Keys* — 56 (Enrichment).

### Gift — The Seer
- **Essence:** Perceives the patterns others miss — the hidden fault line *and* the thing trying to be born.
- **Shadow:** Becoming the very pattern it diagnoses; abstraction cut off from lived practice; prophecy without practical architecture.
- **Soft signals:** *Western* — Virgo (discernment), Scorpio (seeing the hidden), Mercury–Saturn · *Human Design* — defined Ajna, Channel 63-4 · *Gene Keys* — 63 (Inquiry).

### Trim-tabs
1. **Healer × Healing & Wholeness** — *Starting action:* Convene a small, regular circle where people can feel and voice their grief for the world, with no agenda to fix it. *Why it compounds:* Metabolized grief frees the energy despair was holding; people who feel held show up for each other again, and the circle becomes a node others join.
2. **Storyteller × Story, Imagination & the Sacred** — *Starting action:* Take one true thing your community already half-believes and give it a clear, repeatable name and image; put it where people gather. *Why it compounds:* A shared name lowers the cost for the next person to recognize themselves in it; coherence spreads, and each person who finds their way in makes the field easier to find.
3. **Seer × Story, Imagination & the Sacred** — *Starting action:* Write down the pattern you see beneath a problem everyone is arguing about, and name what's quietly emerging instead. Share it plainly. *Why it compounds:* Naming a hidden pattern lets others see and act on it too; once enough people can name it, the conversation itself shifts ground.

---

## 5. Re-distillation guidance for the swarm

**Goal:** produce a *lean, general* artifact textured by the corpus — not a corpus index.

**Extract (from corpus → keep the soul):**
- The *felt sense, examples, and phrasings* that make each domain and gift vivid (the somatic, the concrete, the moving). Mine the essays for human texture.
- Real shadows the corpus names honestly (it is rich here — keep this).
- Macy's three dimensions and the Work That Reconnects spiral as the **fixed spine** (`the-great-turning.md` confirms all three: holding actions, Gaia structures, shift in consciousness).

**Generalize (translate jargon → plain, with a mapping table):**
- Run every node through a **jargon→plain pass**. Maintain an explicit translation table the swarm must apply: `compost capital → redirect extractive wealth into community-owned systems`; `wetiko / egregore of capital → the self-perpetuating logic of extraction`; `d/acc → build protective, decentralizing tech faster than tools of control`; `protocols / social DNA → reusable patterns for how groups coordinate`; `cosmolocalism → share globally, produce locally`; `Christ consciousness as collective emergence → the recognition of being part of a larger whole, awakening in communities`; `re-enchantment / post-theological sacred → reverence for the living world that requires no belief`.
- A node passes review only if a thoughtful stranger with no exposure to the corpus could understand it.

**Keep lean (hard caps):**
- **3** dimensions (fixed) · **9** domains (cap 10) · **10** gifts (cap 12) · **~3-4 trim-tabs per gift**, ~30-40 total, each generic and adaptable · `modality_signals` **2-3 per system** per gift, always labeled as priors.
- **Drop `concepts[]`** from the framework. Distill at most a **~12-term interpreter-only glossary** for translation. The corpus encyclopedia lives in the wiki, not the framework.

**Shape for insight, not lecture:**
- Populate `interpretation_guidance` and write `how_it_serves` / `shadow` in second-person-ready language so the interpreter can speak *to a person* without reciting theory.
- For each gift, the swarm should produce a one-line "when this gift is most alive" and "when it's most needed" rather than an essay.

**Process:** ingest corpus → per-dimension agent maps material onto the fixed spine → per-gift agent writes essence/shadow + harvests texture → jargon-translation agent rewrites every field plainly → trim-tab agent generates generic seeds with `why_it_compounds` → lean-pass agent enforces caps and cuts redundancy → human review.

**Suggested target size:** ~9 domains, ~10 gifts, ~35 trim-tabs, 1 ikigai lens, 1 spiral, ~12-term glossary, 1 lineage block. Roughly half the node count of v1, and a fraction of its word count.

The test for every line: *does a stranger feel "this is a wise, general map of how I can help"* — not *"this is one person's private cosmology"*?