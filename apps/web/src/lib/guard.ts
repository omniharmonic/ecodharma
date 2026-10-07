// The interpretation guard — "Claude may describe; it may not assert a placement
// we didn't compute."
//
// Readings are written by a model that sees the chart JSON, but nothing used to
// check that the prose agreed with it: a reading could say "your Venus in Libra"
// when Venus is in Virgo, or name a nakshatra the ephemeris never computed (it
// didn't compute ANY before v0.2). This module extracts every placement CLAIM from
// prose and verifies it against a fact sheet built from the computed charts:
//   - a wrong sign for a known body is CORRECTED in place;
//   - any other unsupported claim (nakshatra, house, gate, channel, type,
//     authority, profile) removes its sentence.
// Pure (no server-only) so it unit-tests with tsx and the MCP server can reuse it.

import type { Charts, CoreProfile } from "./types";

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];
const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu",
  "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta",
  "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha",
  "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada",
  "Uttara Bhadrapada", "Revati",
];
// Common romanisations → canonical.
const NAK_ALIASES: Record<string, string> = {
  dhanishtha: "Dhanishta", ashvini: "Ashwini", krittica: "Krittika", mrigasira: "Mrigashira",
  aridra: "Ardra", pushyami: "Pushya", aslesha: "Ashlesha", purvaphalguni: "Purva Phalguni",
  uttaraphalguni: "Uttara Phalguni", chitta: "Chitra", svati: "Swati", visakha: "Vishakha",
  jyestha: "Jyeshtha", moola: "Mula", purvashadha: "Purva Ashadha", uttarashadha: "Uttara Ashadha",
  sravana: "Shravana", satabhisha: "Shatabhisha", shatabhishak: "Shatabhisha",
  purvabhadra: "Purva Bhadrapada", uttarabhadra: "Uttara Bhadrapada",
};
const BODY_ALIASES: Record<string, string> = {
  sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus", mars: "Mars", jupiter: "Jupiter",
  saturn: "Saturn", uranus: "Uranus", neptune: "Neptune", pluto: "Pluto",
  "north node": "North_Node", "south node": "South_Node", rahu: "Rahu", ketu: "Ketu",
  ascendant: "Ascendant", rising: "Ascendant", lagna: "Ascendant", midheaven: "Midheaven", mc: "Midheaven",
};
const HD_TYPES = ["Manifesting Generator", "Generator", "Manifestor", "Projector", "Reflector"];
const AUTHORITIES: Record<string, string> = {
  emotional: "Emotional", "solar plexus": "Emotional", sacral: "Sacral", splenic: "Splenic",
  ego: "Ego", heart: "Ego", "self-projected": "Self-Projected", lunar: "Lunar",
  mental: "Mental", environmental: "Mental",
};

export type Facts = {
  signs: Record<string, Set<string>>; // body → signs it occupies (tropical and/or sidereal)
  houses: Record<string, Set<number>>; // body → house numbers (western Placidus and/or vedic whole-sign)
  nakshatras: Set<string>; // every nakshatra occupied by a graha or the lagna
  gates: Set<number>; // all HD/GK gates
  channels: Set<string>; // "a-b" sorted
  type?: string;
  authority?: string;
  profile?: string;
  hasVedicNakshatras: boolean;
};

export type GuardReport = { checked: number; fixed: number; removed: number; notes: string[] };

const add = <K, V>(m: Record<string, Set<V>>, k: string, v: V) => ((m[k] ||= new Set<V>()).add(v), m);

function houseOf(lon: number, cusps: number[]): number | undefined {
  if (!Array.isArray(cusps) || cusps.length !== 12) return undefined;
  for (let i = 0; i < 12; i++) {
    const a = cusps[i];
    const b = cusps[(i + 1) % 12];
    const span = (b - a + 360) % 360;
    if ((lon - a + 360) % 360 < span) return i + 1;
  }
  return undefined;
}

export function buildFacts(charts: Charts): Facts {
  const f: Facts = { signs: {}, houses: {}, nakshatras: new Set(), gates: new Set(), channels: new Set(), hasVedicNakshatras: false };
  for (const key of ["western", "vedic"] as const) {
    const c = (charts[key] as any) || {};
    const cusps: number[] = c.houses?.cusps;
    for (const [body, p] of Object.entries<any>(c.positions || {})) {
      if (p?.sign) add(f.signs, body, p.sign);
      if (key === "western" && typeof p?.lon === "number") {
        const h = houseOf(p.lon, cusps);
        if (h) add(f.houses, body, h);
      }
    }
    if (c.houses?.ascendant?.sign) add(f.signs, "Ascendant", c.houses.ascendant.sign);
    if (c.houses?.midheaven?.sign) add(f.signs, "Midheaven", c.houses.midheaven.sign);
    const j = c.jyotish;
    if (j) {
      f.hasVedicNakshatras = true;
      if (j.lagna?.sign) add(f.signs, "Ascendant", j.lagna.sign);
      if (j.lagna?.nakshatra?.name) f.nakshatras.add(j.lagna.nakshatra.name);
      for (const [body, g] of Object.entries<any>(j.grahas || {})) {
        if (g?.sign) add(f.signs, body, g.sign);
        if (g?.house) add(f.houses, body, g.house);
        if (g?.nakshatra?.name) f.nakshatras.add(g.nakshatra.name);
      }
      // Rahu/Ketu are the nodes.
      for (const [v, w] of [["Rahu", "North_Node"], ["Ketu", "South_Node"]] as const) {
        for (const s of f.signs[v] || []) add(f.signs, w, s);
        for (const s of f.signs[w] || []) add(f.signs, v, s);
        for (const h of f.houses[v] || []) add(f.houses, w, h);
      }
    }
  }
  const hd = (charts["human_design"] as any) || {};
  for (const side of ["personality", "design"]) {
    for (const a of Object.values<any>(hd.gates?.[side] || {})) if (typeof a?.gate === "number") f.gates.add(a.gate);
  }
  for (const ch of hd.channels || []) {
    const g = [...(ch.gates || [])].sort((x: number, y: number) => x - y);
    if (g.length === 2) f.channels.add(`${g[0]}-${g[1]}`);
  }
  f.type = hd.type;
  f.authority = hd.authority;
  f.profile = hd.profile;
  const gk = (charts["gene_keys"] as any) || {};
  for (const seq of [gk.activation_sequence, gk.venus_sequence, gk.pearl_sequence]) {
    for (const v of Object.values<any>(seq || {})) if (typeof v?.gate === "number") f.gates.add(v.gate);
  }
  return f;
}

const BODY_RE = "(Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto|North Node|South Node|Rahu|Ketu|Ascendant|Rising|Lagna|Midheaven|MC)";
const SIGN_RE = `(${SIGNS.join("|")})`;
const ORD_RE = "(1[0-2]|[1-9])(?:st|nd|rd|th)";
const NAK_NAMES = [...NAKSHATRAS, ...Object.keys(NAK_ALIASES).map((a) => a)];
const canonNak = (s: string) => {
  const k = s.toLowerCase().replace(/\s+/g, "");
  return NAKSHATRAS.find((n) => n.toLowerCase().replace(/\s+/g, "") === k) || NAK_ALIASES[k];
};

type Verdict = { ok: true } | { ok: false; fix?: [string, string]; note: string };

/** Check every claim in ONE sentence. Returns the (possibly corrected) sentence, or null to drop it. */
function checkSentence(sentence: string, f: Facts, report: GuardReport): string | null {
  let out = sentence;
  const verdicts: Verdict[] = [];

  // "Venus in Libra", "Rising in Leo", "Sun is in Scorpio"
  for (const m of sentence.matchAll(new RegExp(`\\b${BODY_RE}(?:'s)?\\s+(?:is\\s+|sits\\s+|placed\\s+)?in\\s+${SIGN_RE}\\b`, "g"))) {
    const body = BODY_ALIASES[m[1].toLowerCase()];
    const known = f.signs[body];
    report.checked++;
    if (!known || !known.size) continue; // body not computed — can't judge, leave it
    if (known.has(m[2])) verdicts.push({ ok: true });
    else {
      const correct = [...known][0];
      verdicts.push({ ok: false, fix: [m[0], m[0].replace(m[2], correct)], note: `${m[1]} in ${m[2]} → ${correct}` });
    }
  }

  // "Moon in the 4th house" / "Mars in your 10th house"
  for (const m of sentence.matchAll(new RegExp(`\\b${BODY_RE}\\s+(?:is\\s+)?in\\s+(?:the\\s+|your\\s+)?${ORD_RE}\\s+house\\b`, "g"))) {
    const body = BODY_ALIASES[m[1].toLowerCase()];
    const known = f.houses[body];
    report.checked++;
    if (!known || !known.size) continue;
    if (!known.has(Number(m[2]))) verdicts.push({ ok: false, note: `${m[1]} in house ${m[2]} unsupported` });
  }

  // Nakshatras — named anywhere. Only allowed if computed.
  for (const name of NAK_NAMES) {
    const re = new RegExp(`\\b${name.replace(/\s+/g, "\\s*")}\\b`, "i");
    if (!re.test(sentence)) continue;
    // "Mula" etc. are distinctive enough; avoid generic words by requiring canonical form.
    const canon = canonNak(name);
    if (!canon) continue;
    report.checked++;
    if (!f.hasVedicNakshatras || !f.nakshatras.has(canon)) verdicts.push({ ok: false, note: `nakshatra ${canon} not in chart` });
  }

  // "Gate 34" / "gate 34.2" / "Gene Key 34"
  for (const m of sentence.matchAll(/\b(?:Gate|Gene Key)\s+(\d{1,2})(?:\.\d)?\b/gi)) {
    const g = Number(m[1]);
    report.checked++;
    if (f.gates.size && !f.gates.has(g)) verdicts.push({ ok: false, note: `gate ${g} not in chart` });
  }

  // "Channel 34-20" / "34–20 channel"
  for (const m of sentence.matchAll(/\b(?:channel\s+(?:of\s+)?(\d{1,2})\s*[-–]\s*(\d{1,2})|(\d{1,2})\s*[-–]\s*(\d{1,2})\s+channel)\b/gi)) {
    const a = Number(m[1] ?? m[3]);
    const b = Number(m[2] ?? m[4]);
    const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
    report.checked++;
    if (f.type && !f.channels.has(key)) verdicts.push({ ok: false, note: `channel ${key} not defined` });
  }

  // "a 3/5 profile" / "profile 3/5"
  for (const m of sentence.matchAll(/\b([1-6])\s*\/\s*([1-6])\s+profile\b|\bprofile\s+(?:of\s+)?([1-6])\s*\/\s*([1-6])\b/gi)) {
    const p = `${m[1] ?? m[3]}/${m[2] ?? m[4]}`;
    report.checked++;
    if (f.profile && f.profile !== p) {
      verdicts.push({ ok: false, fix: [m[0], m[0].replace(/[1-6]\s*\/\s*[1-6]/, f.profile)], note: `profile ${p} → ${f.profile}` });
    }
  }

  // "you are a Projector" / "As a Manifesting Generator"
  for (const m of sentence.matchAll(/\b(?:you(?:'re| are)|as)\s+an?\s+(Manifesting Generator|Generator|Manifestor|Projector|Reflector)\b/gi)) {
    const t = HD_TYPES.find((x) => x.toLowerCase() === m[1].toLowerCase())!;
    report.checked++;
    if (f.type && f.type !== t) verdicts.push({ ok: false, fix: [m[0], m[0].replace(m[1], f.type)], note: `type ${t} → ${f.type}` });
  }

  // "Sacral authority" / "emotional authority"
  for (const m of sentence.matchAll(/\b(Emotional|Solar Plexus|Sacral|Splenic|Ego|Heart|Self-Projected|Lunar|Mental|Environmental)\s+authority\b/gi)) {
    const a = AUTHORITIES[m[1].toLowerCase()];
    report.checked++;
    if (f.authority && f.authority !== a) {
      verdicts.push({ ok: false, fix: [m[0], m[0].replace(m[1], f.authority)], note: `authority ${a} → ${f.authority}` });
    }
  }

  for (const v of verdicts) {
    if (v.ok) continue;
    report.notes.push(v.note);
    if (v.fix) {
      out = out.replace(v.fix[0], v.fix[1]);
      report.fixed++;
    } else {
      report.removed++;
      return null;
    }
  }
  return out;
}

/** Guard a block of prose: correct what we can, drop sentences we can't support. */
export function guardText(text: string, f: Facts, report: GuardReport): string {
  if (!text) return text;
  // Split into sentences but keep paragraph breaks.
  return text
    .split(/(\n{2,})/)
    .map((para) => {
      if (/^\n+$/.test(para)) return para;
      const parts = para.match(/[^.!?]+(?:[.!?]+["')\]]*|$)\s*/g) || [para];
      return parts.map((s) => checkSentence(s, f, report)).filter((s): s is string => s !== null).join("").trimEnd();
    })
    .join("");
}

/** Short labels ("Sun in Leo, 5th house"): correct or blank — never drop the item silently. */
function guardLabel(label: string, f: Facts, report: GuardReport): string {
  const out = checkSentence(label, f, report);
  return out ?? "";
}

export function guardReading<T extends Partial<CoreProfile>>(core: T, charts: Charts): { core: T; report: GuardReport } {
  const f = buildFacts(charts);
  const report: GuardReport = { checked: 0, fixed: 0, removed: 0, notes: [] };
  const g = (s?: string) => (typeof s === "string" ? guardText(s, f, report) : s);
  const c: any = { ...core };
  c.recognition = g(c.recognition);
  c.portrait = g(c.portrait);
  c.narrative = g(c.narrative);
  if (Array.isArray(c.chart_threads)) {
    c.chart_threads = c.chart_threads
      .map((t: any) => {
        const placement = guardLabel(t.placement || "", f, report);
        if (t.placement && !placement) return null; // the anchor claim itself was false
        return { ...t, placement, plain_meaning: g(t.plain_meaning), great_turning_link: g(t.great_turning_link), note: g(t.note) };
      })
      .filter(Boolean);
  }
  if (Array.isArray(c.lens_readings)) {
    c.lens_readings = c.lens_readings.map((l: any) => ({
      ...l,
      summary: g(l.summary),
      reading: g(l.reading),
      placements: (l.placements || [])
        .map((p: any) => {
          const label = guardLabel(p.label || "", f, report);
          if (p.label && !label) return null;
          return { ...p, label, meaning: g(p.meaning), great_turning: g(p.great_turning) };
        })
        .filter(Boolean),
    }));
  }
  if (Array.isArray(c.gift_constellation)) {
    c.gift_constellation = c.gift_constellation.map((x: any) => ({ ...x, how_they_carry: g(x.how_they_carry) }));
  }
  return { core: c as T, report };
}
