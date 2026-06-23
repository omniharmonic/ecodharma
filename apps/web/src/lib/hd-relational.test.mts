// Run: npx tsx src/lib/hd-relational.test.mts   (from apps/web)
// Deterministic sanity checks for the HD relational engine.
import assert from "node:assert";
import { compareHumanDesign, analyzePenta, CHANNELS, type HdSignature } from "./hd-relational.ts";

// A: defines Channel 1-8 fully (gates 1,8) -> G+Throat; plus gate 34.
const A: HdSignature = {
  type: "Generator", profile: "1/3", authority: "Sacral",
  defined_centers: ["G", "Throat", "Sacral"], gates: [1, 8, 34, 5, 15],
};
// B: has gate 20 (pairs with 34 -> Charisma) and gate 8 alone; defines 4-63 (Ajna+Head).
const B: HdSignature = {
  type: "Projector", profile: "5/1", authority: "Splenic",
  defined_centers: ["Ajna", "Head"], gates: [20, 8, 4, 63],
};

const cmp = compareHumanDesign(A, B, "Ada", "Bo:");
// 34(A) + 20(B) complete Charisma -> electromagnetic.
assert(cmp.connections.electromagnetic.some((c) => c.channel === "Charisma"), "expected Charisma electromagnetic");
// A fully has 1-8 Inspiration; B has gate 8 only -> compromise dominated by A.
const insp = cmp.connections.compromise.find((c) => c.channel === "Inspiration");
assert(insp && insp.dominant === "A" && insp.partialGate === 8, "expected Inspiration compromise (A dominant, partial 8)");
// A fully has 5-15 Rhythm; B has neither -> dominance by A.
assert(cmp.connections.dominance.some((c) => c.channel === "Rhythm" && c.dominant === "A"), "expected Rhythm dominance by A");
// B fully has 4-63 Logic; A has neither -> dominance by B.
assert(cmp.connections.dominance.some((c) => c.channel === "Logic" && c.dominant === "B"), "expected Logic dominance by B");
// No channel double-counted across the four buckets.
const allConn = [...cmp.connections.electromagnetic, ...cmp.connections.companionship, ...cmp.connections.compromise, ...cmp.connections.dominance];
assert(new Set(allConn.map((c) => c.channel)).size === allConn.length, "a channel landed in two buckets");
// Conditioning: A defines Sacral, B open -> A conditions B on Sacral.
assert(cmp.centerConditioning.find((c) => c.center === "Sacral")!.dynamic === "A conditions B", "Sacral should be A conditions B");
assert(cmp.compositeType && typeof cmp.compositeType === "string", "composite type present");
assert(cmp.stats.electromagnetic >= 1, "stats reflect electromagnetics");

// Penta: 3 members, check role filling + group type are sane.
const C: HdSignature = { type: "Manifestor", profile: "4/6", authority: "Ego", defined_centers: ["Heart", "Throat"], gates: [21, 45] };
const penta = analyzePenta([{ name: "Ada", sig: A }, { name: "Bo:", sig: B }, { name: "Cy", sig: C }]);
assert(penta.memberCount === 3 && penta.isPenta, "3 members is a penta");
// Throat is defined by Ada and Cy -> Communicator role filled & strong.
const comm = penta.filledRoles.find((r) => r.role === "Communicator");
assert(comm && comm.contributors.includes("Ada") && comm.contributors.includes("Cy") && comm.strength === "strong", "Communicator filled+strong");
// Root is defined by no one -> missing.
assert(penta.missingRoles.some((r) => r.center === "Root"), "Root role missing");
assert(penta.filledRoles.length + penta.missingRoles.length === 9, "9 centres accounted for");
assert(penta.recommendations.length >= 1, "recommendations produced");

// Reference data integrity.
assert(CHANNELS.length === 36, `expected 36 channels, got ${CHANNELS.length}`);

console.log("✓ hd-relational: all", "checks passed —",
  `EM:${cmp.stats.electromagnetic} CO:${cmp.stats.companionship} CM:${cmp.stats.compromise} DM:${cmp.stats.dominance};`,
  `penta groupType=${penta.groupType}, filled=${penta.filledRoles.length}/9`);
