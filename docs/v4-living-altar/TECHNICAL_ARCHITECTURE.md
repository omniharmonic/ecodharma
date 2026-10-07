# EcoDharma v4: The Living Altar
## Technical Architecture

*By Benjamin Life (@omniharmonic). v1.0, 2026-10-07. Companion docs: [PRD](./PRD.md) · [Vision & Taxonomy](./VISION_AND_TAXONOMY.md) · [Implementation Plan](./IMPLEMENTATION_PLAN.md)*

---

## 1. System overview

v4 extends the existing stack. It doesn't replace it.

```
                        ┌──────────────────────────────────────────────┐
  Browser (PWA)         │  Next.js 14 App Router  (apps/web)           │
  ├─ /altar  (dashboard)│  ├─ Server actions: altar, journal, ritual   │
  ├─ /journal           │  ├─ lib/altar/*  domain layer (pure + db)    │
  ├─ /ritual/[cadence]  │  ├─ lib/crypto.ts  AES-256-GCM at rest       │
  └─ /reading (v3)      │  ├─ lib/invitations.ts  grounded nudges      │
                        │  ├─ lib/strands.ts  extraction (Claude|det.) │
  Claude (MCP client) ──┼─▶ /api/mcp  JSON-RPC, OAuth (v2 tools)       │
  Telegram ─────────────┼─▶ /api/bot/telegram  (reply-to-reflect)      │
  Vercel Cron ──────────┼─▶ /api/cron/rituals  (hourly)                │
                        └───────┬──────────────────────┬───────────────┘
                                │ SQL (RLS via SET ROLE)│ HTTP (bearer)
                        ┌───────▼────────┐     ┌───────▼──────────────────┐
                        │ Postgres        │     │ Ephemeris (FastAPI)      │
                        │ (Neon/Supabase) │     │ pyswisseph (SE | Moshier)│
                        │ + v4 tables     │     │ + /charts/* (fixed)      │
                        └─────────────────┘     │ + /cycles  thresholds    │
                                                └──────────────────────────┘
  Offline/CI:  services/ephemeris/tests/oracle  ◀── natalengine (astronomy-engine)
```

Layering rules:
- **Domain logic is pure where possible** (`lib/altar/model.ts`, `lib/cycles.ts`, `lib/strands-det.ts`) so it can be unit-tested with `node --test` and no database.
- **All person data goes through `withUser()`** (RLS-enforced) except cron and bot paths, which use `withService()` and must filter by `user_id` explicitly.
- **AI is always optional.** Every AI path has a deterministic fallback (existing convention: `claudeMode()`), so e2e tests run hermetically.

## 2. Ephemeris service changes (Phase 0)

### 2.1 Correctness fixes

| Fix | Location | Change |
|---|---|---|
| Midnight births | `main.py::_birth_jd` | `b.hour if b.hour is not None else 12` (same for minute) |
| GK sequences | `gene_keys.py` | Canonical sphere↔planet map (Attraction=D.Moon, IQ=P.Venus, EQ=P.Mars, SQ=D.Venus, Core=D.Mars, Vocation=D.Mars, Culture=D.Jupiter, Brand=P.Sun, Pearl=P.Jupiter); add `core`, `pearl` |
| HD authority | `human_design.py` | Self-Projected only if G connected to Throat; `Ego-Manifested` / `Ego-Projected`; `Mental/Environmental` → `None (Mental/Environmental)` naming kept compatible with an alias map in the web layer |
| Vedic | `astro.py` / new `vedic.py` | Whole-sign houses from the sidereal lagna; mean node for Rahu/Ketu; nakshatra (27 × 13°20′) + pada (4 × 3°20′) + nakshatra lord for every graha and lagna |
| DST | `astro.py::julday_ut` | Detect non-existent (gap) and ambiguous (fold) local times; return `time_warnings` and use `fold=0` deterministically; echo `utc` and `utc_offset` in the response |
| Ephemeris | `astro.py` | If `SE_EPHE_PATH` contains `sepl_18.se1`/`semo_18.se1`, use `FLG_SWIEPH`; else `FLG_MOSEPH`. `engine_version` records which |
| Sensitivity | `human_design.py`, `astro.py` | For each activation: `boundary_distance_arcmin` to the nearest line edge; `sensitive: true` if < 5′. For time-dependent fields: recompute at ±10 min and list fields that change (`time_sensitive_fields`) |

All changes are **additive in the response shape** (new keys), except the corrected values, which is the point.

### 2.2 New endpoint: `/cycles`

`POST /cycles` `{ year, lat, natal_sun_lon? }` → exact UTC instants for:
- March/June/September/December solstices and equinoxes (Sun at 0°/90°/180°/270° tropical), labeled by **season for the hemisphere of `lat`** (in the southern hemisphere the June solstice is *Winter*)
- New and full moons in the year (Sun–Moon elongation 0°/180°)
- Solar return (Sun returns to `natal_sun_lon`)

All found by bracketing plus bisection on `swe.calc_ut`, to under 1 second accuracy. Cached per year in the web layer (`ritual_thresholds` table).

### 2.3 Oracle and differential testing

```
services/ephemeris/tests/
  test_charts.py            (existing, extended)
  test_fixes.py             midnight, GK map, authority rules, nakshatra math, DST
  golden/edge_cases.json    hand-curated births + expected structural facts
oracle/                     (node, offline/CI)
  package.json              natalengine pinned
  compare.mjs               N random births → our /charts/* vs natalengine → mismatch report
```

**Comparison policy:**
- *Longitudes:* |Δ| < 0.01° (36″) for all bodies (independent ephemerides agree far closer than that).
- *Gate/line:* exact, **except** when either engine puts the body within 0.01° of a line boundary; those are reported as `boundary_ambiguous`, not failures.
- *Type / authority / profile / definition / channels:* exact unless a boundary-ambiguous activation changes them.
- *GK spheres:* exact (same exception).
- Any other mismatch fails CI and is investigated. A mismatch can mean either engine is wrong, so each one gets a written explanation in `oracle/FINDINGS.md`.

## 3. Data model (Postgres, migrations 0020+)

All tables: `user_id uuid references auth.users on delete cascade`, RLS enabled, **owner-only** policies (`user_id = auth.uid()`), plus explicit consent-gated policies where noted.

```sql
-- 0020_altar.sql
create table altar_elements (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users on delete cascade,
  kind          text not null check (kind in
                ('prayer','devotion','root','work','practice','measure','inquiry','thread')),
  lineage_id    bigint,               -- stable identity across versions (= first version's id)
  version       int not null default 1,
  title         text not null,
  body_enc      bytea,                -- encrypted body (AES-256-GCM envelope)
  facets        jsonb default '{}',   -- prayer: {for_whom,toward_what,through_what}; measure: {lens}
  status        text not null default 'active',
  constitution_refs jsonb default '[]', -- [{lens:'gift'|'hd'|'gk'|'astro', ref:'weaver'|'gate:34'|...}]
  external_refs jsonb default '[]',     -- [{kind:'url'|'parachute'|'calendar', ref, label}]
  created_at    timestamptz default now(),
  superseded_at timestamptz,          -- set when a newer version is appended
  retired_at    timestamptz           -- composted
);
create index on altar_elements (user_id, kind) where superseded_at is null;

create table element_links (
  user_id uuid not null references auth.users on delete cascade,
  from_lineage bigint not null, to_lineage bigint not null,
  relation text not null,             -- serves | grounds | uses | measures | questions
  primary key (from_lineage, to_lineage, relation)
);

create table element_events (           -- the life history: status changes, versions, composting
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  lineage_id bigint not null,
  event text not null,                -- created | revised | status:questioning | composted | renewed ...
  note_enc bytea,
  at timestamptz default now()
);

-- 0021_journal.sql
create table reflections (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users on delete cascade,
  cadence     text not null default 'spontaneous',  -- weekly|lunar|monthly|quarterly|seasonal|solar_return|spontaneous
  depth       smallint default 1,                   -- loop depth 1..3
  source      text not null default 'web',          -- web|telegram|mcp|email
  body_enc    bytea not null,
  evidence    jsonb default '[]',
  ritual_id   bigint,
  created_at  timestamptz default now()
);
create table strands (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users on delete cascade,
  reflection_id bigint not null references reflections on delete cascade,
  lineage_id    bigint not null,
  relation      text not null check (relation in
                ('embodies','strains','questions','evidences','nourishes','releases','discovers')),
  charge        smallint not null default 0 check (charge between -2 and 2),
  quote_enc     bytea,
  proposed_by   text not null default 'det',        -- claude|det|person
  status        text not null default 'proposed',   -- proposed|confirmed|rejected
  created_at    timestamptz default now()
);
create table alignment_readings (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  reflection_id bigint not null references reflections on delete cascade,
  lineage_id bigint,                  -- null = overall
  lens text not null,                 -- aliveness|fidelity|constitution|reciprocity|fruit|measure:<lineage>
  value smallint check (value between 1 and 5),
  note_enc bytea
);

-- 0022_cycles.sql
create table ritual_prefs (
  user_id uuid primary key references auth.users on delete cascade,
  weekly_dow smallint default 0, local_hour smallint default 19, tz text default 'UTC',
  channels text[] default '{email}', lunar boolean default false, hemisphere text default 'N'
);
create table rituals (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  cadence text not null, depth smallint not null, due_at timestamptz not null,
  threshold_label text,                 -- e.g. 'Winter Solstice 2026'
  completed_reflection_id bigint,
  unique (user_id, cadence, due_at)
);
create table ritual_thresholds (year int, hemisphere text, kind text, label text, at timestamptz,
  primary key (year, hemisphere, kind, at));
create table invitations (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  ritual_id bigint, channel text not null, body text not null,
  refs jsonb default '[]', engine text not null,  -- claude|det
  contract jsonb,                       -- grounding-contract result
  sent_at timestamptz default now(), reply_reflection_id bigint
);
-- legacy `nudges` remains read-only for history.

-- 0023_constellations_v2.sql
alter table constellation_members add column if not exists dharma_role text; -- kin|witness|accountability|mentor|collaborator
create table offerings_shared (       -- a reflection offered to a constellation
  id bigint generated always as identity primary key,
  reflection_id bigint not null references reflections on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  constellation_id bigint not null references constellations on delete cascade,
  excerpt_enc bytea not null, offered_at timestamptz default now(), revoked_at timestamptz
);
create table witness_notes (...);      -- partner → person, about a ritual completion
create table constellation_altar (...); -- shared prayer / works, versioned like altar_elements
```

**RLS for sharing:** `offerings_shared` is readable by members of the constellation (via the existing `is_member()` + consent helpers from `0019_constellation_consent.sql`) only while `revoked_at is null`. The person's own `reflections` are never readable by anyone else. Only the *excerpt* (re-encrypted copy) is shared.

## 4. Encryption at rest

`lib/crypto.ts`:
- AES-256-GCM, 12-byte random IV, 16-byte tag.
- Envelope `[v:1 byte][keyId:1 byte][iv:12][tag:16][ciphertext]` stored in `bytea`.
- Keys from `JOURNAL_KEYS` env: `"1:<base64-32B>,2:<base64-32B>"`; the highest id encrypts, any id decrypts (rotation by re-encrypt job).
- Dev/test fallback key is derived from `SESSION_SECRET` with a loud warning; production refuses to start the journal without `JOURNAL_KEYS`.
- What's encrypted: element bodies and notes, reflection bodies, strand quotes, alignment notes, shared excerpts. **Titles are not encrypted** (needed for display and matching). The person is told this in the UI: "Titles are visible to the system; your words are sealed."

## 5. Domain layer (`apps/web/src/lib/altar/`)

| Module | Responsibility |
|---|---|
| `model.ts` | Types: `AltarElement`, `Reflection`, `Strand`, `Relation`, `Lens`; pure helpers (versioning, status transitions, valid relations) |
| `repo.ts` | DB access via `withUser` / `withService`; encrypt/decrypt at the boundary |
| `kindle.ts` | Seeds suggestions from the reading (gifts → Works/Practices; HD strategy/authority → Constitution measures; Ikigai → Prayer prompts) |
| `strands.ts` | `proposeStrands(reflectionText, altar)`: Claude tool-use with strict JSON schema when available; else `strands-det.ts` |
| `strands-det.ts` | Deterministic extractor: tokenized title/alias matching per element + small affect lexicon for charge + relation cues ("drained", "questioning", "let go", "noticed") |
| `becoming.ts` | Aggregations for viz: per-element charge time series, lens trends, thread bands, prayer rings |
| `cycles.ts` | Pure: given prefs + thresholds + now → due rituals (cadence, depth, label); hemisphere season names; prompt sets per cadence/depth |
| `invitations.ts` | Grounding packet → Claude or deterministic invitation → **grounding contract** → persist with refs |
| `guard.ts` | Interpretation guard: extract placement claims from prose (regex + gazetteer of bodies/signs/houses/gates/centers/nakshatras) → verify against chart JSON |

### 5.1 Strand extraction (Claude path)

Model: `ECODHARMA_STRAND_MODEL` (default a Sonnet-class model). Tool-use with a single `record_strands` tool whose input schema is `{strands: [{lineage_id, relation, charge, quote}]}`. The system prompt lists the person's current elements (id, kind, title), never their bodies, and tells the model to quote verbatim spans only. **Post-validation:** `lineage_id` must exist; `quote` must be a substring of the reflection; relation in the enum; charge clamped. Anything that fails is dropped. Proposals are stored with `status='proposed'`.

### 5.2 The grounding contract (invitations)

```ts
type Contract = { refs: string[]; minRefs: 2; maxWords: 120;
  banned: RegExp[];          // /\bI need\b/i, /could you (share|provide)/i, /the person'?s/i, /as an AI/i ...
  maxSimilarity: 0.6 };      // Jaccard on word 3-grams vs last 6 invitations
```
`refs` are found by matching packet items (element titles, gift names, chart facts) in the output. On failure: one regeneration with the failure reason appended, then a deterministic invitation built from a rotating element and a cadence-specific template (always passes the contract by construction). The contract result is stored on the invitation row for audit.

### 5.3 Interpretation guard

Run after reading generation (`interpret.ts`) on every prose field. Claims like "Venus in Libra", "Moon in the 4th house", "Gate 34", "Sacral authority", "Rohini nakshatra" are parsed and checked against the chart JSON. On a mismatch: (a) if the correct value is known, substitute it; (b) otherwise remove the sentence. Report `meta.guard = {checked, fixed, removed}`.

## 6. MCP v2 (`/api/mcp`)

Existing JSON-RPC handler, extended with a **tool registry** (`lib/mcp-tools.ts`), so tools are declared once with name, description, input schema, and handler. Auth (OAuth or legacy token) and the premium check stay the same. For the friends-and-family phase, premium gating is replaced by an allow-list (`ALTAR_ACCESS=invite|premium|open`).

| Tool | Handler | Notes |
|---|---|---|
| `get_altar` | `repo.getAltar` | Decrypted for the owner |
| `get_ritual` | `cycles.dueFor` + prompts | Includes depth and evidence suggestions ("check this week's calendar") |
| `log_reflection` | `repo.createReflection` → `strands.propose` | Returns reflection id + proposed strands |
| `confirm_strands` | `repo.setStrandStatus` | `{confirm:[ids], reject:[ids], edits:[...]}` |
| `list_reflections` | `repo.listReflections` | Range and filters |
| `open_inquiry` / `update_inquiry` | `repo` | Inquiries are elements of kind `inquiry` |
| `propose_element_change` | `repo.createProposal` | Stored in `altar_proposals` (pending); accepted in web UI or via `accept_proposal` **only after the person explicitly agrees in chat** |
| `get_becoming` | `becoming.summary` | Trends for Claude to reflect on |
| `constellation_pulse` | consent-gated offerings + completions | |
| `assemble_story` | `story.assemble(range)` | Quotes the person's words; Claude path or deterministic stitched digest |

## 7. Telegram

`/api/bot/telegram` already links accounts. Add:
- **Reply detection:** if `message.reply_to_message` matches a sent invitation (`invitations.channel='telegram'` with stored `platform_message_id`), create a Reflection with that `ritual_id`.
- **Commands:** `/reflect`, `/ritual`, `/prayer`, `/inquiry`, `/pulse`, `/help`. Any other free text keeps the existing reflective-companion behavior, and is now also saved as a `spontaneous` Reflection if the person has turned on `settings.capture_chat`.
- **Voice (P1):** `message.voice` → download via Bot API → transcription provider (configurable) → Reflection.

## 8. Cron: `/api/cron/rituals` (hourly)

1. Ensure thresholds for this year and next exist (call ephemeris `/cycles` once per hemisphere and year).
2. For each person with an altar: `cycles.dueFor(prefs, thresholds, now)` → upsert `rituals` (unique key prevents duplicates).
3. For each newly due ritual whose local send hour has arrived: build the invitation → contract → send on the person's channels → record.
4. Idempotent; safe to run more often. (Vercel Hobby only allows daily crons. If the plan is Hobby, schedule daily and send the day's invitations at that hour.)

The legacy `/api/cron/nudges` is redirected to the new pipeline (weekly cadence only) so the existing schedule keeps working during transition.

## 9. Visualization architecture (`apps/web/src/components/altar/`)

| Component | Tech | Notes |
|---|---|---|
| `SoulConsole.tsx` | React + CSS grid | The dashboard shell: telemetry rail, view switcher, prayer panel, journal strip |
| `SkyView.tsx` | **three.js** via `@react-three/fiber@8` + `@react-three/drei@9` (React 18 compatible) | Celestial sphere, instanced stardust (`InstancedMesh`), additive-blended glow sprites, custom breathing shader on the Prayer star, ecliptic ring with natal glyphs, OrbitControls with damping and auto-rotate |
| `SoilView.tsx` | Canvas 2D + `d3-force` | Mycelial network: force layout, curved hyphae (quadratic Béziers with noise), pulse particles along edges (requestAnimationFrame), status-styled roots, compost particle systems |
| `BecomingView.tsx` | SVG | Archimedean year spiral (angle = day-of-year, radius = year index), threshold markers, charge-colored points; tree rings |
| `Telemetry.tsx` | SVG/CSS | Moon phase glyph (computed), season arc, loop-depth indicator, days-to-threshold counter, "signal" sparkline of recent charge |
| `SacredGeometry.tsx` | SVG | Flower-of-Life lattice, vesica, Metatron overlay; low-opacity, slow rotation |
| `useBreath.ts` | hook | Shared global breath phase (sin, 5.5 s), so every view breathes in unison; respects `prefers-reduced-motion` |

**Data contract:** a single `GET`-style server action `becomingSnapshot()` returns `{ altar, strands (confirmed, last 365 d), readings, rings, thresholds, natal (planet longitudes), constellation (consented) }`, small enough (< 200 KB) to hydrate all views at once. Views are `next/dynamic` imported with `ssr:false`, and the Sky bundle loads only when chosen.

**Performance budgets:** Sky ≤ 2 draw calls per element class (instancing), ≤ 5k particles; Soil ≤ 400 nodes at 60 fps; a static SVG fallback for reduced motion or no WebGL.

**Aesthetic system:** extends v3 tokens (`--bg --fg --accent(solar amber) --live(phosphor) --link`). New tokens: `--sky-deep`, `--nebula-warm` (radiant charge), `--nebula-cool` (contracted charge), `--hypha`, `--root-held/questioning/composting/renewed`, `--console-grid`. Typography: Fraunces (sacred display), IBM Plex Mono (telemetry), Archivo (body).

## 10. Security and privacy

- Owner-only RLS on all v4 tables; cron and bot use the service role with explicit `user_id` filters (code-reviewed).
- Encryption at rest (§4). No reflection content in logs (log ids only).
- Invitations contain only what the person already wrote or was shown; email invitations never include reflection quotes (Telegram may, since it's a private chat).
- MCP proposals can't change core elements without a separate acceptance.
- Constellation sharing is excerpt-copy plus revocation, not a pointer to the private reflection.

## 11. Testing strategy

| Layer | Tooling | Coverage |
|---|---|---|
| Ephemeris | pytest | Fixes, nakshatra math, cycles bisection, DST |
| Oracle | node + natalengine | 1,000+ random births, CI-gated |
| Domain (pure) | `node --test` (tsx) | cycles, strands-det, contract, guard, crypto, model transitions |
| DB / RLS | `node --test` against local PG | owner-only isolation, offering consent, revocation |
| E2E | Playwright (fixture mode) | kindling → altar → reflection → strands → dashboard renders; ritual due; telegram reply-to-reflect; MCP tools |
| Visual | Playwright screenshots | Sky/Soil/Becoming render without WebGL errors; reduced-motion fallback |

## 12. Configuration

| Env | Purpose |
|---|---|
| `JOURNAL_KEYS` | Encryption keys (required in prod) |
| `ALTAR_ACCESS` | `invite` (default) / `premium` / `open` |
| `ECODHARMA_STRAND_MODEL`, `ECODHARMA_INVITE_MODEL` | Model overrides |
| `SE_EPHE_PATH` | Swiss Ephemeris data files directory (ephemeris service) |
| `TRANSCRIBE_PROVIDER`, key | Voice notes (P1) |
| existing | `DATABASE_URL`, `EPHEMERIS_URL`, `ANTHROPIC_API_KEY`, `RESEND_*`, `TELEGRAM_*`, `CRON_SECRET` |
