// Run: npx tsx src/lib/altar/strands-det.test.mts   (from apps/web)
import assert from "node:assert";
import { chargeOf, mentionScore, proposeStrandsDet, relationOf, type StrandTarget } from "./strands-det.ts";

const targets: StrandTarget[] = [
  { lineage_id: 1, kind: "work", title: "Building EcoDharma" },
  { lineage_id: 2, kind: "root", title: "I must be financially self-sustaining to serve well" },
  { lineage_id: 3, kind: "practice", title: "Morning sit" },
  { lineage_id: 4, kind: "devotion", title: "The Front Range watershed" },
  { lineage_id: 5, kind: "work", title: "Fathering" },
];

const text = `This week building EcoDharma felt like my prayer in motion — I lit up every morning. ` +
  `But the fundraising grind is draining me, and I wonder whether being financially self-sustaining is really the point. ` +
  `I skipped my morning sit three times. ` +
  `Walking the creek I realized the watershed is teaching me patience.`;

const out = proposeStrandsDet(text, targets);
const by = (id: number) => out.find((s) => s.lineage_id === id);

assert.equal(by(1)?.relation, "embodies");
assert.ok(by(1)!.charge > 0);
assert.ok(by(1)!.quote.includes("EcoDharma"));

// "draining" + "wonder whether" → strain wins? Priority: releases > strains > questions.
assert.equal(by(2)?.relation, "strains");
assert.ok(by(2)!.charge < 0);

assert.ok(by(3), "morning sit mentioned");
assert.equal(by(4)?.relation, "discovers");
assert.equal(by(5), undefined, "fathering not mentioned → no strand");

// Every quote is verbatim from the text.
for (const s of out) assert.ok(text.includes(s.quote), s.quote);

// Cues and charge
assert.equal(relationOf("I'm ready to let go of the newsletter.", 0), "releases");
assert.equal(relationOf("Is this still the right path?", 0), "questions");
assert.equal(relationOf("We shipped the map and people thanked us.", 1), "evidences");
assert.equal(relationOf("The retreat restored me.", 1), "nourishes");
assert.equal(chargeOf("I felt alive and grateful and clear."), 2);
assert.equal(chargeOf("Exhausted, stuck, overwhelmed."), -2);
assert.equal(mentionScore("nothing related here", targets[0]), 0);
assert.ok(mentionScore("the ecodharma build", targets[0]) >= 1);

// Empty / unrelated text → nothing proposed.
assert.deepEqual(proposeStrandsDet("A quiet day.", targets), []);
console.log("strands-det tests passed");
