import "server-only";
import { withUser } from "../db";
import { loadFramework } from "../framework";
import { normalizeReading } from "../normalize-reading";
import type { SnapAlignment, SnapElement, SnapReflection, SnapStrand } from "./becoming";

// One round-trip for everything the Soul's Becoming dashboard draws. Contains
// NO private text (no bodies, no quotes) — titles, statuses, numbers, dates —
// so it can be handed to client-side visualizations safely.

export type Snapshot = {
  now: string;
  elements: SnapElement[];
  links: { from: number; to: number; relation: string }[];
  strands: SnapStrand[];
  reflections: SnapReflection[];
  alignment: SnapAlignment[];
  rings: { version: number; title: string; at: string }[];
  natal: { body: string; lon: number; sign: string }[];
  ascendant: number | null;
  gifts: { id: string; name: string; prominence: number }[];
  hd: { type?: string; authority?: string; profile?: string; defined: string[] } | null;
  kin: { id: string; name: string; gifts: string[] }[];
  thresholds: { label: string; at: string; kind: string }[];
};

export async function loadSnapshot(userId: string): Promise<Snapshot> {
  const fw = loadFramework();
  return withUser(userId, async (c) => {
    const q = async (sql: string, args: unknown[] = []) => (await c.query(sql, args)).rows;
    const els = await q("select lineage_id, kind, title, status, version, created_at, retired_at from altar_elements where user_id = auth.uid() and superseded_at is null order by created_at");
    const rings = await q("select version, title, created_at from altar_elements where user_id = auth.uid() and kind = 'prayer' order by version");
    const links = await q("select from_lineage, to_lineage, relation from element_links where user_id = auth.uid()");
    const strands = await q("select reflection_id, lineage_id, relation, charge, status, created_at from strands where user_id = auth.uid() and status <> 'rejected' order by created_at");
    const refl = await q("select id, created_at, cadence, depth from reflections where user_id = auth.uid() order by created_at");
    const al = await q("select a.reflection_id, a.lineage_id, a.lens, a.value, r.created_at from alignment_readings a join reflections r on r.id = a.reflection_id where a.user_id = auth.uid()");
    const charts = await q("select modality, raw_json from charts where user_id = $1 and modality in ('western','human_design')", [userId]);
    const reading = await q("select content_json from gift_profiles where user_id = $1 and status = 'ready' order by generated_at desc limit 1", [userId]);
    const prefs = await q("select hemisphere from ritual_prefs where user_id = auth.uid()");
    const hemisphere = prefs[0]?.hemisphere || "N";
    const th = await q(
      "select label, at, kind from ritual_thresholds where hemisphere = $1 and at > now() - interval '400 days' and at < now() + interval '400 days' order by at",
      [hemisphere]);
    const western = charts.find((r) => r.modality === "western")?.raw_json;
    const hd = charts.find((r) => r.modality === "human_design")?.raw_json;
    const gp = reading[0] ? normalizeReading(reading[0].content_json) : null;
    const iso = (d: unknown) => new Date(d as string).toISOString();
    return {
      now: new Date().toISOString(),
      elements: els.map((e) => ({
        lineage_id: Number(e.lineage_id), kind: e.kind, title: e.title, status: e.status, version: e.version,
        created_at: iso(e.created_at), retired: !!e.retired_at,
      })),
      links: links.map((l) => ({ from: Number(l.from_lineage), to: Number(l.to_lineage), relation: l.relation })),
      strands: strands.map((s) => ({ reflection_id: Number(s.reflection_id), lineage_id: Number(s.lineage_id), relation: s.relation, charge: s.charge, status: s.status, at: iso(s.created_at) })),
      reflections: refl.map((r) => ({ id: Number(r.id), at: iso(r.created_at), cadence: r.cadence, depth: r.depth })),
      alignment: al.map((a) => ({ reflection_id: Number(a.reflection_id), lineage_id: a.lineage_id ? Number(a.lineage_id) : null, lens: a.lens, value: a.value, at: iso(a.created_at) })),
      rings: rings.map((r) => ({ version: r.version, title: r.title, at: iso(r.created_at) })),
      natal: Object.entries<any>(western?.positions || {}).map(([body, p]) => ({ body, lon: Number(p.lon), sign: p.sign })),
      ascendant: western?.houses?.ascendant?.lon ?? null,
      gifts: (gp?.gift_constellation || []).map((g, i) => ({
        id: g.gift_id, name: fw.gifts.find((x) => x.id === g.gift_id)?.name || g.gift_id, prominence: g.prominence ?? 1 - i * 0.2,
      })),
      hd: hd ? { type: hd.type, authority: hd.authority, profile: hd.profile, defined: hd.defined_centers || [] } : null,
      kin: [],
      thresholds: th.map((t) => ({ label: t.label, at: iso(t.at), kind: t.kind })),
    };
  });
}
