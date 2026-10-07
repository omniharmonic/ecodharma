// Recompute every stored chart with the corrected ephemeris (v0.2+), diff the
// STRUCTURE against what each person was shown, and — with --apply — store the
// corrected charts and leave an honest "what changed" note on their profile.
// The profile then offers a free re-draft of the reading from the corrected charts.
//
//   node scripts/recompute-charts.mjs            # dry run: report only
//   node scripts/recompute-charts.mjs --apply    # write corrected charts + notes
//   node scripts/recompute-charts.mjs --self-test
//
// Env: DATABASE_URL, EPHEMERIS_URL (+ EPHEMERIS_TOKEN). Writes the report to
// recompute-report.json (and prints a summary). By Benjamin Life (@omniharmonic).
import { writeFileSync } from "node:fs";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const CONN = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const BASE = process.env.EPHEMERIS_URL || "http://127.0.0.1:8000";
const TOKEN = process.env.EPHEMERIS_TOKEN;
const ROUTES = { western: "western", vedic: "vedic", human_design: "human-design", gene_keys: "gene-keys" };

// ---- structural diff (pure) ---------------------------------------------------
const sorted = (a) => [...(a || [])].sort();
const chanKey = (chs) => sorted((chs || []).map((c) => [...c.gates].sort((x, y) => x - y).join("-"))).join(", ");
const act = (a) => (a ? `${a.gate}.${a.line}` : "—");

export function diffCharts(oldC, newC) {
  const changes = [];
  const o = oldC || {};
  const n = newC || {};
  // Western signs
  for (const body of Object.keys(n.western?.positions || {})) {
    const a = o.western?.positions?.[body]?.sign;
    const b = n.western.positions[body].sign;
    if (a && a !== b) changes.push({ lens: "western", field: `${body} sign`, from: a, to: b });
  }
  for (const ang of ["ascendant", "midheaven"]) {
    const a = o.western?.houses?.[ang]?.sign;
    const b = n.western?.houses?.[ang]?.sign;
    if (a && b && a !== b) changes.push({ lens: "western", field: ang, from: a, to: b });
  }
  // Human Design
  const oh = o.human_design || {};
  const nh = n.human_design || {};
  for (const f of ["type", "authority", "profile", "definition"]) {
    if (oh[f] && nh[f] && oh[f] !== nh[f]) changes.push({ lens: "human_design", field: f, from: oh[f], to: nh[f] });
  }
  if (oh.channels && chanKey(oh.channels) !== chanKey(nh.channels)) {
    changes.push({ lens: "human_design", field: "channels", from: chanKey(oh.channels) || "none", to: chanKey(nh.channels) || "none" });
  }
  for (const side of ["personality", "design"]) {
    for (const body of Object.keys(nh.gates?.[side] || {})) {
      const a = act(oh.gates?.[side]?.[body]);
      const b = act(nh.gates[side][body]);
      if (oh.gates?.[side]?.[body] && a !== b) changes.push({ lens: "human_design", field: `${side} ${body}`, from: a, to: b });
    }
  }
  // Gene Keys — every sphere, including ones that didn't exist before
  for (const seq of ["activation_sequence", "venus_sequence", "pearl_sequence"]) {
    for (const sph of Object.keys(n.gene_keys?.[seq] || {})) {
      const b = n.gene_keys[seq][sph];
      if (!b?.gate) continue;
      const a = o.gene_keys?.[seq]?.[sph];
      if (!a) changes.push({ lens: "gene_keys", field: sph, from: "not shown", to: act(b) });
      else if (act(a) !== act(b)) changes.push({ lens: "gene_keys", field: sph, from: act(a), to: act(b) });
    }
  }
  // Vedic: nakshatras are new information, not a correction — note once.
  if (n.vedic?.jyotish && !o.vedic?.jyotish) {
    const m = n.vedic.jyotish.grahas?.Moon?.nakshatra;
    changes.push({ lens: "vedic", field: "nakshatras", from: "not computed", to: m ? `Moon in ${m.name} (pada ${m.pada})` : "computed", additive: true });
  }
  return changes;
}

export function summarize(changes) {
  const material = changes.filter((c) => !c.additive);
  const big = material.filter((c) => ["type", "authority", "profile", "definition", "channels", "ascendant"].includes(c.field) || / sign$/.test(c.field));
  return { material: material.length, structural: big.length, lenses: [...new Set(material.map((c) => c.lens))] };
}

if (process.argv.includes("--self-test")) {
  const assert = (await import("node:assert")).default;
  const old = {
    human_design: { type: "Generator", authority: "Sacral", profile: "2/4", definition: "single", channels: [{ gates: [5, 15] }],
      gates: { personality: { Moon: { gate: 8, line: 6 } }, design: {} } },
    gene_keys: { venus_sequence: { iq: { gate: 23, line: 2 } }, pearl_sequence: {} },
    western: { positions: { Moon: { sign: "Taurus" } }, houses: { ascendant: { sign: "Leo" } } },
  };
  const neu = {
    human_design: { type: "Projector", authority: "Splenic", profile: "2/4", definition: "single", channels: [{ gates: [20, 57] }],
      gates: { personality: { Moon: { gate: 23, line: 5 } }, design: {} } },
    gene_keys: { venus_sequence: { iq: { gate: 40, line: 5 }, core: { gate: 25, line: 1 } }, pearl_sequence: {} },
    western: { positions: { Moon: { sign: "Taurus" } }, houses: { ascendant: { sign: "Virgo" } } },
    vedic: { jyotish: { grahas: { Moon: { nakshatra: { name: "Rohini", pada: 2 } } } } },
  };
  const d = diffCharts(old, neu);
  const f = (x) => d.find((c) => c.field === x);
  assert.equal(f("type").to, "Projector");
  assert.equal(f("authority").from, "Sacral");
  assert.equal(f("channels").to, "20-57");
  assert.equal(f("personality Moon").to, "23.5");
  assert.equal(f("iq").to, "40.5");
  assert.equal(f("core").from, "not shown");
  assert.equal(f("ascendant").to, "Virgo");
  assert.ok(!f("Moon sign"));
  assert.ok(f("nakshatras").additive);
  assert.equal(summarize(d).structural, 4);
  assert.equal(diffCharts(neu, neu).filter((c) => !c.additive).length, 0);
  console.log("recompute diff self-test passed");
  process.exit(0);
}

// ---- run ----------------------------------------------------------------------
async function compute(modality, birth) {
  const r = await fetch(`${BASE}/charts/${ROUTES[modality]}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}) },
    body: JSON.stringify(birth),
  });
  if (!r.ok) throw new Error(`${modality} ${r.status}`);
  return r.json();
}

const client = new pg.Client({ connectionString: CONN });
await client.connect();
const { rows: people } = await client.query(
  `select b.user_id, b.birth_date, b.birth_time, b.lat, b.lng, b.tz_str, b.unknown_time, u.email
     from birth_data b join auth.users u on u.id = b.user_id`);
const report = [];
let changed = 0;
for (const p of people) {
  const d = new Date(p.birth_date);
  const [hh, mm] = p.birth_time ? String(p.birth_time).split(":").map(Number) : [null, null];
  const birth = {
    name: "recompute", year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
    hour: p.unknown_time ? null : hh, minute: p.unknown_time ? null : mm,
    lat: p.lat, lng: p.lng, tz_str: p.tz_str, unknown_time: !!p.unknown_time,
  };
  const { rows: stored } = await client.query("select modality, raw_json from charts where user_id = $1", [p.user_id]);
  const oldC = Object.fromEntries(stored.map((r) => [r.modality, r.raw_json]));
  const fresh = {};
  const engines = {};
  try {
    for (const m of Object.keys(ROUTES)) {
      const res = await compute(m, birth);
      fresh[m] = res.data;
      engines[m] = res.engine_version;
    }
  } catch (e) {
    report.push({ user_id: p.user_id, error: String(e) });
    continue;
  }
  const changes = diffCharts(oldC, fresh);
  const sum = summarize(changes);
  report.push({ user_id: p.user_id, email: p.email, midnight_birth: hh === 0, ...sum, changes });
  if (sum.material) changed++;
  if (APPLY) {
    for (const m of Object.keys(ROUTES)) {
      await client.query(
        `insert into charts (user_id, modality, raw_json, engine_version) values ($1,$2,$3,$4)
         on conflict (user_id, modality) do update set raw_json = excluded.raw_json, engine_version = excluded.engine_version, computed_at = now()`,
        [p.user_id, m, JSON.stringify(fresh[m]), engines[m]],
      );
    }
    if (sum.material) {
      const note = { at: new Date().toISOString(), engine: engines.human_design, changes: changes.filter((c) => !c.additive).slice(0, 40), redrafted: false };
      await client.query(
        "update profiles set settings = jsonb_set(coalesce(settings,'{}'::jsonb), '{chart_correction}', $2::jsonb, true) where id = $1",
        [p.user_id, JSON.stringify(note)],
      );
    }
  }
}
await client.end();
writeFileSync("recompute-report.json", JSON.stringify({ at: new Date().toISOString(), applied: APPLY, people: people.length, changed, report }, null, 2));
console.log(`${APPLY ? "APPLIED" : "DRY RUN"}: ${people.length} people, ${changed} with material chart changes → recompute-report.json`);
for (const r of report.filter((x) => x.material || x.error).slice(0, 20)) {
  console.log(`- ${r.email || r.user_id}: ${r.error || `${r.material} changes (${r.structural} structural) in ${r.lenses.join(", ")}${r.midnight_birth ? " [midnight birth]" : ""}`}`);
}
