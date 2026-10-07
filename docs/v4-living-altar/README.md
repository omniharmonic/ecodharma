# EcoDharma v4 — The Living Altar

*By Benjamin Life (@omniharmonic).*

The v4 transition turns a one-time reading into an ongoing practice of aligning a life with what it is in service to. These are the documents and the runbook.

| Doc | What it is |
|---|---|
| [VISION_AND_TAXONOMY.md](./VISION_AND_TAXONOMY.md) | The why, the taxonomy (Prayer · Devotions · Roots · Constitution · Paths · Measures · Reflections · Cycles · Constellation), Sky/Soil |
| [PRD.md](./PRD.md) | Requirements, journeys, metrics, decisions |
| [TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md) | System design, data model, encryption, MCP, cron, visualization architecture |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Phases and the progress checklist |
| [../../oracle/FINDINGS.md](../../oracle/FINDINGS.md) | Accuracy: the independent-engine differential results |

## What exists now

**Accuracy (Phase 0).** Midnight births, the Gene Keys sphere map, invented nakshatras, Human Design authority edge cases, DST, polar houses, and boundary sensitivity are all fixed. The fixes are verified against an independent engine: 0 unexplained mismatches over thousands of random births. An interpretation guard corrects or removes any placement the prose claims that the chart doesn't support. A recompute script finds everyone whose chart changed and tells them honestly what changed.

**Invitations.** The weekly nudge is rebuilt. Every invitation must pass a grounding contract (≥2 references to the person's own altar or reading, no meta-language, no repetition) before anything is sent. The three broken emails that actually went out are now unit tests.

**The Living Altar.**
- `/altar/kindle`: the first lighting. The person writes their Prayer; the system suggests the rest.
- `/altar`: Soul's Becoming. The console has a live telemetry rail and four views:
  - **Orrery**: a living mandala.
  - **Sky**: 3D. A breathing prayer-star over the person's true natal ecliptic, gifts as a constellation, works in orbit, reflections as stardust, kin as neighboring stars.
  - **Soil**: mycelium. Roots by state, with pulses of light travelling from each reflection into what it touched.
  - **Becoming**: the year spiral, tree rings, and life lines.
- `/journal`: sealed reflections, five lenses of alignment, strands proposed from the person's own words and confirmed by them, offerings to constellations.
- `/ritual/[cadence]`: weekly · lunar · monthly · quarterly · solstice/equinox · solar return. Single, double, and triple-loop questions, with re-vowing and root review at the deep thresholds.
- `/altar/edit`: tend every element. Revising adds a new ring; elements can be questioned, renewed, or composted.
- `/altar/story`: a season or year told in the person's own quotes.
- **Claude (MCP)**: `get_altar`, `get_ritual`, `log_reflection`, `confirm_strands`, `list_reflections`, `open_inquiry`, `update_inquiry`, `propose_element_change`, `get_becoming`, `assemble_story`, `constellation_pulse`. *The person holds the pen*: core changes are proposals they accept in the app.
- **Telegram**: replying to an invitation is reflecting. Commands: `/reflect` `/ritual` `/prayer` `/inquiry` `/pulse`.
- **Dharma Constellations**: roles, shared prayer and works, offered reflections (revocable excerpt copies), witness notes, and accountability partners (who see ritual completions, never content). All of it is consent-gated in Postgres.

**v4.1: the Dreamscape, the Dharma Inquiry, and the Journey** (see `DHARMA_JOURNEY_AND_DREAMSCAPE.md`).
- **One persistent 3D world** behind every page:
  - a starfield and nebula, floating sacred geometry (Flower of Life, Metatron's Cube, Sri Yantra, torus);
  - the prayer-star, the gift constellation and works in orbit, the natal ecliptic, the Moon in its true phase;
  - a dark **reflective lake** that mirrors the sky. Reflections ripple across it, and roots glow beneath it.
  - The camera moves by route: home, altar, inquiry, journey, depths.
  - The world falls back to a still night on reduced motion, without WebGL, or in automated browsers. Set `localStorage eco-dream=live` to force the live world.
- **The glyph compass** (top-right) replaces the masthead. Pages float as veils over the world.
- **`/inquiry`: the Dharma Inquiry.** Seven chambers after Daniel Schmachtenberger's structure (Values, Propensities, Capacities, Karma, Issues & Gifts, Opportunities, Devotion), one question at a time. Answers are sealed at rest. Each chamber has a mirror and proposes seeds for the altar.
- **`/inquiry/vow`**: the Prayer, drafted from the person's own words.
- **`/journey`**: seven stages to develop the practice (Inquiry, Vow, Roots, Paths, Practice, Becoming, Witness), with altar elements sorted by being, doing, and becoming.
- Screens: `screens/dream-*.png`.

## Run & test locally

```bash
# Postgres on :54322 with migrations (see scripts/dev-db.sh; run initdb as a non-root user)
# Ephemeris
cd services/ephemeris && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
PYTHONPATH=. uvicorn ephemeris.main:app --port 8000
PYTHONPATH=. python -m pytest tests -q                    # 36 tests
# Oracles
cd oracle && npm install && node compare.mjs 1000 7 && node compare-vedic.mjs 300 11
# Web
cd apps/web && pnpm install && pnpm test:unit             # 10 unit suites
pnpm build && pnpm exec playwright test                    # 39 e2e (set PW_CHROMIUM_PATH if needed)
node --test supabase/tests/*.test.mjs                      # RLS: consent matrix + altar isolation
```

## Deploy runbook (Benjamin)

Production deploys from `main`. The ephemeris service (`ecodharma-ephemeris`) is deployed separately; v0.2.0 is live as of 2026-10-07.

1. **Database (one paste):** open the Supabase SQL editor, paste `supabase/deploy/v4-living-altar.sql`, and run it. It bundles migrations 0020–0022, runs in a transaction, and is safe to re-run.
2. **Journal key:** in Vercel → ecodharma → Settings → Environment Variables, add `JOURNAL_KEYS` (Production and Preview). Generate the value with `node -e "console.log('1:'+require('crypto').randomBytes(32).toString('base64'))"`. Keep a copy somewhere safe: losing it makes journals unreadable.
3. **Access (optional):** set `ALTAR_ACCESS=open` to let everyone in. Unset means friends and family get access when comped premium via `/curate`.
4. **Redeploy** the latest production deployment so the new variables take effect.
5. **Verify:** open `/api/health/v4`. `ready` should be `true`, with `migrations`, `journal_key`, and `ephemeris_v2` all `true`.
6. **Recompute (optional, recommended):** `DATABASE_URL=… EPHEMERIS_URL=… node scripts/recompute-charts.mjs` (dry run), read `recompute-report.json`, then run again with `--apply`. Affected people see a correction banner and get a free re-draft.
7. **Cron:** `vercel.json` schedules `/api/cron/rituals` hourly (Pro). `CRON_SECRET` must be set.
