// Threads — patterns noticed ACROSS reflections, offered back as hypotheses the
// person accepts, renames, or dismisses. Never conclusions. Pure.
//   radiance      an element that reliably brings them alive
//   contraction   an element that reliably contracts them
//   kinship       two elements that keep arriving together
//   quiet         something once alive that has gone quiet
import type { SnapElement, SnapStrand } from "./becoming";

export type ThreadProposal = { signature: string; title: string; why: string; lineages: number[] };

const DAY = 86_400_000;

export function detectThreads(elements: SnapElement[], strands: SnapStrand[], now = Date.now()): ThreadProposal[] {
  const live = new Map(elements.filter((e) => !e.retired && e.kind !== "prayer" && e.kind !== "thread").map((e) => [e.lineage_id, e]));
  const recent = strands.filter((s) => s.status === "confirmed" && live.has(s.lineage_id) && now - Date.parse(s.at) <= 90 * DAY);
  const out: ThreadProposal[] = [];
  const by = new Map<number, SnapStrand[]>();
  for (const s of recent) by.set(s.lineage_id, [...(by.get(s.lineage_id) || []), s]);

  for (const [id, ss] of by) {
    if (ss.length < 3) continue;
    const mean = ss.reduce((a, s) => a + s.charge, 0) / ss.length;
    const t = live.get(id)!.title;
    if (mean >= 1) out.push({ signature: `radiance:${id}`, title: `${t} reliably brings you alive`, why: `${ss.length} reflections in 90 days, mean charge +${mean.toFixed(1)}.`, lineages: [id] });
    if (mean <= -1) out.push({ signature: `contraction:${id}`, title: `${t} keeps contracting you`, why: `${ss.length} reflections in 90 days, mean charge ${mean.toFixed(1)}. Is it the work, or the way?`, lineages: [id] });
  }

  // co-occurrence within the same reflection
  const perReflection = new Map<number, Set<number>>();
  for (const s of recent) perReflection.set(s.reflection_id, new Set([...(perReflection.get(s.reflection_id) || []), s.lineage_id]));
  const pairs = new Map<string, number>();
  for (const set of perReflection.values()) {
    const ids = [...set].sort((a, b) => a - b);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = `${ids[i]}-${ids[j]}`;
      pairs.set(k, (pairs.get(k) || 0) + 1);
    }
  }
  for (const [k, n] of pairs) {
    if (n < 3) continue;
    const [a, b] = k.split("-").map(Number);
    out.push({ signature: `kinship:${k}`, title: `${live.get(a)!.title} and ${live.get(b)!.title} keep arriving together`, why: `Touched together in ${n} reflections.`, lineages: [a, b] });
  }

  // gone quiet: ≥3 touches ever, none in 45 days
  const all = strands.filter((s) => s.status === "confirmed" && live.has(s.lineage_id));
  const last = new Map<number, { n: number; at: number }>();
  for (const s of all) {
    const cur = last.get(s.lineage_id) || { n: 0, at: 0 };
    last.set(s.lineage_id, { n: cur.n + 1, at: Math.max(cur.at, Date.parse(s.at)) });
  }
  for (const [id, v] of last) {
    if (v.n >= 3 && now - v.at > 45 * DAY) {
      out.push({ signature: `quiet:${id}`, title: `${live.get(id)!.title} has gone quiet`, why: `Not touched in ${Math.round((now - v.at) / DAY)} days. Resting, or drifting?`, lineages: [id] });
    }
  }
  return out;
}
