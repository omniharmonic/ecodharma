// Differential accuracy oracle.
//
// Generates seeded random births and compares the EcoDharma ephemeris service
// (pyswisseph) against an INDEPENDENT engine — natalengine, built on
// astronomy-engine (VSOP87). Two ephemerides written by different people agree
// to arc-seconds, so any structural disagreement (gate, line, type, authority,
// profile, channel, Gene Key sphere) is a bug in one of them — and gets
// investigated, never waved away.
//
// Births are generated directly in UTC so this isolates the CALCULATION engines
// from time-zone resolution (which has its own tests in the ephemeris service).
//
// Usage: node compare.mjs [N=500] [seed=7] [--url http://127.0.0.1:8000] [--json]
import { calculateHumanDesign, calculateGeneKeys, calculateBirthPositions, longitudeToGate, longitudeToLine } from "natalengine";

const args = process.argv.slice(2);
const N = Number(args.find((a) => /^\d+$/.test(a)) ?? 500);
const SEED = Number(args.filter((a) => /^\d+$/.test(a))[1] ?? 7);
const URL_ = args.includes("--url") ? args[args.indexOf("--url") + 1] : process.env.EPHEMERIS_URL || "http://127.0.0.1:8000";
const TOKEN = process.env.EPHEMERIS_TOKEN;
const JSON_OUT = args.includes("--json");

// Mulberry32 — tiny deterministic PRNG so a failing case is reproducible by seed.
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const BODY_MAP = {
  sun: "Sun", earth: "Earth", moon: "Moon", northNode: "North_Node", southNode: "South_Node",
  mercury: "Mercury", venus: "Venus", mars: "Mars", jupiter: "Jupiter", saturn: "Saturn",
  uranus: "Uranus", neptune: "Neptune", pluto: "Pluto",
};
const LINE = 360 / 64 / 6; // 0.9375°
// Within this many degrees of a line edge, independent engines may legitimately
// disagree (ephemeris arc-second differences) — classified, not failed.
const EDGE = 0.01;
const WHEEL_START = 358.25;

function edgeDistance(lon) {
  const off = (((lon - WHEEL_START) % 360) + 360) % 360;
  const within = off % LINE;
  return Math.min(within, LINE - within);
}

const normType = (s) => s.replace(/\s+/g, " ").trim();
function normAuthority(s) {
  const a = s.replace(/ Authority$/i, "").trim().toLowerCase();
  if (a.startsWith("emotional") || a.startsWith("solar")) return "emotional";
  if (a.startsWith("sacral")) return "sacral";
  if (a.startsWith("splenic")) return "splenic";
  if (a.startsWith("ego") || a.startsWith("heart")) return a.includes("project") ? "ego-projected" : a.includes("manifest") ? "ego-manifested" : "ego";
  if (a.startsWith("self")) return "self-projected";
  if (a.startsWith("lunar") || a.includes("none (lunar")) return "lunar";
  if (a.includes("mental") || a.includes("environment") || a.includes("sounding") || a === "none" || a.includes("outer")) return "mental";
  return a;
}

async function ours(path, birth) {
  const r = await fetch(`${URL_}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}) },
    body: JSON.stringify(birth),
  });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return (await r.json()).data;
}

function randomBirth(rand) {
  const year = 1900 + Math.floor(rand() * 126);
  const month = 1 + Math.floor(rand() * 12);
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = 1 + Math.floor(rand() * dim);
  const hour = Math.floor(rand() * 24); // includes 0 — the midnight bug lives here
  const minute = Math.floor(rand() * 60);
  const lat = Math.round((rand() * 120 - 60) * 100) / 100;
  const lng = Math.round((rand() * 360 - 180) * 100) / 100;
  return { name: "oracle", year, month, day, hour, minute, lat, lng, tz_str: "UTC", unknown_time: false };
}

const pad = (n) => String(n).padStart(2, "0");

async function compareOne(b) {
  const date = `${b.year}-${pad(b.month)}-${pad(b.day)}`;
  const hourDec = b.hour + b.minute / 60;
  const ref = calculateHumanDesign(date, hourDec, 0);
  const refGK = calculateGeneKeys(ref);
  const hd = await ours("/charts/human-design", b);
  const gk = await ours("/charts/gene-keys", b);

  // Strict design check: evaluate the INDEPENDENT ephemeris at OUR exact design
  // instant (the oracle's own solver only resolves to the minute — see FINDINGS).
  const du = new Date(hd.design_utc);
  const exactDesign = calculateBirthPositions(
    du.getUTCFullYear(), du.getUTCMonth() + 1, du.getUTCDate(),
    du.getUTCHours() + du.getUTCMinutes() / 60 + du.getUTCSeconds() / 3600, 0, null, null, { nodeType: "true" },
  );

  const issues = [];
  const oracleNotes = new Set();
  let edgeCase = false;

  // The oracle's own known imprecisions (documented in FINDINGS.md):
  //  (1) its design-time solver sometimes stops short of exactly 88° of solar arc;
  //  (2) its "true node" is a truncated series, ~0.1–0.3° off Swiss Ephemeris.
  const refP = ref.positions.personality.sun.longitude;
  const refD = ref.positions.design.sun.longitude;
  const designErr = Math.abs((((refP - 88 - refD) % 360) + 540) % 360 - 180);
  const designUnconverged = designErr > 0.005;
  if (designUnconverged) oracleNotes.add(`oracle design arc off by ${designErr.toFixed(4)}°`);

  let refDesignMatchesExact = true;
  for (const side of ["personality", "design"]) {
    for (const [rk, ok] of Object.entries(BODY_MAP)) {
      let r = ref.gates[side][rk];
      const o = hd.gates[side][ok];
      if (!r || !o) continue;
      if (side === "design") {
        const ex = rk === "earth" ? (exactDesign.sun.longitude + 180) % 360 : exactDesign[rk]?.longitude;
        if (ex === undefined) continue;
        const exAct = { gate: longitudeToGate(ex), line: longitudeToLine(ex), longitude: ex };
        if (exAct.gate !== r.gate || exAct.line !== r.line) refDesignMatchesExact = false;
        r = exAct;
      }
      const lon = r.longitude ?? ref.positions?.[side]?.[rk]?.longitude;
      const dl = Math.abs((((o.lon - lon) % 360) + 540) % 360 - 180);
      const isNode = rk === "northNode" || rk === "southNode";
      // Positional agreement is checked for every body, not just gates.
      if (!isNode && dl > 0.02) {
        issues.push(`${side}.${ok} longitude: ours ${o.lon.toFixed(4)} vs ref ${lon.toFixed(4)} (Δ${dl.toFixed(4)}°)`);
      }
      if (r.gate !== o.gate || r.line !== o.line) {
        const near = edgeDistance(lon) < EDGE || edgeDistance(o.lon) < EDGE;
        if (near) edgeCase = true;
        else if (isNode && dl < 0.35) { edgeCase = true; oracleNotes.add("oracle true-node precision"); }
        else issues.push(`${side}.${ok}: ours ${o.gate}.${o.line} vs ref ${r.gate}.${r.line} (lon ${lon?.toFixed?.(4)})`);
      }
    }
  }
  // Type/authority/channels/GK come from the oracle's own chart; if its design
  // activations were mis-timed, those derived facts aren't comparable.
  if (!refDesignMatchesExact) { edgeCase = true; oracleNotes.add("oracle design timing"); }
  if (!edgeCase) {
    if (normType(ref.type.name) !== normType(hd.type)) issues.push(`type: ours ${hd.type} vs ref ${ref.type.name}`);
    if (normAuthority(ref.authority.name) !== normAuthority(hd.authority)) issues.push(`authority: ours ${hd.authority} vs ref ${ref.authority.name}`);
    if (ref.profile.numbers !== hd.profile) issues.push(`profile: ours ${hd.profile} vs ref ${ref.profile.numbers}`);
    const rc = ref.channels.map((c) => [...c.gates].sort((x, y) => x - y).join("-")).sort().join(",");
    const oc = hd.channels.map((c) => [...c.gates].sort((x, y) => x - y).join("-")).sort().join(",");
    if (rc !== oc) issues.push(`channels: ours [${oc}] vs ref [${rc}]`);

    const spheres = {
      "activation_sequence.lifes_work": refGK.activationSequence.lifeWork,
      "activation_sequence.evolution": refGK.activationSequence.evolution,
      "activation_sequence.radiance": refGK.activationSequence.radiance,
      "activation_sequence.purpose": refGK.activationSequence.purpose,
      "venus_sequence.attraction": refGK.venusSequence.attraction,
      "venus_sequence.iq": refGK.venusSequence.iq,
      "venus_sequence.eq": refGK.venusSequence.eq,
      "venus_sequence.sq": refGK.venusSequence.sq,
      "venus_sequence.core": refGK.core,
      "pearl_sequence.vocation": refGK.pearlSequence.vocation,
      "pearl_sequence.culture": refGK.pearlSequence.culture,
      "pearl_sequence.pearl": refGK.pearlSequence.pearl,
      "pearl_sequence.brand": refGK.brand,
    };
    for (const [path, r] of Object.entries(spheres)) {
      const [seq, sph] = path.split(".");
      const o = gk[seq]?.[sph];
      if (!r) continue;
      if (!o) issues.push(`gk ${path}: missing (ref ${r.key}.${r.line})`);
      else if (o.gate !== r.key || o.line !== r.line) issues.push(`gk ${path}: ours ${o.gate}.${o.line} vs ref ${r.key}.${r.line}`);
    }
  }
  const status = issues.length ? "mismatch" : edgeCase ? (oracleNotes.size ? "oracle_imprecision" : "boundary_ambiguous") : "match";
  return { birth: b, status, issues, oracleNotes: [...oracleNotes] };
}

const rand = rng(SEED);
const results = [];
for (let i = 0; i < N; i++) results.push(await compareOne(randomBirth(rand)));

const tally = results.reduce((t, r) => ((t[r.status] = (t[r.status] || 0) + 1), t), {});
const byIssue = {};
for (const r of results) for (const i of r.issues) {
  const k = i.split(":")[0];
  byIssue[k] = (byIssue[k] || 0) + 1;
}
if (JSON_OUT) {
  console.log(JSON.stringify({ N, seed: SEED, tally, byIssue, mismatches: results.filter((r) => r.status === "mismatch") }, null, 2));
} else {
  console.log(`oracle: ${N} births (seed ${SEED}) →`, tally);
  console.log("mismatch categories:", byIssue);
  for (const r of results.filter((x) => x.status === "mismatch").slice(0, 8)) {
    const b = r.birth;
    console.log(`- ${b.year}-${pad(b.month)}-${pad(b.day)} ${pad(b.hour)}:${pad(b.minute)}Z  ${r.issues.slice(0, 4).join(" | ")}`);
  }
}
process.exitCode = tally.mismatch ? 1 : 0;
