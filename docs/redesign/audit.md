I have everything I need from the four files. (Skipping the auto-suggested Next.js skills — this is a content/IA audit, not code authoring against those APIs.)

# EcoDharma Profile Audit — Punch-List

## 1. REGURGITATION (theory-recitation instead of person-centered insight)

The deepest cause is structural: the profile pastes the framework's own prose into the output. Fix the data path first, then the prompts.

**A. The fixture literally concatenates framework theory text — verbatim.** `interpret.ts`:
- Line 134: `unique_gifts: chosen.map((g) => `${g.name} — ${g.description}`)` — the gift's framework `description` (e.g. The Weaver's 120-word manifesto paragraph, framework.json L250) is shipped as the user's "gift." That is regurgitation by construction.
- Line 138: `expression: domainById(id)?.description` — the domain's framework `description` (L47, L72…) pasted verbatim.
- Line 142: `pattern: g.shadow` — the framework `shadow` text (L251…) pasted verbatim.
- Fix: the fixture should *never* surface raw framework fields. Emit a 1-line, second-person, person-specific synthesis. Treat `description`/`shadow` as the interpreter's private reference, not display copy.

**B. The Claude `gift_profile` tool schema invites recitation.** `interpret.ts` L156-184: `unique_gifts` is `array of strings` with no instruction to make them personal, and `domains[].expression` exists as a field that maps 1:1 to the framework's domain blurb (the page renders it right under `why`). Claude fills `expression` by echoing the framework.
- Fix: drop `expression` from the schema entirely (the page already shows `why`, which is the only person-specific field). Rename/constrain `unique_gifts` to require "≤15 words, second person, names how *this person* carries the gift — not the archetype's definition."

**C. The prompt foregrounds the framework over the person.** `interpret.ts` L207: *"Interpret this person THROUGH the framework… Choose their unique gifts and natural domains, and identify the highest-leverage gift x domain `pairings`."* The verbs are all framework-selection (choose, identify, map). Insight is an afterthought ("Write a rich narrative").
- Fix: invert the instruction order. Lead with: "Reflect this specific person back to themselves in plain, warm language. The framework is *scaffolding you reason with, not vocabulary you recite.* A reader who has never heard the words 'trim-tab,' 'Great Turning,' or 'interbeing' should still feel seen." Then the structured selection.

**D. The whole framework JSON is stringified into the system prompt** (`interpret.ts` L199: `JSON.stringify(framework)`), including the `summary` (framework.json L4) and every gift/domain/shadow written in dense doctrinal register ("composting capital," "story of separation into interbeing," "wetiko," "post-theological sacred"). Pumping ~1,760 lines of the author's manifesto prose into context makes the model *speak in that prose*. Models mirror the register of their context.
- Fix: pass a *compressed* framework to the model — ids + name + a one-line neutral gloss per gift/domain, with the manifesto descriptions stripped or moved to a retrieval step used only when a pairing is chosen. Less doctrine in context = less doctrine in output.

**E. The voice prompt mandates the author's coinages as required vocabulary.** `ecodharma-voice@1.0.0.md`:
- §2 hard-codes a formula to recite: *"Gift × Domain → Trim-tab action, validated by Ikigai, structured as an upward spiral"* (L34). Output that *follows a named formula* reads as theory application, not insight.
- §1 (L19-24) lists three "nerd" identities and §6 the "Earth waking up to itself" cosmology — these bleed into output as preamble.
- Fix: add an explicit guardrail: *"Framework terms are for your reasoning. In the output, use at most one or two, and only after you've made the point in plain language. Never explain the framework to the person; apply it invisibly."* Convert §2's formula from "structure your output" to "structure your *thinking*."

**F. §5.4 is a 6-part checklist that produces a recitation every time** (L110-118): reflection → gifts → domains → trim-tabs → shadow → kinship. Every profile marches the reader through the framework's anatomy in the same order, so the framework *is* the experience.
- Fix: see the revised IA below. The six elements can exist, but not as six equally-weighted recited sections.

---

## 2. BURIED / TOO MUCH

**What's shown now (all expanded simultaneously, `profile/page.tsx`):**
1. Patent title block + metadata table (Holder/Filed/Framework v/Voice v) — L46-59
2. Fig. 1 abstract diagram — L62-65
3. Narrative with drop-cap — L68-76
4. Up to 3 gift cards, each = name + **full framework description** — L79-89
5. Up to 3 domain cards, each = `why` + **`expression` (framework description)** — L92-104
6. Up to 5 trim-tab cards, each = action + 2 pills + upward-spiral ¶ + ikigai ¶ + feedback-loop SVG + resonance buttons — L107-141
7. Up to 3 shadow cards — L144-157
8. Apparatus: find-people + offerings form + regenerate — L160-195

That's ~14 content cards of near-identical visual weight plus two forms, every one open. The genuine insight (which trim-tab is *most alive for you*, and why) is card #6 of 8, in `text-sm text-muted` gray.

**Cut / collapse:**
- **Cut** `domains[].expression` (the framework blurb) entirely — it's duplicative theory (page L100 / fixture L138 / schema L162).
- **Cut** the full `description` from gift cards (page L84). Show only the gift *name* + a one-line personal gloss.
- **Collapse** trim-tabs from 5 to **1 primary + 2 secondary**. `MAX_PAIRINGS = 5` (`interpret.ts` L13) is too many high-commitment "small moves" to land at once; five "highest-leverage" actions is a contradiction.
- **Collapse** the header metadata table (`Framework v` / `Voice v`, page L55-56) — that's developer telemetry, not reader value. Move to a footer or a hover.
- **Demote** the offerings form and regenerate controls to the bottom / a separate tab (they already are last, but they share visual weight with insight).

**The ONE thing a person should see first:** a single, plain-language sentence of recognition — "Here is the work that is only yours" — immediately followed by the **one most-alive trim-tab** (the concrete move where their gift meets a real need, validated against what they love and can live on). Recognition + one true next step. Everything else is support.

**Proposed information hierarchy:**
- **Primary (always visible, top):** one-line recognition; the single lead trim-tab (action + the one sentence of *why it compounds*).
- **Secondary (visible, lighter):** the 2-3 gifts as short personal phrases; 2 more trim-tabs.
- **On-demand (collapsed/expandable):** domains, shadow/edges, the full charts-derived narrative, the framework definitions, find-your-people + offerings + regenerate, version metadata.

---

## 3. FORMATTING

- **The "Gift Patent / United Commons" conceptual skin fights the content and the ethics.** `page.tsx` L49 "Gift Patent," L84 "Claim 01," L97 "Fig. 2.1," L146 "Failure modes." A *patent* is enclosure/IP — the exact thing the framework opposes (framework.json domains rail against "re-enclosure," "the master's tools"). The bureaucratic blueprint metaphor also adds an ironic, cold distance that contradicts the voice prompt's "warm wise friend" register (voice §4). It makes everything read as a recited spec.
  - Fix: drop the patent/figure/claim chrome or reduce it to a single subtle motif. Let the warm narrative voice be the dominant texture.
- **No visual hierarchy.** Almost everything is a `cell` card in a `grid gap-3` (gifts md:grid-cols-2, domains md:grid-cols-3, trim-tabs, shadow). Uniform cards = nothing signals "this matters most." 
  - Fix: make the lead insight a full-width, larger-type hero block; render supporting material as smaller, lighter, or collapsed.
- **The valuable text is in the smallest, grayest type.** `why`, `expression`, `upward_spiral`, `ikigai_fit` are all `text-sm text-muted` / `text-muted/80` (L99-100, L124, L131). The insight is literally de-emphasized relative to the labels.
  - Fix: promote upward-spiral/ikigai reasoning to body weight on the primary trim-tab; demote it elsewhere.
- **Mono-uppercase eyebrow jargon everywhere** ("Access to gifts," "Whole systems · your domains of contribution," "Specification · in the EcoDharma voice," L69/80/93/108/146). These section labels are framework-speak that the reader must decode.
  - Fix: plain, human section headers ("Your next move," "What's yours to offer," "Edges to watch").
- **Decorative drop-cap** (L71, `first-letter:text-hero float-left`) on a `whitespace-pre-line` block — fragile and ornamental; competes with the actual lede.
- **Repeated `FeedbackLoop` SVG on every trim-tab** (L115) adds visual noise five times for a concept stated once.
- **Density:** roughly 14 cards + 2 forms with no progressive disclosure means the page reads as a dossier to audit, not a mirror to receive.

---

## 4. PROPOSED REVISED PROFILE INFORMATION ARCHITECTURE

Order by *what lands the genuine insight first; framework recedes to support.*

1. **Recognition (hero).** One or two plain sentences in the warm voice: who this person seems to be and the shape of their giving. No framework jargon, no metadata, no patent chrome. (Pull from `narrative`, but rewritten to lead, not to recite.)
2. **Your lead move (hero, the ONE thing).** The single most-alive trim-tab: the concrete action + one sentence on what it sets in motion + one phrase on why it fits what you love and can live on. This is the payload. Full width, body-weight type.
3. **What's uniquely yours.** 2-3 gifts as short, second-person phrases (≤15 words each) — *not* framework descriptions. Quiet, supporting.
4. **Two more places it could land.** The remaining 1-2 trim-tabs, lighter weight than #2.
5. **Where this fits the bigger work (collapsed).** Domains, expandable. The framework's own language lives here, behind a click, as reference — not in the primary flow.
6. **Edges to tend (collapsed).** Shadow, in gift-over-deficit register; expandable.
7. **The full reading (collapsed).** Chart-by-chart narrative for those who want depth; time-uncertainty caveats here.
8. **Find your people / offerings / re-draft / version metadata (footer).** Apparatus and telemetry, clearly separated from the insight.

Net: the person opens to *recognition + one true next step* in plain language; the framework's domains, definitions, and coined vocabulary become click-to-expand scaffolding rather than the recited spine of the page.

**Highest-leverage code changes to enable this:** (1) stop emitting raw framework `description`/`shadow`/`expression` in `interpret.ts` (L134, L138, L142) and the tool schema (L162); (2) drop `MAX_PAIRINGS` to 3 and have the model rank a single lead (L13); (3) rewrite the Claude prompt (L207-217) and voice §2/§5.4 to make framework terms reasoning-only, not output vocabulary; (4) rebuild `page.tsx` around the hero-first hierarchy with progressive disclosure and retire the patent/figure chrome.