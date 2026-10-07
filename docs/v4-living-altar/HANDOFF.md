# EcoDharma v4 "The Living Altar": Handoff for the local agent

*Prepared 2026-10-07 at the end of a cloud Claude Code session, for the next local session (which has the Vercel and Supabase CLIs). Work by Benjamin Life (@omniharmonic). Attribute to Benjamin, never as representative of OpenCivics or OpenCivics Labs.*

**Read this first, then:**
- `VISION_AND_TAXONOMY.md` (the why)
- `DHARMA_JOURNEY_AND_DREAMSCAPE.md` (the inquiry and the 3D UX)
- `README.md` (what was built, and the deploy runbook)

The PRD, architecture and implementation plan sit beside them in `docs/v4-living-altar/`.

---

## 0. TL;DR: where things stand

| | State |
|---|---|
| Code | Complete for v4 and v4.1. `main` = `v4-living-altar` = `310aa04`. Nothing uncommitted. No PR was ever opened: the branch was fast-forwarded into `main` at Benjamin's request to deploy. |
| Web app (Vercel project `ecodharma`) | **Live** at ecodharma.xyz from `310aa04` (deployment `dpl_3UzVYDDH6KMrCfycNx8pyunixoa2`). Production deploys automatically from `main` via the GitHub integration. |
| Ephemeris (Vercel project `ecodharma-ephemeris`) | **Live, v0.2.0** at `ecodharma-ephemeris.vercel.app` (`dpl_HZuLDCZ8eM8aCoqSqqdjggZi4u76`). It is **not** git-connected. See §5 for the root-directory gotcha. |
| Production DB | **Not migrated.** The v4 tables do not exist yet. The cloud session had no DB credentials and Vercel refused env reads and writes (403). |
| `JOURNAL_KEYS` | **Not set** in Vercel. Production refuses to encrypt or decrypt journals without it. |
| Readiness | `GET https://ecodharma.xyz/api/health/v4` currently returns `ready:false` (migrations ✗, journal_key ✗, ephemeris_v2 ✓, cron_secret ✓). |
| Tests | 40/40 Playwright e2e, every unit suite, 36 ephemeris pytest, 5 RLS tests, plus the differential oracles (0 unexplained mismatches): all green locally at `310aa04`. |

**Your first job is to finish the production deploy (§1) and then verify the new flows on production (§2).** Everything else is backlog (§9).

---

## 1. Finish the production deploy (do this first)

Pre-v4 code ignores the new tables, so steps 1–2 are safe to do in any order. Nothing current users touch (reading, onboarding, profile) depends on them. The v4 surfaces that do depend on them are `/altar*`, `/journal`, `/ritual/*`, `/inquiry*`, `/journey*`, and the MCP/Telegram altar tools. **The Monday nudge cron (`/api/cron/nudges`, Mon 15:00 UTC) will error until migrations are applied**, so do this before Monday.

1. **Find the production database.** The repo uses a Supabase layout (`supabase/`, `config.toml` project_id `ecodharma`), but past migrations were applied by hand. Confirm the target before writing anything:
   - Check the production `DATABASE_URL`: `vercel env ls production` in `apps/web` (linked to project `ecodharma`, team `omniharmonics-projects` / `team_Jr0rIO2iOWk02yKAVI4TnUYt`). Pull it with `vercel env pull` only with Benjamin's OK.
   - Or `supabase projects list`, then `supabase link`.
   - Confirm migrations 0001–0019 are present (for example, `constellation_members.consent_id` from 0019 exists).
2. **Apply the v4 schema.** Run `supabase/deploy/v4-living-altar.sql`. It bundles `0020_living_altar`, `0021_dharma_constellations` and `0022_dharma_inquiry` in one transaction and is idempotent; it was tested on a fresh 0001–0019 schema, run twice. For example: `psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/deploy/v4-living-altar.sql`, or paste it into the Supabase SQL editor. **Confirm with Benjamin before writing to production.**
3. **Set the journal keyring** in Vercel (Production and Preview):
   - Generate: `node -e "console.log('1:'+require('crypto').randomBytes(32).toString('base64'))"`, then `vercel env add JOURNAL_KEYS production` (and `preview`).
   - Benjamin may already hold a key generated in the cloud session; ask before generating a new one.
   - **Never commit the key.** Benjamin must keep a copy somewhere safe: losing it makes every journal unreadable. Rotation is supported (`1:<old>,2:<new>`; the highest id encrypts, any listed id decrypts).
4. **Access (Benjamin's call).** `ALTAR_ACCESS=open` lets everyone in. Unset (`invite`) means only premium or comped users (comp via `/curate`). Friends and family are the audience, so `open` is likely what he wants. Ask.
5. **Redeploy** so the env vars take effect: `vercel redeploy <latest prod deployment url>`, or trigger it from the dashboard.
6. **Verify:** `curl https://ecodharma.xyz/api/health/v4` should return `{"ready":true, "migrations":true, "journal_key":true, "ephemeris_v2":true, ...}`.
7. **Recompute charts** (recommended; Phase 0 fixed real accuracy bugs). Dry run first:
   ```bash
   DATABASE_URL=… EPHEMERIS_URL=https://ecodharma-ephemeris.vercel.app [EPHEMERIS_TOKEN=…] node scripts/recompute-charts.mjs
   # read recompute-report.json (who changed and how), show Benjamin, then:
   … node scripts/recompute-charts.mjs --apply
   ```
   Affected people get a correction banner and a free re-draft.
8. **Cron:** `apps/web/vercel.json` schedules `/api/cron/rituals` hourly (`7 * * * *`) and nudges weekly. Hourly needs Vercel Pro. If the team is on Hobby, change it to daily. `CRON_SECRET` is already set.

---

## 2. Verify on production (after §1)

Walk these flows as a real user (Benjamin's account, or a test account he approves). Don't create noise on his live friends' data.

1. **Home** (`/`, logged out): the dreamscape (stars, nebula, floating sacred geometry, reflective lake), the "Your soul is a constellation" invocation, and the "Begin your reading" CTA.
2. **Compass menu**, top-right glyph: Altar, Inquiry, Journey, Journal, Constellations, Profile, Settings, and Sign out.
3. **Inquiry** (`/inquiry`): the frame, then six chambers. In Values, try "↳ and why?" two layers deep. In any chamber, try "go deeper". Close the chamber to see the mirror (Claude if `ANTHROPIC_API_KEY` is set and Claude mode is on, else deterministic), then place seeds.
4. **Vow** (`/inquiry/vow`): your own words come back, the deepest *why* first. The facets are pre-drafted. "Vow it" leads to `/journey?vowed=1`.
5. **Journey** (`/journey`, `/journey/{roots,paths,practice,becoming}`): stages I–II auto-complete. Do III–VI. VII (Witness) completes when a consented co-member exists.
6. **Altar** (`/altar`): the prayer panel, the lens dock (Orrery / Depths / Becoming), the journal strip, and the 3D sky with water reflection.
7. **Journal** (`/journal`): reflect, review the proposed strands, weave. The text is sealed in the DB (`reflections.body_enc` is ciphertext).
8. **Ritual** (`/ritual/seasonal` or `/ritual/quarterly`): the last step is a returning Dharma Inquiry question showing your previous answer.
9. **Constellations:** consent, shared prayer, offering an excerpt, witness notes, and revocation hides everything.
10. **MCP** (`/api/mcp`, v2.0.0): `get_altar`, `get_ritual`, `log_reflection`, etc. from Claude. **Telegram:** replying to an invitation is a reflection, plus the `/reflect /ritual /prayer /inquiry /pulse` commands.
11. **Phone:** real-device WebGL performance has **not** been tested (only SwiftShader and screenshots). Check iOS Safari and Android Chrome. Phones must render at true width; that was fixed once, so watch for regressions.

The 3D world deliberately falls back to a still night for `prefers-reduced-motion`, missing WebGL, or `navigator.webdriver`. `localStorage.setItem('eco-dream','live')` forces the live world; `'still'` forces the still one.

---

## 3. The arc: what we're building and why

EcoDharma began as a one-time "reading": natal astrology, Vedic, Human Design and Gene Keys, interpreted through a framework of 10 gifts × 9 world-works (the "work that is only yours"). Benjamin's v4 vision turns it into **an ongoing practice: the Living Altar**.

- **The altar is the prayer of your life.** Elements: **prayer** (the centre, versioned as tree rings), devotions, roots (beliefs, with states held / questioning / composting / renewed), works, practices, measures, inquiries, threads, capacities. Each has a **mode** (being / doing / becoming) and roots have a **scope** (universal / unique). The model is in `apps/web/src/lib/altar/model.ts`.
- **The journal** feeds it. Reflections are sealed with AES-256-GCM. Each one proposes **strands**: links like *embodies, strains, questions, evidences, nourishes, releases, discovers*, with a charge and a verbatim quote, drawn from your own words. You confirm them. Five **lenses** of alignment: Aliveness, Fidelity, Constitution, Reciprocity, Fruit.
- **Cycles** set the rhythm: weekly (single loop), lunar, monthly and quarterly (double loop), solstices, equinoxes and solar return (triple loop: the prayer and roots themselves are revisable). They're TZ/DST-correct; the deepest due ritual carries and folds the shallower ones.
- **Invitations** replaced the broken weekly nudges, which used to send generic Claude text. Every invitation must pass a grounding contract (≥2 references to the person's own altar or reading, no meta-language, no repetition), or it isn't sent.
- **Soul's Becoming**, the "interactive dashboard for your soul's becoming": Orrery (mandala), Depths (mycelial roots), Becoming (year spiral, tree rings, life lines), and the **Dreamscape**, the 3D world everything lives inside.
- **Dharma Constellations:** people who co-arise. Roles (kin, accountability partner…), a shared prayer, offered reflection excerpts (revocable copies), witness notes, accountability that sees completions and never content. Everything is consent-gated in Postgres RLS (`is_consented_member`).
- **Claude everywhere:** MCP v2 lets Claude hold the altar with you ("the person holds the pen": core changes are proposals the person accepts). Telegram is the everyday channel.
- **Accuracy first:** Phase 0 fixed real chart bugs (see §6) and proved the fixes against an independent engine.

**v4.1 (Benjamin's third message)** added three things:
- The **Dharma Inquiry**, an intake that helps people articulate their altar, following Daniel Schmachtenberger's *Dharma Inquiry*.
- The **Dharma Journey**, a seven-stage practice-development path.
- A complete **UX rebuild as a "Jungian dreamscape where your soul reveals itself"**: full-bleed, the 3D constellation as the base of the UX, a pool of dark reflective water mirroring the sky, sacred geometry floating in space.

**Aesthetic north star (Benjamin's words):** "immanent metaphysics cybernetic living systems dashboard with sacred flourishes and epic multidimensional visualizations", and it should feel "dynamic and alive and pulsing". Always night. Gold (#ffc878 / #ffd9a0) on deep blue-black (#02070c). Fraunces display, Archivo body, IBM Plex Mono whispers. Pages are translucent "veils" floating over the world.

### The Dharma Inquiry: important context
- Benjamin pasted Daniel's **full text** on 2026-10-07. The app now follows it exactly:
  - six chambers in his order: **Values, Propensities, Capacities, Karma, Patterns, Guidance**;
  - the **why-ladder** in Values and Capacities ("ask why … until fundamental");
  - **gift and shadow** explored together;
  - **being/doing/becoming** questions;
  - **ongoing and unending**: deep rituals return to one inquiry question, showing your last answer.
- **Copyright choice:** questions are *paraphrased* in our own voice, with short attributed phrases and a link to the original (https://civilizationemerging.com/dharma-inquiry-2/) from every chamber. **Do not commit Daniel's full text to the repo.** If Benjamin gets Daniel's permission for verbatim use, every question lives in one place: `CHAMBERS` in `apps/web/src/lib/altar/inquiry.ts`.
- An earlier build had seven *reconstructed* chambers (Issues & Gifts, Opportunities, Devotion). They are gone. Production never stored answers under those ids because the tables were never migrated, so no data migration is needed.

---

## 4. Code map (where things live)

```
apps/web/                         Next.js 14 App Router, React 18, Tailwind, pnpm
  src/app/
    page.tsx                      home: the invocation + three veils (Sky/Surface/Depths) + inquiry veil
    layout.tsx                    <DreamLayer/> (world) + #app-root (GlyphCompass, main.dream-main, TerminalNav)
    altar/ (page, kindle, edit, story)   journal/   ritual/[cadence]/
    inquiry/ (page, [chamber], vow)       journey/ (page, [stage])
    constellations/ …             settings/ profile/ onboarding/ curate/ …   (still older styling, see backlog)
    actions/altar.ts, inquiry.ts, dharma.ts   server actions
    api/altar/snapshot            data for the 3D world ({snap} or {snap:null, natal})
    api/cron/rituals              hourly; ?at= is a test seam
    api/cron/nudges               weekly invitations
    api/mcp                       MCP v2 (registry in lib/mcp-tools.ts)
    api/bot/telegram              reply-to-reflect, voice
    api/health/v4                 deploy readiness (booleans only)
  src/lib/
    altar/model.ts                kinds, modes, lenses, KIND_META/MODE_META
    altar/repo.ts                 element CRUD, rings (lineage_id), refreshThreads
    altar/inquiry.ts              ★ the six chambers, why-ladder (WHY / layers / fundamental), proposals, prayer material, mirror, returnQuestion (pure)
    altar/inquiry-repo.ts         sealed answers, Claude mirror, journey STAGES + progress
    altar/prompts.ts              ritual specs per cadence (+ the returning inquiry step)
    altar/cycles.ts, rituals.ts   due logic + cron; thresholds from ephemeris /cycles
    altar/strands*.ts, threads.ts, story.ts, becoming.ts, snapshot.ts, constellations.ts, bot-altar.ts, access.ts
    invitation-core.ts, invitations.ts, nudges.ts   grounding contract + composer
    guard.ts, interpret.ts        interpretation guard (prose claims checked against chart facts)
    crypto.ts                     JOURNAL_KEYS envelopes (prod refuses without keys)
  src/components/dream/
    Dreamscape.tsx                three.js / r3f world: stars, nebula, prayer-star, gifts, works in orbit, natal ecliptic, moon phase, Reflector lake with ripples, roots, bloom
    DreamLayer.tsx                live vs still decision; fetches snapshot; sets html[data-immersive]
    bus.ts                        places/poses per route, eco:dream events (focus/ripple/refresh/select)
    GlyphCompass.tsx, AltarHUD.tsx, ChamberFlow.tsx (one question at a time, ladder, deeper), StillNight.tsx, geometry.ts
  src/app/globals.css             tokens + the big DREAMSCAPE section (veils, dream-btn, chamber-head, …)
  e2e/                            Playwright (40 tests); helpers.signOut opens the compass
services/ephemeris/               FastAPI + pyswisseph (Moshier); astro, human_design, gene_keys, vedic, cycles; tests/
oracle/                           differential oracles (natalengine) + FINDINGS.md
supabase/migrations/0001–0022     schema + RLS;  supabase/deploy/v4-living-altar.sql = 0020–0022 bundle
supabase/tests/                   RLS tests (altar_rls, consent_matrix)
scripts/recompute-charts.mjs      find changed charts, notify, offer re-draft
docs/v4-living-altar/             all design docs + screens/*.png
```

**Patterns to keep:**
- DB access goes through `withUser(userId, fn)` (`SET LOCAL ROLE authenticated` plus JWT claims, so RLS applies) or `withService`.
- Intimate free text is always encrypted (`encrypt`/`encOpt`/`decOpt`).
- Pure logic lives in `*.ts` with `*.test.mts` beside it (run via tsx).
- Pages are server components. Forms use server actions with `MessageForm` / `SubmitButton`.
- Every interactive element has a `data-testid`.

---

## 5. Environments and deploy mechanics

- **Vercel team:** `omniharmonics-projects` (`team_Jr0rIO2iOWk02yKAVI4TnUYt`).
  - `ecodharma`: `prj_ym9xzTyopiNqO8JQXTeHmkF5WA8n`, root `apps/web`, Next.js, Node 24. Domains: ecodharma.xyz, www., ecodharma.vercel.app.
  - `ecodharma-ephemeris`: `prj_XAx6CCQOc7EnS4jHmUP8Kydt9Ji5`, Python. `api/index.py` re-exports FastAPI, and `vercel.json` rewrites everything there.
- **⚠ Ephemeris root-directory gotcha:** the cloud session deployed it via the API from GitHub with `projectSettings.rootDirectory = "services/ephemeris"`. If that setting persisted, running `vercel deploy` *from inside* `services/ephemeris` will look for `services/ephemeris/services/ephemeris`. Either:
  - deploy from the repo root (`vercel deploy --prod --cwd .` with the project linked), or
  - reset the root directory in project settings. Better yet:
  - connect the project to GitHub with root `services/ephemeris`, so it deploys on push like the web app.

  Check with `vercel project inspect ecodharma-ephemeris`.
- **Web env vars in use:** `DATABASE_URL`, `SESSION_SECRET`, `EPHEMERIS_URL`, `EPHEMERIS_TOKEN` (optional), `JOURNAL_KEYS` (**missing**), `ALTAR_ACCESS` (optional), `CRON_SECRET` (set), `ANTHROPIC_API_KEY`, `ECODHARMA_BOT_MODEL` / `ECODHARMA_INVITE_MODEL` / `ECODHARMA_STRAND_MODEL` (optional model overrides), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `SLACK_*`, `STRIPE_*`, `RESEND_API_KEY`, `GEOCODING_API_KEY`, `NEXT_PUBLIC_SITE_URL`, `FRAMEWORK_PATH`/`VOICE_PATH`.
  - Model defaults in code are `claude-sonnet-4-6`-era ids. Consider updating the defaults and env to current Claude models (Sonnet 5.5 / Opus 5.5 / Haiku 4.5) if Benjamin wants.
- **Git conventions:** work on a branch. Commit messages end with Benjamin's required trailer (`Co-Authored-By: Claude … <noreply@anthropic.com>`; follow your session's attribution instructions). Never put model identifiers in code, commits or PRs. Don't open PRs unless asked. Production = `main`.

---

## 6. Accuracy work (Phase 0): don't regress

Fixed in `services/ephemeris`, verified by `oracle/compare.mjs` and `compare-vedic.mjs` against natalengine (astronomy-engine), with the oracle's own flaws adjudicated in `oracle/FINDINGS.md`:
- Midnight births were computed as noon (`b.hour or 12`).
- Gene Keys sphere map corrected: Attraction = Design Moon, IQ = P.Venus, EQ = P.Mars, SQ = D.Venus, Core = Vocation = D.Mars, Culture = D.Jupiter, Pearl = P.Jupiter, Brand = P.Sun.
- HD authority wiring: Self-Projected requires G→Throat; Ego-Manifested and Ego-Projected distinguished.
- Vedic: nakshatra/pada by exact integer-ratio math; whole-sign houses; mean node.
- DST gap/fold warnings; polar Porphyry fallback; boundary and time-sensitivity disclosure; exact `design_utc`.
- `/cycles` endpoint (equinoxes, solstices, lunations, solar return).

The interpretation guard (`lib/guard.ts`) checks placement claims in prose against chart facts.

---

## 7. Running everything locally

```bash
# Postgres on :54322 with every migration (bare cluster, no Docker), or `supabase start` + `supabase db reset`
scripts/dev-db.sh reset            # initdb must run as a non-root user
# Ephemeris
cd services/ephemeris && python -m venv .venv && .venv/bin/pip install -r requirements.txt pytest
.venv/bin/uvicorn ephemeris.main:app --port 8000      # /healthz → 0.2.0
.venv/bin/pytest -q                                    # 36 pass
# Oracles
node oracle/compare.mjs && node oracle/compare-vedic.mjs
# Web
cd apps/web && cp .env.local.example .env.local        # add JOURNAL_KEYS (any test key) + ALTAR_ACCESS=open
pnpm i && pnpm build
pnpm test:unit                                         # guard, invitation-core, crypto, strands-det, becoming, cycles, threads, inquiry, …
pnpm test:e2e                                          # 40 tests; starts its own server on :3101 (fixture interpreter, test JOURNAL_KEYS)
node --test ../../supabase/tests/altar_rls.test.mjs    # 5 RLS tests
```

- E2E needs Postgres on :54322 and the ephemeris service on :8000.
- `PW_CHROMIUM_PATH` was only needed in the cloud container; locally, Playwright's own Chromium is fine.
- To screenshot the *live* 3D world in Playwright, set `localStorage eco-dream=live` with `addInitScript` (webdriver otherwise forces the still night).

---

## 8. Decisions already made (don't relitigate)

- **Sacred names stay:** Prayer, Devotions, Roots, Works, Practices, Measures, Strands, Rings, Lenses.
- **Alignment is qualitative and quantitative:** five lenses, −2..2 or a note.
- **Server-side journal encryption is enough** for now; the audience is friends and family.
- **No HD MCP:** Human Design is computed in our ephemeris and checked by the oracle.
- **The person holds the pen:** Claude never writes someone's prayer. MCP changes to core elements are proposals.
- **Privacy:** constellations see only what's explicitly offered. Accountability sees completions, not content.
- **Always night;** the Newsprint light theme is effectively retired in the dreamscape shell.
- **The Dharma Inquiry is paraphrased with attribution;** no verbatim text without Daniel's permission.

---

## 9. Backlog (prioritized)

1. **Finish §1 and §2** (prod migration, keys, redeploy, verify, recompute). Highest priority.
2. **Real-device check of the 3D world** (iOS Safari, Android). Tune `Dreamscape.tsx` for low-power GPUs if needed: fewer stars and motes, lower bloom, cap DPR, maybe drop the Reflector resolution. Consider an automatic still mode on low FPS.
3. **Restyle the remaining pages as veils:** settings, constellations (list and detail), onboarding, profile/reading, curate, work, journal. They work, but still carry pre-dreamscape styling over the night.
4. **Copy polish:**
   - Seed titles insert phrases mid-sentence with their original capital ("Is Checking my phone compulsion or dharma?"). Lowercase the first letter when it isn't a proper noun or "I". A heuristic is fine; keep names like "Joanna Macy".
   - Read through all inquiry and journey copy with Benjamin.
5. **Journey nudges:** invitations and Telegram should follow the journey stage by stage until done, then hand off to the ritual calendar. This is designed in DHARMA_JOURNEY_AND_DREAMSCAPE.md but only partially wired; check `invitations.ts` and `bot-altar.ts`.
6. **MCP inquiry tools:** expose `get_inquiry` / `answer_inquiry` / `journey_status` so Claude can walk someone through a chamber conversationally, honoring the why-ladder. Today the MCP points people to `/inquiry`.
7. **Model ids:** move invitation, strand, mirror and bot defaults to current models via env.
8. **Ephemeris:** connect it to Git (see §5). Optionally upload the Swiss Ephemeris files and set `SE_EPHE_PATH` (Moshier is accurate to arc-seconds; files are better for edge cases).
9. **Cron plan check** (Pro vs Hobby) and an alert if `/api/cron/rituals` fails.
10. **If Daniel grants permission:** swap in his verbatim questions (one file), and credit per his wishes.

---

## 10. Working with Benjamin (house rules)

- Benjamin is a technical non-developer. He wants the work done, not narrated. Be terse, act first, then report the result plainly, with options when something is blocked.
- **Confirm before anything outward-facing or hard to reverse:**
  - production DB writes, recompute `--apply`, deleting anything;
  - emails, Telegram messages, or tweets sent to people;
  - the env changes that affect live users (ask for the go-ahead once and batch them).
- Markdown deliverables, never docx. Emails are plain text with no markdown. Call him "Benjamin", never "Ben".
- His second brain is **Parachute** (MCP/deferred tools, `query-notes`). Search it first for anything about his people, projects or past decisions.
- Attribution: work by Benjamin Life (@omniharmonic). Never present it as OpenCivics or OpenCivics Labs.
