// Run: npx tsx src/lib/guard.test.mts   (from apps/web)
// The interpretation guard: prose may not assert placements we didn't compute.
import assert from "node:assert";
import { buildFacts, guardReading, guardText } from "./guard.ts";

const charts = {
  western: {
    positions: {
      Sun: { lon: 84.07, sign: "Gemini" },
      Moon: { lon: 344.52, sign: "Pisces" },
      Venus: { lon: 49.1, sign: "Taurus" },
    },
    houses: {
      ascendant: { sign: "Cancer" }, midheaven: { sign: "Pisces" },
      // Equal-ish cusps starting at 100° so Sun (84°) falls in the 12th.
      cusps: [100, 130, 160, 190, 220, 250, 280, 310, 340, 10, 40, 70],
    },
  },
  vedic: {
    positions: { Sun: { sign: "Taurus" }, Moon: { sign: "Aquarius" } },
    jyotish: {
      lagna: { sign: "Gemini", nakshatra: { name: "Ardra" } },
      grahas: {
        Sun: { sign: "Taurus", house: 12, nakshatra: { name: "Mrigashira" } },
        Moon: { sign: "Aquarius", house: 9, nakshatra: { name: "Purva Bhadrapada" } },
        Rahu: { sign: "Capricorn", house: 8, nakshatra: { name: "Shravana" } },
      },
    },
  },
  human_design: {
    type: "Manifesting Generator", authority: "Sacral", profile: "2/4",
    gates: { personality: { Sun: { gate: 12 }, Earth: { gate: 11 } }, design: { Sun: { gate: 36 }, Moon: { gate: 14 }, Venus: { gate: 2 } } },
    channels: [{ gates: [2, 14] }, { gates: [13, 33] }],
  },
  gene_keys: { activation_sequence: { lifes_work: { gate: 12 } }, venus_sequence: { core: { gate: 41 } }, pearl_sequence: {} },
};

const f = buildFacts(charts);
const rep = () => ({ checked: 0, fixed: 0, removed: 0, notes: [] as string[] });

// --- true claims pass untouched ------------------------------------------------
{
  const r = rep();
  const t = "Your Sun in Gemini makes you curious. As a Manifesting Generator with Sacral authority and a 2/4 profile, you move fast.";
  assert.equal(guardText(t, f, r), t);
  assert.equal(r.fixed + r.removed, 0);
}
// Sidereal claims are valid too (prose mixes systems).
{
  const r = rep();
  const t = "In the Vedic sky your Sun in Taurus slows the story down.";
  assert.equal(guardText(t, f, r), t);
}

// --- a wrong sign for a known body is CORRECTED --------------------------------
{
  const r = rep();
  const out = guardText("Your Venus in Libra seeks harmony.", f, r);
  assert.equal(out, "Your Venus in Taurus seeks harmony.");
  assert.equal(r.fixed, 1);
}

// --- invented nakshatra: sentence REMOVED (the v0.1 failure) -------------------
{
  const r = rep();
  const out = guardText("You are tender. Your Moon in Rohini nakshatra loves beauty. You build.", f, r);
  assert.ok(!/Rohini/.test(out), out);
  assert.ok(/You are tender\./.test(out) && /You build\./.test(out));
  assert.equal(r.removed, 1);
}
// Computed nakshatras are allowed, incl. romanisation variants.
{
  const r = rep();
  const t = "Your Moon sits in Purva Bhadrapada, and Rahu in Shravana.";
  assert.equal(guardText(t, f, r), t);
}

// --- HD structure: wrong type/authority/profile corrected; bad gate/channel dropped
{
  const r = rep();
  assert.equal(guardText("As a Projector you wait.", f, r), "As a Manifesting Generator you wait.");
  assert.equal(guardText("Trust your Splenic authority.", f, r), "Trust your Sacral authority.");
  assert.equal(guardText("Your 3/5 profile is heretical.", f, r), "Your 2/4 profile is heretical.");
  assert.equal(guardText("Gate 34 gives power.", f, r), "");
  assert.equal(guardText("Gate 12 gives caution.", f, r), "Gate 12 gives caution.");
  assert.equal(guardText("The channel 34-20 is charisma.", f, r), "");
  assert.equal(guardText("Your 14–2 channel is the beat.", f, r), "Your 14–2 channel is the beat.");
}

// --- houses: western Placidus OR vedic whole-sign accepted, others dropped -----
{
  const r = rep();
  assert.equal(guardText("Sun in the 12th house hides.", f, r), "Sun in the 12th house hides.");
  assert.equal(guardText("Moon in the 4th house nests.", f, r), "");
}

// --- whole reading: chart_threads anchored on a false placement are dropped ----
{
  const core = {
    recognition: "You are a bridge.",
    portrait: "Your Venus in Libra is graceful.\n\nYour Moon in Rohini nakshatra glows.",
    narrative: "",
    chart_threads: [
      { modality: "western", ref: "Sun", placement: "Sun in Gemini", plain_meaning: "x", great_turning_link: "y", note: "z" },
      { modality: "vedic", ref: "Moon", placement: "Moon in Krittika nakshatra", plain_meaning: "x", great_turning_link: "y", note: "z" },
    ],
    lens_readings: [{ lens: "astrology", title: "A", summary: "s", reading: "r", placements: [{ label: "Venus in Libra", meaning: "m", great_turning: "g" }] }],
    gift_constellation: [{ gift_id: "weaver", how_they_carry: "With Gate 99 energy." }],
  } as any;
  const { core: out, report } = guardReading(core, charts);
  assert.equal(out.chart_threads.length, 1);
  assert.equal(out.lens_readings[0].placements[0].label, "Venus in Taurus");
  assert.ok(out.portrait.includes("Venus in Taurus"));
  assert.ok(!out.portrait.includes("Rohini"));
  assert.ok(report.fixed >= 2 && report.removed >= 2, JSON.stringify(report));
}

console.log("guard tests passed");
