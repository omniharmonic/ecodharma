# EcoDharma — working prototype

> *The thing the world most needs from you is the thing you are uniquely able to give — offered in a way that creates upward spirals.*

EcoDharma reads a person through multiple wisdom lenses (Western & Vedic astrology,
Human Design, Gene Keys, Ikigai) and interprets them **through a framework of
regenerative civilization distilled from Benjamin Life's corpus** — producing a
living map of their gifts, their trim-tab actions, and the people they weave with.

This repo is a **runnable, end-to-end-tested v1 prototype** built to the
[PRD](.claude/ecodharma-prd.md), [architecture](.claude/ecodharma-technical-architecture.md),
and [implementation plan](.claude/ecodharma-implementation-plan.md).

## What's built (M0–M5)

| Phase | Deliverable | Status |
|---|---|---|
| **M0** | Framework Artifact distilled from the 188-file omniharmonic corpus by a 19-agent swarm: `framework/framework.json` (v1.0.0 — 9 domains, 14 gifts, 34 trim-tabs, 56 concepts, all with provenance) + `framework/framework.md` | ✅ |
| **M1** | Ephemeris service (`services/ephemeris`) — FastAPI + pyswisseph. Western/Vedic/Human-Design/Gene-Keys/synastry. Positions only (IP-guarded). **11 tests pass.** | ✅ |
| **M2** | Schema + RLS + consent gate (`supabase/`) — consent enforced in Postgres, not app code. **4-case consent matrix passes.** | ✅ |
| **M3** | Reading → Gift Profile (`apps/web`) — onboarding, chart ingest, Ikigai, pluggable interpreter (Claude when `ANTHROPIC_API_KEY` set; deterministic chart-grounded fixture otherwise), persisted profile, profile UI. | ✅ |
| **M4** | Constellations — invite → **active consent** → consent-gated, framework-driven collaboration read; revocation. | ✅ |
| **M5** | Offerings, free/paid quota stub, PWA manifest. | ✅ |
| **E2E** | Playwright: the kinship journey + the consent-gated constellation journey (incl. consent-gate block & revocation). **3 tests pass.** | ✅ |

The EcoDharma voice (`framework/voice/ecodharma-voice@1.0.0.md`) is a versioned system prompt.

## Architecture

```
Next.js (App Router, :3100) ──> Ephemeris service (FastAPI, :8000)   [charts]
        │                  └──> Interpreter (Claude OR fixture)       [meaning]
        └──> Postgres (:54322) with RLS                               [consent gate]
Offline: distillation swarm  ──> framework.json (source of truth)
```

The **consent gate** is the load-bearing design decision: every cross-user data read
runs `SET LOCAL ROLE authenticated` + `request.jwt.claims`, so Postgres RLS — not app
code — guarantees "no silent use of another's data." This mirrors how hosted Supabase
works, so the migration path is: swap the bare-PG + `auth` shim for hosted Supabase Auth.

## Run it locally

Prereqs: Node 20+, pnpm, Python 3.9+ (or Docker for the service), local Postgres 14+.

```bash
# 1. Database (bare Postgres on :54322, applies migrations, seeds framework)
bash scripts/dev-db.sh reset
node scripts/load-framework.mjs

# 2. Ephemeris service (:8000)
cd services/ephemeris && python -m venv .venv && . .venv/bin/activate \
  && pip install -r requirements.txt \
  && PYTHONPATH=. uvicorn ephemeris.main:app --port 8000

# 3. Web app (:3100)
cd apps/web && cp .env.local.example .env.local && pnpm install \
  && pnpm build && pnpm start -p 3100      # or: pnpm dev

# open http://127.0.0.1:3100
```

Set `ANTHROPIC_API_KEY` in `apps/web/.env.local` to use real Claude (Opus for
profiles/group reads, Sonnet for pairs); without it, the deterministic
framework-and-chart-driven interpreter runs (fully offline).

## Test everything

```bash
# ephemeris unit + golden + IP-guard tests
cd services/ephemeris && . .venv/bin/activate && PYTHONPATH=. python -m pytest tests/ -q
# consent matrix (RLS)
node --test supabase/tests/consent_matrix.test.mjs
# e2e (servers must be running)
cd apps/web && pnpm exec playwright test
```

## Re-run the framework distillation

`m0/distill.workflow.js` is the agent-swarm script (map facets over corpus → reduce →
synthesize). It reads the corpus from `omniharmonic-wiki/` (cloned from
`github.com/omniharmonic/wiki`). Re-run on a framework version bump; re-extract with
`scripts/load-framework.mjs`.

## Known limitations / flagged for review

- **`[⚠ FRAMEWORK-SIGNOFF]`** — framework v1.0.0 is swarm-distilled and structurally
  sound (zero dangling trim-tab refs), but the highest-leverage human step (your
  curation of domains/gifts/trim-tabs) is still open. Edit `framework/framework.json`
  and reload.
- **`[⚠ GOLDEN-CALF]`** — the HD gate wheel is verified at two anchors (Gate 25 @ 0°
  Aries, Gate 41 @ 2° Aquarius) and internally consistent, but exact gate/line parity
  with a specific HD provider should be locked against the Golden Calf reference charts
  (`services/ephemeris/tests/test_charts.py` has the structural tests to extend).
- **Auth** is a local email/password + signed-cookie shim. Production should use hosted
  Supabase Auth (the schema + RLS already match).
- Birth-data encryption-at-rest, name/trademark clearance, and Phase 2 (forecast,
  marketplace) are out of scope for this prototype.

*Authored toward the commons. Code open source; framework intended CC BY-SA.*
