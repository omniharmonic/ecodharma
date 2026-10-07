# Oracle findings

*Differential accuracy testing of the EcoDharma ephemeris service against an independent engine. By Benjamin Life (@omniharmonic).*

**Oracle:** [`natalengine`](https://www.npmjs.com/package/natalengine) 1.6.0, built on `astronomy-engine` (VSOP87). That is a different ephemeris, written by different people, from our `pyswisseph`. Agreement between the two is strong evidence of correctness. Every disagreement is a bug in one of them, and each one is explained here.

Run: `cd oracle && npm install && node compare.mjs 1000 7` (ephemeris service on :8000).

## Before the v0.2 fixes (300 births, seed 7)

- **285 / 300 mismatched.**
- Gene Keys Venus & Pearl sequences wrong in ~94% of charts: IQ, EQ, SQ, Vocation, Pearl, and Brand drawn from the wrong planets, and Core missing. → **Our bug (fixed).**
- Every birth in the 00:00–00:59 hour computed as 12:xx (`b.hour or 12`). Moon, all fast activations, profile, type, and authority wrong. → **Our bug (fixed).**

## After the v0.2 fixes (1,000 births, seeds 7 and 99)

| Class | Seed 7 | Meaning |
|---|---|---|
| `match` | 761 | Every activation (gate.line), type, authority, profile, channels, and all 13 GK spheres identical; every non-node longitude within 0.02° |
| `boundary_ambiguous` | 46 | A body within 0.01° (36″) of a line edge, where two good ephemerides can legitimately land on either side. Our response flags these (`edge_arcmin`, `sensitive`) |
| `oracle_imprecision` | 193 | Disagreement traced to the oracle (below) |
| `mismatch` | **0** | |

### Oracle imprecisions, adjudicated

1. **Design-time solver resolves only to the whole minute.** natalengine's 88°-solar-arc search leaves 0.003–0.005° of arc error, so its design instant is up to ~7 minutes off (e.g. 2010-03-05 03:17Z: its design time is 2009-12-08 09:56; the exact arc moment is 09:50:21Z). Our solver converges to <1e-7°. The design Moon moves ~0.55°/h, so this shifts the oracle's design Moon by up to 0.08° and sometimes a line. **Mitigation in the harness:** we evaluate the independent ephemeris *at our exact design instant* and compare gates and lines there (strict). Type, authority, and GK-derived comparisons are skipped only when the oracle's own mis-timed design changes them.
2. **"True node" is an approximation.** natalengine's true node differs from Swiss Ephemeris `TRUE_NODE` by 0.1–0.3°. Swiss Ephemeris is the professional reference, so node disagreements within 0.35° are attributed to the oracle.

### Positional agreement

Personality Sun agrees within ~0.001°, the Moon within ~0.02°, and planets within 0.02°. The remaining differences are aberration/nutation conventions, well inside one gate line (0.9375°) except at true boundaries.

## Not covered by this oracle (covered by unit tests instead)

- Time-zone resolution, DST gaps and folds (`tests/test_fixes.py`)
- Vedic nakshatra, pada, and whole-sign houses (`tests/test_fixes.py`). The oracle's Vedic module could be added later as a second check
- Authority edge rules (Ego-Manifested/Projected, Self-Projected wiring) with synthetic gate sets
- Ritual thresholds against published 2026 equinox/solstice instants

## Vedic cross-check (`compare-vedic.mjs`)

500 births (seed 11): **497 match, 3 boundary-ambiguous (<0.05° from a pada edge), 0 mismatches.** Sidereal longitudes for all seven classical grahas agree within 0.05°; mean Lahiri ayanamsa Δ 0.00026°. The only differences were transliterations (Dhanishta/Dhanishtha), which the harness normalizes.

Found by the unit tests along the way: a longitude exactly on a nakshatra edge (e.g. 40°00′, where Rohini begins) fell into the previous nakshatra because of floating-point division by 13.333…. Fixed with exact ratio arithmetic.
