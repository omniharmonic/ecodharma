// Run: npx tsx src/lib/altar/becoming.test.mts   (from apps/web)
import assert from "node:assert";
import { loopState, moonPhase, moonPhaseName, reflectionCharges, strainedRoots, vitals, type SnapElement, type SnapStrand } from "./becoming.ts";

const now = Date.parse("2026-10-07T12:00:00Z");
const day = (d: number) => new Date(now - d * 86_400_000).toISOString();
const els: SnapElement[] = [
  { lineage_id: 1, kind: "work", title: "EcoDharma", status: "active", version: 1, created_at: day(100), retired: false },
  { lineage_id: 2, kind: "root", title: "Self-sustaining", status: "held", version: 1, created_at: day(100), retired: false },
];
const strands: SnapStrand[] = [
  { reflection_id: 10, lineage_id: 1, relation: "embodies", charge: 2, status: "confirmed", at: day(3) },
  { reflection_id: 11, lineage_id: 1, relation: "embodies", charge: 1, status: "confirmed", at: day(10) },
  { reflection_id: 12, lineage_id: 1, relation: "strains", charge: -1, status: "rejected", at: day(10) },
  { reflection_id: 10, lineage_id: 2, relation: "strains", charge: -2, status: "confirmed", at: day(3) },
  { reflection_id: 11, lineage_id: 2, relation: "strains", charge: -1, status: "confirmed", at: day(20) },
  { reflection_id: 13, lineage_id: 2, relation: "strains", charge: -1, status: "proposed", at: day(40) },
];
const v = vitals(els, strands, [{ reflection_id: 10, lineage_id: 1, lens: "aliveness", value: 5, at: day(3) }], now);
assert.equal(v.get(1)!.touches, 2);
assert.equal(v.get(1)!.charge, 1.5);
assert.equal(v.get(1)!.aliveness, 5);
assert.equal(v.get(2)!.strain, 2);
assert.deepEqual(strainedRoots(els, strands, now), [2]); // 2 confirmed + 1 proposed = 3
assert.equal(reflectionCharges(strands).get(10), 0);

const ls = loopState([
  { id: 1, at: day(1), cadence: "weekly", depth: 1 },
  { id: 2, at: day(8), cadence: "weekly", depth: 1 },
  { id: 3, at: day(30), cadence: "monthly", depth: 2 },
], now);
assert.equal(ls.single.count90, 2);
assert.equal(ls.triple.last, null);
assert.ok(ls.pulse > 0.4 && ls.pulse <= 1);

// 2026-10-26 ~04:12Z is a full moon; 2026-10-10 ~15:50Z a new moon.
assert.equal(moonPhaseName(moonPhase(new Date("2026-10-26T04:00:00Z"))), "Full Moon");
assert.equal(moonPhaseName(moonPhase(new Date("2026-10-10T16:00:00Z"))), "New Moon");
console.log("becoming tests passed");
