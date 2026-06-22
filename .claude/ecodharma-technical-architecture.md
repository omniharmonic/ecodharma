---
title: "EcoDharma — Technical Architecture"
type: technical-architecture
author: "Benjamin Life (@omniharmonic)"
status: draft
version: 0.1
created: 2026-06-20
description: "System architecture for EcoDharma: a PWA + mobile-first web app that computes multi-modal readings, interprets them through a distilled regenerative framework via the Claude API, and composes gift-based constellations — built on Next.js, Vercel, Supabase, and a self-hosted ephemeris service."
companion: "ecodharma-prd.md"
---

# EcoDharma — Technical Architecture

Companion to the [EcoDharma PRD](ecodharma-prd.md). This document specifies the build. Where the PRD says *what and why*, this says *how*.

---

## 1. Architecture at a glance

```
                          ┌─────────────────────────────────────┐
                          │   CLIENT — PWA / mobile-first web    │
                          │   Next.js (App Router) on Vercel     │
                          │   installable, offline-aware shell   │
                          └───────────────┬─────────────────────┘
                                          │  (server actions / API routes)
              ┌───────────────────────────┼───────────────────────────────┐
              │                           │                               │
   ┌──────────▼──────────┐   ┌────────────▼────────────┐    ┌─────────────▼────────────┐
   │  SUPABASE            │   │  EPHEMERIS SERVICE      │    │  INTERPRETATION ENGINE   │
   │  Postgres + Auth     │   │  FastAPI (Python)       │    │  Claude API (server-side)│
   │  RLS + Storage       │   │  Swiss Ephemeris        │    │  voice + framework +     │
   │  Realtime            │   │  → Western / Vedic /    │    │  chart JSON → profile    │
   │                      │   │    Human Design / GK    │    │  (structured output)     │
   └──────────┬───────────┘   └─────────────────────────┘    └──────────────┬───────────┘
              │                                                              │
   ┌──────────▼───────────┐                                   ┌─────────────▼────────────┐
   │  FRAMEWORK ARTIFACT   │◄──────  (offline) ──────────────  │  DISTILLATION SWARM      │
   │  versioned JSON/MD    │      produced once, re-runnable   │  corpus + wiki → framework│
   │  source of truth      │                                   │  (Claude agents)         │
   └───────────────────────┘                                   └──────────────────────────┘

   Optional: PARACHUTE (localhost vault / MCP) as a data source + sink for profiles, people, notes.
```

Three runtime services + two offline/asset artifacts. The client never calls Claude or the ephemeris service directly; everything routes through Next.js server functions so secrets stay server-side and we can cache aggressively.

---

## 2. Stack decisions & rationale

| Layer | Choice | Why |
|---|---|---|
| Frontend / app shell | **Next.js (App Router) + React**, deployed on **Vercel** | PWA-capable, mobile-first with strong desktop, server actions keep AI/secrets server-side, you already favor it |
| Styling / UI | Tailwind + a small component layer (shadcn/ui) | Fast, consistent, accessible defaults; lets us invest design effort in the *distinctive* surfaces (profile, constellation) |
| Auth, DB, storage, realtime | **Supabase** (Postgres + Auth + RLS + Storage + Realtime) | One service covers auth, relational data, row-level consent enforcement, file storage, and live constellation updates; generous free tier |
| Chart computation | **Self-hosted FastAPI "ephemeris service"** wrapping open-source Swiss Ephemeris libraries | Free, auditable, no per-call API cost, full control over JSON shape; the heavy modalities (HD/GK) have no clean hosted free option anyway |
| Interpretation | **Claude API** (server-side), Opus for deep synthesis / Sonnet for lighter passes | The actual intelligence; voice + framework + multi-chart synthesis is exactly Claude's strength |
| Distillation swarm | **Claude agents**, offline batch | One-time framework production; re-runnable on framework version bumps |
| Optional memory | **Parachute** via MCP / local client | Your second brain as an optional data source/sink |

**Cost shape:** computation is free (local ephemeris); the only metered cost is Claude tokens. This is why the free/paid boundary in the PRD falls on *AI-heavy* features.

---

## 3. The reading pipeline (ephemeris service)

A single containerized **FastAPI** service exposes one job: birth data → structured chart JSON for every modality. Deployable on Railway / Fly.io / Render (low-cost/free tiers); Swiss Ephemeris data files bundled in the image.

**Endpoints (illustrative):**
```
POST /charts/western     → tropical natal chart JSON
POST /charts/vedic       → sidereal natal chart JSON (ayanamsa configurable)
POST /charts/human-design → bodygraph: type, profile, authority, gates, channels, centers, variables
POST /charts/gene-keys   → core sequences (Activation / Venus / Pearl gate+line positions)
POST /charts/synastry    → two-subject cross-aspects (for constellations)
POST /charts/transits    → current transits vs a natal chart (phase 2 forecast)
```

**Library choices (all free, self-hostable, Swiss Ephemeris–based):**
- **Western + Vedic:** `kerykeion` (AGPLv3) or `immanuel-python` — both emit rich natal JSON; sidereal/ayanamsa supported for Vedic. *Note the AGPL implication: fine for an open-source project, but it copylefts the service; if we ever want the ephemeris service closed, prefer the more permissive option. Decide at §10.*
- **Human Design:** `human-design-py` (MIT) or `hdkit` — compute type/profile/authority/gates/channels/centers from the personality (birth) and design (≈88° solar arc before birth) positions.
- **Gene Keys:** derived from the **same gate computation** as Human Design. The four core gates (Sun/Earth × personality/design) yield the primary sequences. We compute gate+line positions ourselves and pass *only positions* downstream.

**Why one service:** HD and Gene Keys share gate math; Western and Vedic share the ephemeris. Co-locating avoids recomputation and keeps a single source of astronomical truth.

**IP boundary enforced here:** the service returns **positions and structural facts only** (gate 34, line 2, channel 20-34, Generator, 3/5 profile). It returns **no proprietary descriptive text.** All meaning is generated later by the interpretation engine in original language.

**Birth-time handling:** the service accepts an `unknown_time` flag. When set, it computes a time-agnostic chart (e.g. whole-sign/solar) and returns a `time_dependent_fields` list so the UI and interpreter can flag reduced confidence on rising, houses, fast-moving placements, and the entire HD/GK output (which is highly time-sensitive).

---

## 4. Data model (Supabase / Postgres)

Core tables (abbreviated):

```
users                — auth (Supabase Auth)
profiles             — display name, bioregion/place, pronouns, settings
birth_data           — user_id, date, time (nullable), lat, lng, tz, unknown_time  [ENCRYPTED, RLS owner-only]
charts               — user_id, modality, raw_json, engine_version, computed_at      [RLS owner-only]
gift_profiles        — user_id, framework_version, content_json, voice_version,
                       generated_at, status                                          [RLS owner-only]
offerings            — user_id, skills[], offerings[], availability                  (seeds marketplace)

consents             — granter_id, grantee_id|constellation_id, scope, granted_at,
                       revoked_at                                                     (the consent ledger)
constellations       — owner_id, name, type (1:1 | 1:many), created_at
constellation_members— constellation_id, user_id, role, consent_id (FK → consents)
constellation_reads  — constellation_id, framework_version, content_json, generated_at

framework_versions   — version, artifact_json, changelog, published_at               (mirror of the artifact)
forecasts            — (phase 2) user_id, event, window, payload
marketplace_*        — (phase 2/3) projects, needs, matches
```

**Consent is enforced in the database, not just the app.** Postgres **Row-Level Security** policies make a profile readable in a constellation context *only if* a matching, non-revoked row exists in `consents`. This makes "no silent use of another's data" a structural guarantee, not a code convention.

**Profile consistency:** `gift_profiles` persists the generated profile. It is **not** regenerated on every view — only on explicit user request or when `framework_version` / `voice_version` changes. This delivers the "profiles should be consistent" requirement and controls AI cost.

---

## 5. The framework distillation pipeline (offline swarm)

A batch pipeline, run by you/me outside the live app, that produces the **Framework Artifact** — the versioned source of truth the whole product depends on.

**Inputs:** the full corpus (project `.md` essays) + `wiki.omniharmonic.com`.

**Pipeline:**
1. **Ingest & chunk** the corpus; pull the wiki (respecting its structure).
2. **Map (swarm):** parallel Claude agents each extract candidates for one facet — Regenerative Domains, Gifts/Archetypes, Trim-tab patterns, key concepts, and the edges between them. (Joe Lightfoot's archetypes ingested as one input, credited, then transcended.)
3. **Reduce / synthesize:** merge, de-duplicate, resolve overlaps into a coherent taxonomy; attach each node to supporting source passages (provenance).
4. **Human curation:** you review and refine — this is the highest-leverage human step; the swarm proposes, you dispose.
5. **Emit** a structured artifact:

```json
{
  "framework_version": "1.0.0",
  "domains": [ { "id", "name", "description", "sub_domains": [...], "sources": [...] } ],
  "gifts":   [ { "id", "name", "description", "shadow", "modality_signals": {...}, "sources": [...] } ],
  "trim_tabs": [ { "id", "gift_id", "domain_id", "pattern", "upward_spiral_logic", "sources": [...] } ],
  "ikigai_lens": { "love", "skill", "world_need", "livelihood" },
  "voice": { "ref": "ecodharma-voice@x.y" }
}
```

The artifact is committed to the repo, mirrored into `framework_versions`, and referenced by every interpretation call. **Versioned** so profiles can be regenerated deterministically when the framework evolves.

*This is a build-time/asset pipeline, not a runtime feature — confirmed.*

---

## 6. The interpretation engine (Claude API)

Server-side only. Assembles context and calls Claude to produce the Gift Profile and constellation reads.

**Context assembled per call:**
1. **Voice system prompt** — the versioned EcoDharma persona (Aiden Cinnamon Tea × your spec).
2. **Framework Artifact** (current version) — domains, gifts, trim-tabs, Ikigai lens.
3. **Chart JSON** for each available modality (raw structured data).
4. **Source scaffolding** for non-traditional modalities (esp. Gene Keys) so the model interprets faithfully in *original* language — **without reproducing proprietary text.**
5. **Ikigai responses** (the user's reflection).
6. **Output contract** — request structured output (JSON) so the app can render sections reliably.

**Output (gift profile), structured:**
```json
{
  "unique_gifts": [...],
  "domains": [ { "domain_id", "why", "expression" } ],
  "trim_tabs": [ { "action", "domain_id", "gift_basis", "upward_spiral", "ikigai_fit" } ],
  "shadow": [ { "pattern", "how_to_relate" } ],
  "narrative": "EcoDharma-voice prose tying it together"
}
```

**Model routing:** Opus for the deep multi-modal synthesis (the profile, large constellations); Sonnet for lighter passes (single 1:1 reads, refinements) to manage cost. *(MCP/tooling not required for v1 interpretation; keep it a clean completion call.)*

**Determinism & consistency:** persist outputs (§4); pin `framework_version` + `voice_version` + `engine_version` into each saved profile so a given input always maps to a reproducible, citable output.

---

## 7. Constellation composer

**Computation:** for each pair in a constellation, the ephemeris service returns synastry (cross-aspects) and, where relevant, composite data; HD provides channel/electromagnetic dynamics between two bodygraphs.

**Interpretation:** the engine receives the members' charts + profiles (consent-gated) + framework, and returns:
- **1:1:** complementarities, frictions, "what to make explicit," how each relates differently.
- **1:many:** collective gift map, gaps relative to the domains the constellation cares about, weaving guidance.

**Consent gate:** the composer can only load a member's data if `consents` permits it (enforced by RLS, §4). A constellation read is regenerated when membership changes or the framework version bumps.

**Realtime:** Supabase Realtime can live-update a constellation as members accept invitations.

---

## 8. Forecast & nudge engine (phase 2)

- Scheduled job computes current **transits** against each opted-in user's natal chart and active constellations.
- When an event crosses a meaningful threshold, the engine generates a short, voice-consistent nudge describing *what's live and how it touches this person's specific relationships/constellations.*
- Delivered via web-push (PWA) / email. Strictly opt-in.

---

## 9. Marketplace (phase 2/3)

- Supply side: user `offerings` (already captured in v1).
- Demand side: `projects` with `needs` expressed in framework terms (domains, gifts, trim-tabs).
- Matching: framework-native — match a person's gifts/domains to a project's needs, surfaced as aligned invitations rather than job listings. Reuses the same gift taxonomy, so no parallel ontology.

---

## 10. Cross-cutting concerns

**Licensing:** project is open source; framework released CC BY-SA. **Decision needed:** if we use AGPL `kerykeion`, the ephemeris service is copyleft — acceptable for a commons project. If you ever want that service proprietary, choose the more permissively licensed ephemeris library instead. Recommended default: embrace AGPL, keep everything open. *(Flagged for your call.)*

**AI cost control:** (1) persist and reuse profiles; (2) route by model; (3) cache framework + voice as stable prefixes (prompt caching); (4) gate heavy re-generation behind paid tier; (5) batch the swarm offline. Rough mental model: chart compute ≈ free; a full multi-modal profile ≈ one large Opus call; constellations scale with member count — hence the paid line.

**Security & privacy:** birth data encrypted at rest, RLS owner-only; least-privilege service keys; Claude/ephemeris calls server-side only; full export + delete; consent ledger auditable and revocable.

**Parachute integration (optional):** profiles, people, and constellation notes can sync into the vault via the Parachute MCP/client; vault data used as interpretation context only under the same consent rules. Kept optional so EcoDharma stands alone by default.

**Accessibility & PWA:** installable, offline-aware shell, mobile-first layouts, strong desktop; the profile and constellation views get the most design investment (these are the "wow" surfaces).

---

## 11. External dependencies & unknowns

- **Golden Calf repo** — confirm exactly which ephemeris library and JSON shape you used so the ephemeris service matches it 1:1. *(I inferred a Swiss Ephemeris / Kerykeion-class library; please point me at the repo so I can mirror your working setup rather than re-deriving it.)*
- **wiki.omniharmonic.com** — confirm access method for the distillation ingest (export, API, or crawl).
- **Joe Lightfoot archetypes** — source text/permission for ingestion.
- **Framework shape sign-off** — the swarm is built around the §5.2 PRD structure; lock that first.

---

## 12. Build sequence (milestones)

**M0 — Framework first (the keystone).** Stand up the distillation swarm; produce Framework Artifact v1; you curate. *Nothing else is worth building until this is good.*

**M1 — Ephemeris service.** FastAPI wrapping Western/Vedic/HD/Gene-Keys; raw JSON out; birth-time handling; mirror the Golden Calf setup. Deploy.

**M2 — Auth, data model, consent.** Supabase project; schema; RLS consent policies; encrypted birth data.

**M3 — Reading → Gift Profile.** Onboarding → compute charts → interpretation engine (voice + framework) → persisted, consistent profile → profile UI.

**M4 — Constellations.** Active-consent invites; synastry compute; 1:1 then 1:many reads; constellation UI; realtime.

**M5 — Offerings + polish + PWA.** Lightweight offerings; install/offline; design pass on the hero surfaces; free/paid gating.

**→ Phase 2:** forecast/nudge engine, marketplace v1.

**Build path:** I can build this directly in Claude Code (Next.js + Vercel + Supabase + the FastAPI ephemeris service), iterating with you surface by surface — or hand any milestone off as a spec. Given the stack you confirmed, I'd recommend I build M0–M1 first so we de-risk the two hardest, most foundational pieces before any UI exists.

---

*Authored with and for Benjamin Life (@omniharmonic). Offered toward the commons.*
