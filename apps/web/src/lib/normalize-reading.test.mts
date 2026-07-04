// Run: npx tsx src/lib/normalize-reading.test.mts   (from apps/web)
// Adversarial shapes for the reading normalizer — every field the model (or a
// legacy DB row) can get wrong must come back structurally valid, never throw.
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeReading, healReadingCore } from "./normalize-reading.ts";
import type { Framework } from "./types.ts";

// --- total garbage in, valid profile out ---------------------------------------
for (const junk of [null, undefined, 42, "not json {", [], "{}", { nested: { deep: true } }]) {
  const gp = normalizeReading(junk);
  assert(Array.isArray(gp.chart_threads), `chart_threads array for ${JSON.stringify(junk)}`);
  assert(Array.isArray(gp.trim_tabs), "trim_tabs array");
  assert(typeof gp.recognition === "string" && typeof gp.portrait === "string", "string scalars");
}

// --- the production crash: required array fields returned as non-arrays --------
// (this is the shape class behind 'W.map is not a function' on /profile)
const malformed = normalizeReading({
  recognition: "You are seen.",
  portrait: 12345, // wrong type
  chart_threads: "Sun in Scorpio means depth", // string where array expected
  gift_constellation: { gift_id: "weaver" }, // object where array expected
  lens_readings: "astrology: ...", // string where array expected
  unique_gifts: "one long string", // string where array expected
  domains: null,
  pairings: { gift_id: "weaver", domain_id: "food" }, // object where array expected
  orientations: 7,
  shadow: "perfectionism",
  trim_tabs: "do the thing",
  narrative: ["a", "b"], // array where string expected
});
assert.equal(malformed.recognition, "You are seen.");
assert.equal(malformed.portrait, "");
assert.deepEqual(malformed.chart_threads, []);
assert.deepEqual(malformed.gift_constellation, []);
assert.deepEqual(malformed.lens_readings, []);
assert.deepEqual(malformed.unique_gifts, []);
assert.deepEqual(malformed.domains, []);
assert.deepEqual(malformed.pairings, []);
assert.deepEqual(malformed.orientations, []);
assert.deepEqual(malformed.shadow, []);
assert.deepEqual(malformed.trim_tabs, []);
assert.equal(malformed.narrative, "");
// Every field the /profile page .map()s over is now provably an array:
for (const k of ["chart_threads", "gift_constellation", "lens_readings", "unique_gifts", "domains", "orientations", "shadow", "trim_tabs"] as const) {
  assert(Array.isArray(malformed[k]), `${k} must be an array`);
}

// --- arrays with junk items: junk dropped, good items kept + coerced ------------
const mixed = normalizeReading({
  chart_threads: [
    null,
    "just a string",
    { modality: "klingon", placement: "Sun in Qo'noS" }, // unknown modality -> dropped
    { modality: "western", placement: "Sun in Scorpio, 8th house", great_turning_link: "because depth, you compost what others avoid", plain_meaning: 9 },
  ],
  lens_readings: [
    { lens: "astrology", title: "Astrology", reading: "Two paragraphs…", placements: "Sun in Scorpio" }, // placements string -> []
    { lens: "gene_keys", reading: null, placements: [null, { label: "Life's Work in Gate 34", meaning: "strength", great_turning: "stamina for the long haul" }] },
    { lens: "nonsense" },
  ],
  gift_constellation: [{ gift_id: "weaver", how_they_carry: "quietly", prominence: "high" }, { how_they_carry: "no id -> dropped" }],
  unique_gifts: ["  real gift  ", 42, null, ""],
  domains: [{ domain_id: "food", why: "because" }, { why: "no id" }, "junk"],
  pairings: [{ gift_id: "weaver", domain_id: "food" }, { gift_id: "weaver" }],
  shadow: [{ pattern: "perfectionism", how_to_relate: "gently" }, { how_to_relate: "no pattern" }],
  trim_tabs: [{ action: "host a meal", domain_id: "food", upward_spiral: "it compounds" }, { domain_id: "no action" }],
});
assert.equal(mixed.chart_threads.length, 1);
assert.equal(mixed.chart_threads[0].plain_meaning, "");
assert(mixed.chart_threads[0].note.length > 0, "note derived from great_turning_link");
assert.equal(mixed.lens_readings!.length, 2);
assert.deepEqual(mixed.lens_readings![0].placements, []);
assert.equal(mixed.lens_readings![1].placements.length, 1);
assert.deepEqual(mixed.gift_constellation, [{ gift_id: "weaver", how_they_carry: "quietly" }]);
assert.deepEqual(mixed.unique_gifts, ["real gift"]);
assert.deepEqual(mixed.domains, [{ domain_id: "food", why: "because" }]);
assert.deepEqual(mixed.pairings, [{ gift_id: "weaver", domain_id: "food" }]);
assert.deepEqual(mixed.shadow, [{ pattern: "perfectionism", how_to_relate: "gently" }]);
assert.equal(mixed.trim_tabs.length, 1);
assert.equal(mixed.trim_tabs[0].action, "host a meal");

// --- a healthy reading passes through unchanged where it matters ---------------
const healthy = {
  recognition: "Seen.",
  portrait: "A long portrait.",
  narrative: "Coda.",
  chart_threads: [{ modality: "human_design", ref: "Sacral", note: "note", placement: "Defined sacral", plain_meaning: "steady", great_turning_link: "because steady, you sustain", tone: "gift" }],
  gift_constellation: [{ gift_id: "weaver", how_they_carry: "quietly", prominence: 0.9 }],
  lens_readings: [{ lens: "human_design", title: "Human Design", summary: "s", reading: "r", placements: [{ label: "Emotional authority", meaning: "m", great_turning: "g" }] }],
  unique_gifts: ["g1"],
  domains: [{ domain_id: "food", why: "w" }],
  pairings: [{ gift_id: "weaver", domain_id: "food" }],
  orientations: ["slow"],
  shadow: [{ pattern: "p", how_to_relate: "h" }],
  edges: [{ pattern: "e", how_to_relate: "h" }],
  trim_tabs: [{ trim_tab_id: 3, action: "a", domain_id: "food", gift_basis: "gb", upward_spiral: "us", ikigai_fit: "if" }],
  hd_signature: { type: "Generator", profile: "1/3", authority: "Sacral", defined_centers: ["Sacral"], gates: [34] },
  meta: { engine: "claude-opus-4-8", framework_version: "3", voice_version: "2.0.0" },
};
const round = normalizeReading(healthy);
assert.deepEqual(round, healthy, "healthy reading survives normalization byte-for-byte");

// --- trim_tab_id arrives as a bigint STRING from pg — must be kept (as number) ---
const pgTabs = normalizeReading({ trim_tabs: [{ trim_tab_id: "7", action: "act", domain_id: "food" }] });
assert.equal(pgTabs.trim_tabs[0].trim_tab_id, 7, "string bigint id coerced to number");

// --- jsonb-as-string round trip -------------------------------------------------
const fromString = normalizeReading(JSON.stringify(healthy));
assert.equal(fromString.recognition, "Seen.");
assert.equal(fromString.trim_tabs.length, 1);

// --- healReadingCore: the full read-time guarantee ------------------------------
// Uses the REAL framework so the fixture backfill is the production one.
const HERE = dirname(fileURLToPath(import.meta.url));
const framework = JSON.parse(
  readFileSync(resolve(HERE, "../../../../framework/framework.json"), "utf8"),
) as Framework;
const ikigai = { love: "tending rivers", skill: "listening across difference" };

// The production incident class: a stored reading whose required arrays came
// back as non-arrays (crashed /profile with "W.map is not a function").
const broken = {
  recognition: "A real recognition the model did write.",
  portrait: "", // missing heart — read-time must backfill, not discard
  chart_threads: "Sun in Scorpio",
  gift_constellation: { gift_id: "the-weaver" },
  lens_readings: null,
  unique_gifts: {},
  domains: "food systems",
  pairings: 3,
  orientations: null,
  shadow: false,
  trim_tabs: "do the thing",
};
const { profile: healedGp, healed } = healReadingCore(broken, framework, {}, ikigai);
assert.equal(healedGp.recognition, "A real recognition the model did write.", "keeps what the model DID write");
assert(healedGp.portrait.trim().length > 100, "portrait backfilled from fixture");
assert(healed.includes("portrait"), "portrait reported as healed");
assert(healedGp.gift_constellation.length >= 1, "gift constellation backfilled");
assert(healedGp.pairings.length >= 1, "pairings backfilled");
assert(healedGp.unique_gifts.length >= 1, "unique gifts backfilled");
assert(healedGp.domains.length >= 1, "domains backfilled");
assert((healedGp.orientations || []).length >= 1, "orientations backfilled");
// Even with EMPTY charts the heal must not throw, and everything renderable
// must be a real array (the /profile page .map()s straight over these).
for (const k of ["chart_threads", "gift_constellation", "unique_gifts", "domains", "pairings", "orientations", "shadow", "trim_tabs"] as const) {
  assert(Array.isArray(healedGp[k]), `healed ${k} is an array`);
}

// A complete reading heals to itself: nothing reported, content untouched.
const thread = (i: number) => ({
  modality: "western", ref: "Sun", note: `note ${i}`, placement: `placement ${i}`,
  plain_meaning: "plain", great_turning_link: "because X, Y",
});
const lens = (l: string) => ({
  lens: l, title: l, summary: "s", reading: "A substantive lens reading.",
  placements: [{ label: "Sun in Scorpio", meaning: "m", great_turning: "g" }],
});
const complete = {
  ...healthy,
  chart_threads: [thread(1), thread(2), thread(3), thread(4)],
  lens_readings: [lens("astrology"), lens("human_design"), lens("gene_keys")],
  pairings: [{ gift_id: framework.gifts[0].id, domain_id: framework.domains[0].id }],
};
const { profile: sameGp, healed: none } = healReadingCore(complete, framework, {}, ikigai);
assert.deepEqual(none, [], `complete reading reports no healing (got: ${none.join(", ")})`);
assert.equal(sameGp.recognition, "Seen.");
assert.equal(sameGp.portrait, "A long portrait.");
assert.equal(sameGp.lens_readings!.length, 3);

// Monotonicity: with EMPTY charts the fixture has no chart_threads — a reading
// with a single thread must KEEP it (never swapped for an emptier fixture section).
const oneThread = { ...complete, chart_threads: [thread(1)] };
const { profile: keptGp } = healReadingCore(oneThread, framework, {}, ikigai);
assert.equal(keptGp.chart_threads.length, 1, "thin-but-present section kept when fixture has less");

console.log("normalize-reading: all assertions passed");
