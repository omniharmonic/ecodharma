# EcoDharma v4: The Living Altar
## Implementation Plan

*By Benjamin Life (@omniharmonic). v1.0, 2026-10-07. Companion docs: [PRD](./PRD.md) · [Technical Architecture](./TECHNICAL_ARCHITECTURE.md) · [Vision & Taxonomy](./VISION_AND_TAXONOMY.md)*

Branch: `v4-living-altar`. Every step ends with tests green and a pushed commit. Status is tracked in the checklist at the bottom of this file.

---

## Phase 0: Repair (truth before beauty)

### 0.1 Ephemeris fixes (`services/ephemeris`)
1. **A1 midnight:** `_birth_jd` uses explicit `None` checks. Test: 00:14 birth ≠ 12:14 birth; Moon differs by more than 5°.
2. **A2 Gene Keys:** rewrite `gene_keys_sequences` with the canonical map and add `core` and `pearl`. Test each sphere against its source activation.
3. **A6 HD authority:** G→Throat connectivity for Self-Projected; Ego-Manifested/Ego-Projected; None/Mental. Unit tests with synthetic gate sets for each authority.
4. **A3/A5 Vedic:** new `vedic.py`: nakshatra/pada/lord, whole-sign houses from lagna, mean-node Rahu/Ketu. Tests: nakshatra boundaries (0°, 13°20′, 359.99°), pada math, whole-sign house assignment.
5. **A8 DST:** gap/fold detection plus `utc`/`utc_offset` echo. Tests: America/New_York 2021-03-14 02:30 (gap) and 2021-11-07 01:30 (fold).
6. **A7 sensitivity:** `boundary_distance_arcmin`, `sensitive`, `time_sensitive_fields`.
7. **A9 SE files:** `SE_EPHE_PATH` switch; engine string reflects which backend.
8. **`/cycles` endpoint:** equinoxes/solstices, lunations, solar return; tests against known 2026 instants (to ±2 min) and hemisphere labels.

### 0.2 Oracle harness (`oracle/`)
1. `oracle/package.json` pins `natalengine`.
2. `compare.mjs`: seeded random births (1900–2025, global lat/lng, random tz from a list) → our service vs natalengine → classify `match | boundary_ambiguous | mismatch`.
3. Investigate every mismatch; record in `oracle/FINDINGS.md`; fix ours or document the oracle's bug.
4. `golden/edge_cases.json` plus a pytest that asserts structural facts for each edge case.

### 0.3 Web-layer accuracy
1. Update types (`lib/types.ts`, `lib/gene-keys.ts`, chart viz) for new GK spheres, nakshatras, and authority names (with an alias map for stored v3 values).
2. Pass nakshatras into the interpret prompt; remove the instruction to "name nakshatras" unless provided.
3. **Interpretation guard** `lib/guard.ts` plus tests; wire it into `interpret.ts`.
4. Show the resolved place, UTC offset, and sensitivity caveats on the profile.

### 0.4 Invitations (nudge rebuild)
1. `lib/invitations.ts`: grounding packet, dedicated prompt, contract, deterministic personalized fallback, refs persisted.
2. Migration `0022` (part): `invitations` table. `runWeeklyNudges` delegates to it.
3. Unit tests: contract rejects each of the three real failure emails verbatim; fallback always passes; refs rotate.
4. Update `e2e/nudges.spec.ts`.

### 0.5 Recompute and notify
1. `scripts/recompute-charts.mjs`: for every `birth_data` → recompute all modalities → structural diff vs stored → write a report (`--dry-run` default) → with `--apply`, store new charts, regenerate the reading, and queue a "what changed" note.
2. Run as a dry run locally against seeded data; production run is a manual step for Benjamin (documented in the runbook).

**Exit criteria:** pytest green · oracle 0 unexplained mismatches · guard tests green · contract tests green · e2e green.

---

## Phase 1: Altar + Journal

1. **Migrations** `0020_altar.sql`, `0021_journal.sql` with RLS policies, plus RLS tests in `supabase/tests/altar_rls.test.mjs`.
2. **`lib/crypto.ts`** plus tests (round trip, tamper detection, key rotation).
3. **Domain:** `lib/altar/{model,repo,kindle,strands,strands-det}.ts` plus unit tests.
4. **Server actions:** `app/actions/altar.ts` (create, revise, setStatus, compost, link), `app/actions/journal.ts` (reflect, confirm strands, alignment).
5. **Pages:**
   - `/altar/kindle`: guided first run (Prayer → Devotions → suggested Paths and Measures → ritual prefs).
   - `/altar`: the Soul's Becoming dashboard shell (views land in Phase 3; Phase 1 ships the console, prayer panel, and journal strip).
   - `/altar/edit`: element editor grouped by kind, with life history.
   - `/journal`: list plus composer plus strand confirmation UI.
6. **MCP v2:** tool registry plus `get_altar`, `log_reflection`, `confirm_strands`, `list_reflections`, `open_inquiry`, `update_inquiry`, `propose_element_change` (+ `altar_proposals` table), `get_becoming`.
7. **Nav:** add Altar and Journal to `TerminalNav`.
8. **E2E:** `altar.spec.ts` (kindle → reflect → confirm strands → see journal).

## Phase 2: Cycles

1. `0022_cycles.sql` (`ritual_prefs`, `rituals`, `ritual_thresholds`).
2. `lib/altar/cycles.ts` (pure) plus tests: weekly due, monthly, quarterly, thresholds, solar return, hemisphere naming, no duplicates.
3. `/api/cron/rituals` plus legacy nudge redirect; update `vercel.json`.
4. `/ritual/[cadence]` guided flow with depth-specific prompts.
5. Telegram: reply-to-reflect, commands; store `platform_message_id` on invitations.
6. MCP: `get_ritual`, `assemble_story` (deterministic digest plus Claude path).
7. E2E: `ritual.spec.ts`, extend `bot.spec.ts`.

## Phase 3: Soul's Becoming

1. Dependencies: `three`, `@react-three/fiber@8`, `@react-three/drei@9`, `d3-force`.
2. `becomingSnapshot()` server action plus `lib/altar/becoming.ts` with tests.
3. `useBreath`, `Telemetry`, `SacredGeometry`, `SoulConsole`.
4. `SkyView` (natal ecliptic, prayer star shader, gifts, orbiting works, stardust nebulae, kin).
5. `SoilView` (mycelium, root status styles, pulses, compost particles, inquiry fruiting bodies).
6. `BecomingView` (year spiral, tree rings, element histories).
7. Reduced-motion and no-WebGL fallbacks; screenshot e2e for each view in both themes.

## Phase 4: Dharma Constellations v2

1. `0023_constellations_v2.sql` (roles, offerings_shared, witness_notes, constellation_altar) plus RLS tests (offer → visible to members → revoke → invisible).
2. Offer-a-reflection UI; witness notes; accountability completion visibility.
3. Shared Prayer for a constellation.
4. Constellation in Sky (3D group) and Soil (shared mycelium).
5. MCP `constellation_pulse`; Telegram `/pulse`.

## Phase 5: Evolution intelligence

1. Threads: periodic proposal job (Claude or a deterministic co-occurrence/charge-trend detector) → accept/rename/dismiss UI.
2. Root strain: ≥3 `strains` on a Root within 60 days → offer an Inquiry (dashboard plus next invitation).
3. Seasonal and solar-return Story.
4. Transit context in seasonal rituals (only after Phase 0 exit criteria hold).

---

## Runbook (deployment steps Benjamin performs)

1. Set `JOURNAL_KEYS` in Vercel (`node -e "console.log('1:'+require('crypto').randomBytes(32).toString('base64'))"`).
2. Apply migrations 0020–0023 to the production database.
3. Redeploy the ephemeris service (new code; optionally upload SE data files and set `SE_EPHE_PATH`).
4. Run `node scripts/recompute-charts.mjs` (dry run), review the report, then `--apply`.
5. Set `ALTAR_ACCESS=invite` and add friends' emails to the allow-list (`app_config.altar_invites`).
6. Update the Vercel cron to `/api/cron/rituals` (hourly on Pro, daily on Hobby).

---

## Progress checklist

- [x] Vision & taxonomy
- [x] PRD · Technical architecture · Implementation plan
- [x] 0.1 Ephemeris fixes
- [x] 0.2 Oracle harness
- [x] 0.3 Web-layer accuracy + guard
- [x] 0.4 Invitations
- [x] 0.5 Recompute script
- [ ] 1 Altar + Journal
- [ ] 2 Cycles
- [ ] 3 Soul's Becoming
- [ ] 4 Constellations v2
- [ ] 5 Evolution intelligence
