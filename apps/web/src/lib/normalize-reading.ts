// Boundary normalization for gift readings — the crash-proofing layer.
//
// A reading's content_json can be malformed in the wild: the model can return a
// required array field as a string/object/null, and rows written before a given
// fix keep whatever shape they were stored with (write-time hardening cannot
// reach them). normalizeReading() coerces ANY value into a structurally valid
// GiftProfile — every array is a real array of well-shaped items, every string
// is a string — and it never throws. Every consumer of content_json (profile
// render, share card, bot, nudges, matching, constellations) goes through it,
// so a malformed reading can at worst lose a section, never crash the app.
// The read-time healer (interpret.ts healStoredReading) then backfills any
// missing section from the deterministic fixture engine.
import type { Charts, ChartThread, CoreProfile, Framework, GiftCarry, GiftProfile, Ikigai, LensReading } from "./types";
import { clip, dedupePairings, fixtureCore, repairCore } from "./interpret-fixture";

const MODALITIES = ["western", "vedic", "human_design", "gene_keys"] as const;
const LENSES = ["astrology", "human_design", "gene_keys"] as const;
const TONES = ["gift", "shadow", "orientation", "background"] as const;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const rec = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const strArr = (v: unknown): string[] => arr(v).map((x) => str(x).trim()).filter(Boolean);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  allowed.includes(v as T) ? (v as T) : undefined;

function chartThreads(v: unknown): ChartThread[] {
  const out: ChartThread[] = [];
  for (const item of arr(v)) {
    const t = rec(item);
    const modality = oneOf(t.modality, MODALITIES);
    if (!modality) continue; // can't attach to any chart; the healer backfills if this leaves the section thin
    const placement = str(t.placement);
    const great_turning_link = str(t.great_turning_link);
    if (!placement && !great_turning_link) continue;
    const tone = oneOf(t.tone, TONES);
    const gift_id = str(t.gift_id);
    out.push({
      modality,
      ref: str(t.ref),
      placement,
      plain_meaning: str(t.plain_meaning),
      great_turning_link,
      note: str(t.note) || clip(great_turning_link, 96),
      ...(tone ? { tone } : {}),
      ...(gift_id ? { gift_id } : {}),
    });
  }
  return out;
}

function giftConstellation(v: unknown): GiftCarry[] {
  const out: GiftCarry[] = [];
  for (const item of arr(v)) {
    const g = rec(item);
    const gift_id = str(g.gift_id);
    if (!gift_id) continue;
    out.push({
      gift_id,
      how_they_carry: str(g.how_they_carry),
      ...(typeof g.prominence === "number" && Number.isFinite(g.prominence) ? { prominence: g.prominence } : {}),
      ...(strArr(g.evidence).length ? { evidence: strArr(g.evidence) } : {}),
    });
  }
  return out;
}

function lensReadings(v: unknown): LensReading[] {
  const out: LensReading[] = [];
  for (const item of arr(v)) {
    const l = rec(item);
    const lens = oneOf(l.lens, LENSES);
    if (!lens) continue;
    const placements = arr(l.placements)
      .map((p) => {
        const pr = rec(p);
        return { label: str(pr.label), meaning: str(pr.meaning), great_turning: str(pr.great_turning) };
      })
      .filter((p) => p.label || p.meaning);
    out.push({ lens, title: str(l.title), summary: str(l.summary), reading: str(l.reading), placements });
  }
  return out;
}

function domainsOf(v: unknown): GiftProfile["domains"] {
  return arr(v)
    .map((d) => { const dr = rec(d); return { domain_id: str(dr.domain_id), why: str(dr.why) }; })
    .filter((d) => d.domain_id);
}

function pairingsOf(v: unknown): GiftProfile["pairings"] {
  return arr(v)
    .map((p) => { const pr = rec(p); return { gift_id: str(pr.gift_id), domain_id: str(pr.domain_id) }; })
    .filter((p) => p.gift_id && p.domain_id);
}

function edgesOf(v: unknown): { pattern: string; how_to_relate: string }[] {
  return arr(v)
    .map((s) => { const sr = rec(s); return { pattern: str(sr.pattern), how_to_relate: str(sr.how_to_relate) }; })
    .filter((s) => s.pattern);
}

function trimTabs(v: unknown): GiftProfile["trim_tabs"] {
  const out: GiftProfile["trim_tabs"] = [];
  for (const item of arr(v)) {
    const t = rec(item);
    const action = str(t.action);
    if (!action) continue;
    // pg returns bigint ids as strings — accept both shapes.
    const id = typeof t.trim_tab_id === "number" ? t.trim_tab_id : t.trim_tab_id ? Number(str(t.trim_tab_id)) : NaN;
    out.push({
      action,
      domain_id: str(t.domain_id),
      ...(Number.isFinite(id) ? { trim_tab_id: id } : {}),
      ...(str(t.gift_basis) ? { gift_basis: str(t.gift_basis) } : {}),
      ...(str(t.upward_spiral) ? { upward_spiral: str(t.upward_spiral) } : {}),
      ...(str(t.ikigai_fit) ? { ikigai_fit: str(t.ikigai_fit) } : {}),
    });
  }
  return out;
}

/** Coerce anything into a structurally valid GiftProfile. Never throws. */
export function normalizeReading(raw: unknown): GiftProfile {
  let src: unknown = raw;
  if (typeof src === "string") {
    try { src = JSON.parse(src); } catch { src = {}; }
  }
  const r = rec(src);
  const meta = rec(r.meta);
  const edges = edgesOf(r.edges);
  return {
    recognition: str(r.recognition),
    portrait: str(r.portrait),
    narrative: str(r.narrative),
    chart_threads: chartThreads(r.chart_threads),
    gift_constellation: giftConstellation(r.gift_constellation),
    lens_readings: lensReadings(r.lens_readings),
    unique_gifts: strArr(r.unique_gifts),
    domains: domainsOf(r.domains),
    pairings: pairingsOf(r.pairings),
    orientations: strArr(r.orientations),
    shadow: edgesOf(r.shadow),
    ...(edges.length ? { edges } : {}),
    trim_tabs: trimTabs(r.trim_tabs),
    ...(r.hd_signature !== null && typeof r.hd_signature === "object" && !Array.isArray(r.hd_signature)
      ? { hd_signature: r.hd_signature as GiftProfile["hd_signature"] }
      : {}),
    ...(str(meta.engine)
      ? { meta: { engine: str(meta.engine), framework_version: str(meta.framework_version), voice_version: str(meta.voice_version) } }
      : {}),
  };
}

/**
 * Pure read-time heal: normalize (can never crash), then backfill every gap —
 * including a missing recognition/portrait, which generation would discard but
 * a read must recover — from the deterministic fixture computed from this
 * person's own charts. NEVER throws: if the fixture can't run (e.g. charts
 * missing), the normalized reading is returned as-is and is still safe to
 * render. `healed` names what was backfilled so callers can log + persist.
 */
export function healReadingCore(
  raw: unknown,
  framework: Framework,
  charts: Charts,
  ikigai: Ikigai,
): { profile: GiftProfile; healed: string[] } {
  const gp = normalizeReading(raw);
  const healed: string[] = [];
  try {
    let fx: CoreProfile | null = null;
    const fixture = () => (fx ??= fixtureCore(framework, charts, ikigai));
    if (!gp.recognition.trim()) { gp.recognition = fixture().recognition; healed.push("recognition"); }
    if (!gp.portrait.trim()) { gp.portrait = fixture().portrait; healed.push("portrait"); }
    // Drop pairings whose ids no longer exist in the framework BEFORE repair,
    // so framework-version drift also gets backfilled, not kept as dead ids.
    gp.pairings = dedupePairings(framework, gp.pairings);
    const rep = repairCore(gp, framework, charts, ikigai);
    Object.assign(gp, rep.core);
    healed.push(...rep.repaired);
  } catch (err) {
    console.error("[normalize-reading] heal failed (serving normalized reading as-is):", err);
  }
  return { profile: gp, healed };
}
