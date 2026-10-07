// Run: npx tsx src/lib/altar/inquiry.test.mts   (from apps/web)
import assert from "node:assert";
import {
  CHAMBERS, QUESTION, WHY, composeLayers, coreQuestions, deepQuestions, fundamental, layers, mirrorChamber, nextChamber,
  phrases, prayerFacets, prayerMaterial, proposeFromChamber, returnQuestion, surface,
} from "./inquiry.ts";
import { ritualSpec } from "./prompts.ts";

// Daniel Schmachtenberger's six sections, in his order.
assert.deepEqual(CHAMBERS.map((c) => c.id), ["values", "propensities", "capacities", "karma", "patterns", "guidance"]);
assert.deepEqual(CHAMBERS.filter((c) => c.ladder).map((c) => c.id), ["values", "capacities"]); // "ask why … until fundamental"
assert.equal(nextChamber("values")?.id, "propensities");
assert.equal(nextChamber("guidance"), null);
for (const c of CHAMBERS) {
  assert.ok(coreQuestions(c).length >= 4 && coreQuestions(c).length <= 6, `${c.id} core`);
  assert.ok(deepQuestions(c).length >= 2, `${c.id} deep`);
}
assert.ok(QUESTION.size >= 60);
assert.equal(new Set([...QUESTION.keys()]).size, QUESTION.size);
assert.ok(QUESTION.get("prop.replenish")); // used by the Practice stage

// The why-ladder.
const laddered = composeLayers(["the land, my children", "because they hold the future", "because life wants to continue"]);
assert.equal(laddered, `the land, my children${WHY}because they hold the future${WHY}because life wants to continue`);
assert.deepEqual(layers(laddered).length, 3);
assert.equal(surface(laddered), "the land, my children");
assert.equal(fundamental(laddered), "because life wants to continue");
assert.equal(fundamental("just one layer"), undefined);
assert.equal(composeLayers(["only", "", ""]), "only");
assert.deepEqual(phrases(laddered), ["the land, my children"]); // phrases read the surface only

assert.deepEqual(phrases("the land, my children, the commons, poetry"), ["the land", "my children", "the commons", "poetry"]);
assert.deepEqual(phrases("Teaching.\nLong walks by the creek; music"), ["Teaching", "Long walks by the creek", "music"]);
assert.deepEqual(phrases(""), []);

// Values: the fundamental "why" becomes the strongest seed.
const values = proposeFromChamber("values", {
  "values.sacred": composeLayers(["the land, my children, the commons", "life itself"]),
  "values.deathbed": "someone who helped people find each other",
  "values.inspire": "Joanna Macy, her fierce tenderness",
  "values.virtues": "patience; courage",
});
assert.equal(values[0].kind, "root");
assert.equal(values[0].title, "Life itself");
assert.equal(values.filter((s) => s.kind === "devotion").length, 3);
assert.ok(values.some((s) => s.kind === "measure" && s.title.includes("helped people find each other")));
assert.equal(values.filter((s) => s.kind === "capacity").length, 2);
assert.ok(values.every((s) => s.chamber === "values"));

// Propensities: gift and shadow, together.
const prop = proposeFromChamber("propensities", { "prop.shadow": "I over-give", "prop.paingift": "being unheard made me listen", "prop.replenish": "creek walks" });
assert.ok(prop.some((s) => s.kind === "inquiry" && /shadow of my gift/.test(s.title)));
assert.ok(prop.some((s) => s.kind === "root" && s.scope === "unique"));
assert.ok(prop.some((s) => s.kind === "practice" && s.mode === "being"));

const cap = proposeFromChamber("capacities", { "cap.download": "facilitation, ecology, spanish", "cap.fearless": "start the land trust" });
assert.ok(cap.filter((s) => s.kind === "capacity").length >= 2);
assert.ok(cap.some((s) => s.kind === "work" && s.mode === "doing"));

const karma = proposeFromChamber("karma", { "karma.loved": "my grandmother's patience", "karma.hurt": "my brother — call him" });
assert.ok(karma.some((s) => s.kind === "capacity" && s.title.includes("grandmother's patience")));
assert.ok(karma.some((s) => s.kind === "work" && s.title.startsWith("Make amends")));

const pat = proposeFromChamber("patterns", { "pat.compulsion": "checking my phone", "pat.rewarded": "grant writing" });
assert.ok(pat.some((s) => s.title === "Is checking my phone compulsion or dharma?"));
assert.ok(pat.some((s) => s.title === "Is it time to release grant writing?"));

const guide = proposeFromChamber("guidance", { "guide.peace": "on the river at dawn", "guide.knowings": "we belong to each other" });
assert.ok(guide.some((s) => s.kind === "practice"));
assert.ok(guide.some((s) => s.kind === "root" && s.title === "We belong to each other"));

// The Prayer's raw material: deepest why first, then luminous lines.
const all = {
  "values.devoted": "the watershed and the people of it",
  "values.news": "rivers running clean again",
  "prop.paingift": "holding space for grief",
  "values.sacred": composeLayers(["the land", "because it holds us"]),
};
const mat = prayerMaterial(all);
assert.equal(mat[0].text, "because it holds us");
assert.ok(mat.length >= 4);
assert.deepEqual(prayerFacets(all), { for_whom: "the watershed and the people of it", toward_what: "rivers running clean again", through_what: "holding space for grief" });

// The mirror.
assert.match(mirrorChamber("propensities", { "prop.easy": "listening" }, { gifts: ["The Weaver"] }), /“listening”.*the Weaver in you.*gift and shadow/);
assert.match(mirrorChamber("values", { "values.sacred": composeLayers(["the land", "it holds us"]) }), /where your why came to rest: “it holds us\.”/);
assert.match(mirrorChamber("values", {}), /Silence is an answer/);

// An ongoing and unending inquiry: deep rituals return to one question.
const rq = returnQuestion({ "values.sacred": "the land" }, 7);
assert.equal(rq.id, "values.sacred");
assert.equal(rq.prior, "the land");
const fresh = returnQuestion({}, 3);
assert.ok(QUESTION.get(fresh.id) && !QUESTION.get(fresh.id)!.deep && !fresh.prior);
const seasonal = ritualSpec("seasonal", "Winter Solstice", { prayer: "May I tend the land", inquiry: rq });
assert.equal(seasonal.steps.at(-1)!.id, "return");
assert.match(seasonal.steps.at(-1)!.hint!, /Last time you wrote: “the land\.”/);
assert.ok(!ritualSpec("weekly", "weekly", { inquiry: rq }).steps.some((s) => s.id === "return"));
assert.ok(!ritualSpec("monthly", "monthly", { inquiry: rq }).steps.some((s) => s.id === "return"));
assert.ok(ritualSpec("quarterly", "quarterly", { inquiry: rq }).steps.some((s) => s.id === "return"));

console.log("inquiry tests passed");
