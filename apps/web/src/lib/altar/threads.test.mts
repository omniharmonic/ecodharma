// Run: npx tsx src/lib/altar/threads.test.mts   (from apps/web)
import assert from "node:assert";
import { detectThreads } from "./threads.ts";

const now = Date.parse("2026-10-07T00:00:00Z");
const d = (n: number) => new Date(now - n * 86_400_000).toISOString();
const el = (id: number, title: string, kind: any = "work") => ({ lineage_id: id, kind, title, status: "active", version: 1, created_at: d(200), retired: false });
const els = [el(1, "Teaching"), el(2, "Fundraising"), el(3, "Morning sit", "practice"), el(4, "Newsletter")];
const st = (r: number, id: number, charge: number, days: number) => ({ reflection_id: r, lineage_id: id, relation: "embodies" as const, charge, status: "confirmed", at: d(days) });
const strands = [
  st(1, 1, 2, 5), st(2, 1, 1, 15), st(3, 1, 2, 30),
  st(1, 2, -2, 5), st(2, 2, -1, 15), st(3, 2, -1, 30),
  st(1, 3, 1, 5), st(2, 3, 1, 15), st(3, 3, 0, 30),
  st(7, 4, 1, 100), st(8, 4, 1, 110), st(9, 4, 1, 120),
];
const t = detectThreads(els, strands, now);
const sig = new Set(t.map((x) => x.signature));
assert.ok(sig.has("radiance:1"));
assert.ok(sig.has("contraction:2"));
assert.ok(sig.has("kinship:1-2") && sig.has("kinship:1-3"));
assert.ok(sig.has("quiet:4"));
assert.ok(!sig.has("radiance:3"), "mean 0.67 < 1");
assert.match(t.find((x) => x.signature === "contraction:2")!.why, /work, or the way/);
console.log("threads tests passed");
