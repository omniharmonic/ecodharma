import "server-only";
import { withUser } from "../db";
import { decOpt } from "../crypto";
import { getAltar, listReflections } from "./repo";
import { altarElements, KIND_META, RELATION_META, type Relation } from "./model";

// The Story of a period (a season, a year, a solar return) — assembled from the
// person's OWN words: the moments most alive, the strains, what was questioned,
// what was released, how the prayer and roots changed. Deterministic and
// quote-faithful; Claude (via MCP) can then reflect on it with the person.

export type Story = {
  range: { since: string; until: string };
  counts: { reflections: number; strands: number };
  prayer: { from?: string; to?: string; rings: number };
  radiant: { element: string; quote: string; at: string }[];
  contracted: { element: string; quote: string; at: string }[];
  released: { element: string; at: string }[];
  questioned: { element: string; at: string }[];
  changes: { element: string; event: string; note: string; at: string }[];
  mostTouched: { element: string; kind: string; touches: number; meanCharge: number }[];
  markdown: string;
};

export async function assembleStory(userId: string, since: string, until: string): Promise<Story> {
  const altar = await getAltar(userId);
  const all = altarElements(altar).concat(altar.composted);
  const title = new Map(all.map((e) => [e.lineage_id, e]));
  const reflections = await listReflections(userId, { since, until, limit: 500 });
  const strands = reflections.flatMap((r) => r.strands.filter((s) => s.status === "confirmed").map((s) => ({ ...s, at: r.created_at })));
  const events = await withUser(userId, async (c) => (await c.query(
    "select lineage_id, event, note_enc, at from element_events where user_id = auth.uid() and at >= $1 and at < $2 order by at", [since, until])).rows);
  const rings = altar.prayerRings.filter((r) => r.created_at >= since && r.created_at < until);
  const before = altar.prayerRings.filter((r) => r.created_at < since).pop();

  const byCharge = [...strands].filter((s) => s.quote).sort((a, b) => b.charge - a.charge);
  const pick = (xs: typeof strands) => xs.slice(0, 5).map((s) => ({ element: title.get(s.lineage_id)?.title || "(composted)", quote: s.quote, at: s.at }));
  const touches = new Map<number, { n: number; c: number }>();
  for (const s of strands) {
    const t = touches.get(s.lineage_id) || { n: 0, c: 0 };
    t.n++; t.c += s.charge;
    touches.set(s.lineage_id, t);
  }
  const rel = (r: Relation) => strands.filter((s) => s.relation === r).map((s) => ({ element: title.get(s.lineage_id)?.title || "(composted)", at: s.at }));
  const story: Story = {
    range: { since, until },
    counts: { reflections: reflections.length, strands: strands.length },
    prayer: { from: before?.title, to: rings.length ? rings[rings.length - 1].title : undefined, rings: rings.length },
    radiant: pick(byCharge.filter((s) => s.charge > 0)),
    contracted: pick([...byCharge].reverse().filter((s) => s.charge < 0)),
    released: rel("releases"),
    questioned: rel("questions"),
    changes: events.filter((e) => e.event !== "created").map((e) => ({
      element: title.get(Number(e.lineage_id))?.title || "(element)", event: e.event, note: decOpt(e.note_enc), at: new Date(e.at).toISOString(),
    })),
    mostTouched: [...touches].sort((a, b) => b[1].n - a[1].n).slice(0, 6).map(([id, t]) => ({
      element: title.get(id)?.title || "(composted)", kind: title.get(id)?.kind || "work", touches: t.n, meanCharge: t.n ? t.c / t.n : 0,
    })),
    markdown: "",
  };
  const d = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const md: string[] = [`# Your story, ${d(since)} – ${d(until)}`, "", `${story.counts.reflections} reflections · ${story.counts.strands} strands woven.`, ""];
  if (story.prayer.to) md.push("## The prayer turned", story.prayer.from ? `From: “${story.prayer.from}”` : "", `To: “${story.prayer.to}”`, "");
  if (story.mostTouched.length) {
    md.push("## Where your life went", ...story.mostTouched.map((m) => `- ${KIND_META[m.kind as keyof typeof KIND_META]?.glyph || ""} **${m.element}** — touched ${m.touches}×, ${m.meanCharge > 0.25 ? "mostly radiant" : m.meanCharge < -0.25 ? "mostly contracted" : "mixed"}`), "");
  }
  if (story.radiant.length) md.push("## Most alive", ...story.radiant.map((q) => `> “${q.quote}” — *${q.element}, ${d(q.at)}*`), "");
  if (story.contracted.length) md.push("## Where it hurt", ...story.contracted.map((q) => `> “${q.quote}” — *${q.element}, ${d(q.at)}*`), "");
  if (story.questioned.length) md.push("## What you questioned", ...[...new Set(story.questioned.map((q) => q.element))].map((e) => `- ${e}`), "");
  if (story.released.length) md.push("## What you released", ...[...new Set(story.released.map((q) => q.element))].map((e) => `- ${e}`), "");
  if (story.changes.length) md.push("## How the altar changed", ...story.changes.map((c) => `- ${d(c.at)} · ${c.element}: ${c.event.replace("status:", "→ ")}${c.note ? ` — ${c.note}` : ""}`), "");
  story.markdown = md.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
  return story;
}

export { RELATION_META };
