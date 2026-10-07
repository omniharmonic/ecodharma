// Run: npx tsx src/lib/altar/cycles.test.mts   (from apps/web)
import assert from "node:assert";
import { carrying, dueRituals, folds, localParts, tzOffset, zonedToUtc, type Prefs } from "./cycles.ts";

// Time zones & DST
assert.equal(tzOffset(Date.UTC(2026, 6, 1), "America/Denver"), -6 * 3600_000); // MDT
assert.equal(tzOffset(Date.UTC(2026, 0, 15), "America/Denver"), -7 * 3600_000); // MST
assert.equal(new Date(zonedToUtc(2026, 10, 4, 18, "America/Denver")).toISOString(), "2026-10-05T00:00:00.000Z");
assert.equal(new Date(zonedToUtc(2026, 11, 8, 18, "America/Denver")).toISOString(), "2026-11-09T01:00:00.000Z"); // after fall-back
assert.equal(localParts(Date.UTC(2026, 9, 5, 3), "America/Denver").dow, 0); // Sun Oct 4, 21:00 MDT

const prefs: Prefs = { weekly_dow: 0, local_hour: 18, tz: "America/Denver", lunar: false, hemisphere: "N" };
const thresholds = [
  { kind: "season", label: "Autumn Equinox 2026", at: "2026-09-23T00:05:13Z" },
  { kind: "season", label: "Winter Solstice 2026", at: "2026-12-21T20:50:15Z" },
  { kind: "new_moon", label: "New Moon", at: "2026-10-10T15:50:07Z" },
  { kind: "full_moon", label: "Full Moon", at: "2026-10-26T04:11:47Z" },
];

// Wed Oct 7 2026, 12:00 MDT → the most recent Sunday 18:00 MDT is Oct 4.
{
  const now = Date.parse("2026-10-07T18:00:00Z");
  const due = dueRituals(prefs, thresholds, [], now);
  const w = due.find((d) => d.cadence === "weekly")!;
  assert.equal(w.due_at, "2026-10-05T00:00:00.000Z");
  assert.ok(due.some((d) => d.cadence === "monthly"), "Oct 1 monthly still open");
  assert.ok(due.some((d) => d.cadence === "quarterly"), "Q4 open");
  assert.equal(due[0].cadence, "quarterly");
  assert.ok(!due.some((d) => d.cadence === "seasonal"), "equinox window closed");
}
// Sunday before 18:00 local → last week's Sunday.
{
  const now = Date.parse("2026-10-11T20:00:00Z"); // 14:00 MDT Sunday
  const w = dueRituals(prefs, thresholds, [], now).find((d) => d.cadence === "weekly")!;
  assert.equal(w.due_at, "2026-10-05T00:00:00.000Z");
}
// Solstice week: seasonal (depth 3) carries; weekly folds into it.
{
  const now = Date.parse("2026-12-22T15:00:00Z");
  const due = dueRituals(prefs, thresholds, [], now);
  assert.equal(due[0].cadence, "seasonal");
  assert.match(due[0].label, /Winter Solstice 2026 — composting/);
  assert.ok(folds(due).some((d) => d.cadence === "weekly"));
  const c = carrying(due, new Set(), new Set());
  assert.equal(c?.cadence, "seasonal");
  assert.equal(carrying(due, new Set(), new Set([`seasonal@${due[0].due_at}`])), null, "already invited");
}
// Lunar only when opted in.
{
  const now = Date.parse("2026-10-11T12:00:00Z");
  assert.ok(!dueRituals(prefs, thresholds, [], now).some((d) => d.cadence === "lunar"));
  assert.ok(dueRituals({ ...prefs, lunar: true }, thresholds, [], now).some((d) => d.cadence === "lunar" && /planting/.test(d.label)));
}
// Solar return.
{
  const now = Date.parse("2027-06-20T12:00:00Z");
  const due = dueRituals(prefs, [], ["2027-06-15T09:12:00Z"], now);
  assert.equal(due[0].cadence, "solar_return");
}
console.log("cycles tests passed");
