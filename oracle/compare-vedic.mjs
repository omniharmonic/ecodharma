// Vedic cross-check: sidereal (Lahiri) longitudes, rashi, nakshatra + pada for
// every classical graha, vs natalengine's independent Vedic module.
// Usage: node compare-vedic.mjs [N=300] [seed=11]
import { calculateVedic } from "natalengine";

const N = Number(process.argv[2] ?? 300);
const SEED = Number(process.argv[3] ?? 11);
const URL_ = process.env.EPHEMERIS_URL || "http://127.0.0.1:8000";
let t = SEED >>> 0;
const rand = () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
const pad = (n) => String(n).padStart(2, "0");
const NAK = 360 / 27, PADA = NAK / 4;
const edge = (lon) => { const w = ((lon % PADA) + PADA) % PADA; return Math.min(w, PADA - w); };
// Transliteration variants (same nakshatra, different romanisation).
const canon = (n) => n.toLowerCase().replace(/\s/g, "").replace(/h/g, "").replace(/aa/g, "a");
const BODIES = { sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus", mars: "Mars", jupiter: "Jupiter", saturn: "Saturn" };

const tally = { match: 0, boundary_ambiguous: 0, mismatch: 0 };
const ayan = [];
for (let i = 0; i < N; i++) {
  const year = 1900 + Math.floor(rand() * 126), month = 1 + Math.floor(rand() * 12);
  const day = 1 + Math.floor(rand() * 28), hour = Math.floor(rand() * 24), minute = Math.floor(rand() * 60);
  const lat = Math.round((rand() * 120 - 60) * 100) / 100, lng = Math.round((rand() * 360 - 180) * 100) / 100;
  const b = { name: "v", year, month, day, hour, minute, lat, lng, tz_str: "UTC", unknown_time: false };
  const ours = (await (await fetch(`${URL_}/charts/vedic`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })).json()).data.jyotish;
  const ref = calculateVedic(`${year}-${pad(month)}-${pad(day)}`, hour + minute / 60, 0, lat, lng);
  ayan.push(ours.ayanamsa.value - ref.ayanamsa.value ?? 0);
  const issues = [];
  let amb = false;
  for (const [rk, ok] of Object.entries(BODIES)) {
    const r = ref.positions[rk], o = ours.grahas[ok];
    const dl = Math.abs(((o.lon - r.longitude) % 360 + 540) % 360 - 180);
    if (dl > 0.05) issues.push(`${ok} sidereal lon Δ${dl.toFixed(4)}°`);
    if (canon(r.nakshatra.name) !== canon(o.nakshatra.name) || r.nakshatra.pada !== o.nakshatra.pada) {
      if (edge(r.longitude) < 0.05 || edge(o.lon) < 0.05) amb = true;
      else issues.push(`${ok}: ours ${o.nakshatra.name} p${o.nakshatra.pada} vs ref ${r.nakshatra.name} p${r.nakshatra.pada}`);
    }
  }
  const status = issues.length ? "mismatch" : amb ? "boundary_ambiguous" : "match";
  tally[status]++;
  if (issues.length && tally.mismatch <= 6) console.log(`- ${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}Z`, issues.join(" | "));
}
const mean = ayan.reduce((a, x) => a + x, 0) / ayan.length;
console.log(`vedic oracle: ${N} births (seed ${SEED}) →`, tally, `mean ayanamsa Δ ${mean.toFixed(5)}°`);
process.exitCode = tally.mismatch ? 1 : 0;
