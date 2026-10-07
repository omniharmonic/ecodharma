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

1. **Journal key (required):** `node -e "console.log('1:'+require('crypto').randomBytes(32).toString('base64'))"` → set `JOURNAL_KEYS` in Vercel. Keep a copy somewhere safe: losing it makes journals unreadable.
2. **Migrations:** apply `supabase/migrations/0020_living_altar.sql` and `0021_dharma_constellations.sql` to production.
3. **Ephemeris:** redeploy `services/ephemeris` (v0.2). Optional: upload Swiss Ephemeris data files and set `SE_EPHE_PATH`.
4. **Recompute:** `DATABASE_URL=… EPHEMERIS_URL=… node scripts/recompute-charts.mjs` (dry run), read `recompute-report.json`, then run again with `--apply`. Affected people see a correction banner and get a free re-draft.
5. **Access:** leave `ALTAR_ACCESS` unset (`invite`): friends and family get access when comped premium via `/curate`. Set `ALTAR_ACCESS=open` to open it to everyone.
6. **Cron:** `vercel.json` schedules `/api/cron/rituals` hourly (Pro). On Hobby, change it to daily. `CRON_SECRET` must be set.
7. **Telegram:** existing bot; nothing new to configure. Invitations go to whoever chose Telegram as a channel.
