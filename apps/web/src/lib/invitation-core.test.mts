// Run: npx tsx src/lib/invitation-core.test.mts   (from apps/web)
import assert from "node:assert";
import { checkContract, composeDeterministic, findRefs, midSentence, type Packet } from "./invitation-core.ts";

const packet: Packet = {
  firstName: "Benjamin",
  cadence: "weekly",
  depth: 1,
  items: [
    { ref: "gift:storyteller", kind: "gift", label: "The Storyteller", detail: "naming what a room already feels", anchors: ["Storyteller"] },
    { ref: "gift:weaver", kind: "gift", label: "The Weaver", anchors: ["Weaver"] },
    { ref: "hd:type", kind: "hd", label: "Manifesting Generator strategy", detail: "As a Manifesting Generator, respond first, then tell the people your speed will touch before you leap.", anchors: ["Manifesting Generator"] },
    { ref: "hd:authority", kind: "hd", label: "Sacral authority", detail: "Listen for the gut's uh-huh before the mind's reasons.", anchors: ["Sacral", "gut"] },
    { ref: "trimtab:3", kind: "trimtab", label: "place stories", detail: "Open the next commons gathering with a two-minute place story.", anchors: ["place story", "place stories"] },
  ],
  recentBodies: [],
  recentRefs: [],
};

// --- The three emails that actually went out (Aug 24, Sep 14, Sep 28) FAIL ----
const SHIPPED_FAILURES = [
  "I need the person's Ikigai words and chart data to write their weekly dharma nudge. Could you share those?",
  "I need the person's actual data to complete this — their Ikigai words, chart positions, and any other inputs. Could you share those so I can write something true to this specific person rather than continuing from a generic template?",
  "I need the person's actual data to generate their reading — their Ikigai words, chart positions, and any other inputs you're sharing. It looks like your message may have been cut off, or you may have been showing me an example output rather than submitting a new person's information.",
];
for (const body of SHIPPED_FAILURES) {
  const r = checkContract(body, packet);
  assert.equal(r.ok, false, `must reject: ${body.slice(0, 50)}`);
  assert.ok(r.failures.some((f) => f.startsWith("banned")), r.failures.join(","));
}

// --- The Oct 5 generic template + its grammar bug FAILS ------------------------
{
  const r = checkContract("A small lever this week — playing to your The Storyteller: At the opening of any community governance gathering invite one person to offer a story before business begins and see what happens next in the room.", packet);
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.includes("your The")), r.failures.join(","));
}
assert.equal(midSentence("The Storyteller"), "the Storyteller");

// --- A grounded invitation PASSES --------------------------------------------
{
  const good = "This week's thread, Benjamin. Notice where the Storyteller in you came alive — the moments you named what a room already felt. As a Manifesting Generator, let something arrive first, then follow the yes. What is one small act this week only you would think to do?";
  const r = checkContract(good, packet);
  assert.equal(r.ok, true, r.failures.join(","));
  assert.deepEqual(r.refs.sort(), ["gift:storyteller", "hd:type"]);
}

// --- Ungrounded (generic) text FAILS even if polite ---------------------------
{
  const r = checkContract("This week, take one small action that leaves your corner of the world a little more alive. Notice what brings you joy and follow it gently through the days ahead.", packet);
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.startsWith("ungrounded")));
}

// --- The deterministic composer ALWAYS passes, and rotates --------------------
{
  let p: Packet = { ...packet };
  const seen = new Set<string>();
  for (let i = 0; i < 6; i++) {
    const { body, refs } = composeDeterministic(p);
    const r = checkContract(body, p);
    assert.equal(r.ok, true, `week ${i}: ${r.failures.join(",")}\n${body}`);
    assert.ok(!/your The/.test(body));
    refs.forEach((x) => seen.add(x));
    p = { ...p, recentBodies: [body, ...p.recentBodies].slice(0, 6), recentRefs: [refs, ...p.recentRefs].slice(0, 6) };
  }
  assert.ok(seen.size >= 4, `rotation should touch most of the altar, saw ${[...seen]}`);
}

// --- Repetition is caught ------------------------------------------------------
{
  const { body } = composeDeterministic(packet);
  const r = checkContract(body, { ...packet, recentBodies: [body] });
  assert.ok(r.failures.some((f) => f.startsWith("repetitive")));
}

// --- Depths and thresholds -----------------------------------------------------
{
  const deep: Packet = {
    ...packet, cadence: "seasonal", depth: 3, thresholdLabel: "Winter Solstice 2026",
    items: [...packet.items, { ref: "prayer", kind: "prayer", label: "May my life weave the commons back into wholeness", anchors: ["weave the commons"] }],
  };
  const { body, refs } = composeDeterministic(deep);
  assert.ok(body.includes("Winter Solstice 2026"));
  assert.ok(refs.includes("prayer"));
  assert.equal(checkContract(body, deep).ok, true);
}

assert.deepEqual(findRefs("The weaver weaves", packet.items), ["gift:weaver"]);
console.log("invitation-core tests passed");
