// Run: npx tsx src/lib/altar/inquiry.test.mts   (from apps/web)
import assert from "node:assert";
import { CHAMBERS, QUESTION, mirrorChamber, nextChamber, phrases, prayerFacets, prayerMaterial, proposeFromChamber } from "./inquiry.ts";

assert.equal(CHAMBERS.length, 7);
assert.deepEqual(CHAMBERS.map((c) => c.id), ["values", "propensities", "capacities", "karma", "issues", "opportunities", "devotion"]);
assert.ok(QUESTION.get("values.deathbed"));
assert.equal(nextChamber("values")?.id, "propensities");
assert.equal(nextChamber("devotion"), null);

assert.deepEqual(phrases("the land, my children, the commons, poetry"), ["the land", "my children", "the commons", "poetry"]);
assert.deepEqual(phrases("Teaching.\nLong walks by the creek; music"), ["Teaching", "Long walks by the creek", "music"]);
assert.deepEqual(phrases(""), []);

const values = proposeFromChamber("values", {
  "values.sacred": "the land, my children, the commons",
  "values.deathbed": "someone who helped people find each other",
  "values.inspire": "Joanna Macy, her fierce tenderness",
});
assert.equal(values.filter((s) => s.kind === "devotion").length, 3);
assert.ok(values.some((s) => s.kind === "measure" && s.title.includes("helped people find each other")));
assert.ok(values.every((s) => s.chamber === "values"));

const cap = proposeFromChamber("capacities", { "cap.download": "facilitation, ecology, spanish", "cap.fearless": "start the land trust" });
assert.ok(cap.filter((s) => s.kind === "capacity").length >= 2);
assert.ok(cap.some((s) => s.kind === "work" && s.mode === "doing"));

const opp = proposeFromChamber("opportunities", { "opp.fear": "money" });
assert.equal(opp[0].kind, "inquiry");

const all = { "dev.offering": "the watershed and the people of it", "values.news": "rivers running clean again", "issues.medicine": "holding space for grief" };
assert.equal(prayerMaterial(all).length, 3);
assert.deepEqual(prayerFacets(all), { for_whom: "the watershed and the people of it", toward_what: "rivers running clean again", through_what: "holding space for grief" });

assert.match(mirrorChamber("propensities", { "prop.easy": "listening" }, { gifts: ["The Weaver"] }), /“listening”.*the Weaver in you/);
assert.match(mirrorChamber("values", {}), /Silence is an answer/);
console.log("inquiry tests passed");
