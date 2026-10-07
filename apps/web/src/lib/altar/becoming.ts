// Becoming — the aggregations every visualization reads: per-element vital signs
// derived from confirmed strands and alignment readings, the reflection time
// series, prayer rings, and the cybernetic "loop state". Pure (no server-only).

import type { ElementKind, Lens, Relation } from "./model";

export type SnapElement = {
  lineage_id: number;
  kind: ElementKind;
  title: string;
  status: string;
  version: number;
  created_at: string;
  retired: boolean;
};
export type SnapStrand = { reflection_id: number; lineage_id: number; relation: Relation; charge: number; status: string; at: string };
export type SnapReflection = { id: number; at: string; cadence: string; depth: number };
export type SnapAlignment = { reflection_id: number; lineage_id: number | null; lens: string; value: number | null; at: string };

export type Vital = {
  lineage_id: number;
  touches: number; // confirmed strands, all time
  recentTouches: number; // last 90 days
  charge: number; // mean charge of recent confirmed strands (-2..2), 0 if none
  aliveness: number | null; // 1..5 recent mean
  fidelity: number | null;
  lastTouched: string | null;
  strain: number; // count of recent "strains"
  relations: Partial<Record<Relation, number>>;
};

export type LoopState = {
  // The three loops of learning, and how recently each was walked.
  single: { last: string | null; count90: number }; // weekly practice
  double: { last: string | null; count90: number }; // method / measures
  triple: { last: string | null; count365: number }; // prayer / roots
  pulse: number; // 0..1 — how warm the practice is (recency-weighted reflection density)
};

const DAY = 86_400_000;

export function vitals(elements: SnapElement[], strands: SnapStrand[], alignment: SnapAlignment[], now = Date.now()): Map<number, Vital> {
  const out = new Map<number, Vital>();
  for (const e of elements) {
    out.set(e.lineage_id, { lineage_id: e.lineage_id, touches: 0, recentTouches: 0, charge: 0, aliveness: null, fidelity: null, lastTouched: null, strain: 0, relations: {} });
  }
  const sums = new Map<number, { c: number; n: number }>();
  for (const s of strands) {
    if (s.status !== "confirmed") continue;
    const v = out.get(s.lineage_id);
    if (!v) continue;
    v.touches++;
    v.relations[s.relation] = (v.relations[s.relation] || 0) + 1;
    if (!v.lastTouched || s.at > v.lastTouched) v.lastTouched = s.at;
    if (now - Date.parse(s.at) <= 90 * DAY) {
      v.recentTouches++;
      if (s.relation === "strains") v.strain++;
      const acc = sums.get(s.lineage_id) || { c: 0, n: 0 };
      acc.c += s.charge;
      acc.n++;
      sums.set(s.lineage_id, acc);
    }
  }
  for (const [id, { c, n }] of sums) out.get(id)!.charge = n ? c / n : 0;
  const lensAcc = new Map<string, { s: number; n: number }>();
  for (const a of alignment) {
    if (a.value == null || a.lineage_id == null || now - Date.parse(a.at) > 90 * DAY) continue;
    const k = `${a.lineage_id}:${a.lens}`;
    const acc = lensAcc.get(k) || { s: 0, n: 0 };
    acc.s += a.value;
    acc.n++;
    lensAcc.set(k, acc);
  }
  for (const [k, { s, n }] of lensAcc) {
    const [id, lens] = k.split(":");
    const v = out.get(Number(id));
    if (!v) continue;
    if (lens === "aliveness") v.aliveness = s / n;
    if (lens === "fidelity") v.fidelity = s / n;
  }
  return out;
}

/** Overall lens means (lineage null = overall readings) for the last N days. */
export function lensTrend(alignment: SnapAlignment[], lens: Lens, days = 90, now = Date.now()): { at: string; value: number }[] {
  return alignment
    .filter((a) => a.lens === lens && a.value != null && now - Date.parse(a.at) <= days * DAY)
    .map((a) => ({ at: a.at, value: a.value as number }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function loopState(reflections: SnapReflection[], now = Date.now()): LoopState {
  const by = (d: number) => reflections.filter((r) => r.depth === d).sort((a, b) => b.at.localeCompare(a.at));
  const within = (rs: SnapReflection[], days: number) => rs.filter((r) => now - Date.parse(r.at) <= days * DAY).length;
  // Pulse: exponentially-decayed reflection density (half-life 10 days), squashed to 0..1.
  const heat = reflections.reduce((h, r) => h + Math.pow(0.5, (now - Date.parse(r.at)) / (10 * DAY)), 0);
  return {
    single: { last: by(1)[0]?.at ?? null, count90: within(by(1), 90) },
    double: { last: by(2)[0]?.at ?? null, count90: within(by(2), 90) },
    triple: { last: by(3)[0]?.at ?? null, count365: within(by(3), 365) },
    pulse: Math.min(1, heat / 3),
  };
}

/** Mean charge of each reflection's confirmed strands (for spiral/stardust color). */
export function reflectionCharges(strands: SnapStrand[]): Map<number, number> {
  const acc = new Map<number, { c: number; n: number }>();
  for (const s of strands) {
    if (s.status === "rejected") continue;
    const a = acc.get(s.reflection_id) || { c: 0, n: 0 };
    a.c += s.charge;
    a.n++;
    acc.set(s.reflection_id, a);
  }
  return new Map([...acc].map(([id, { c, n }]) => [id, n ? c / n : 0]));
}

/** Roots under strain: ≥3 "strains" in 60 days → offer an Inquiry (root-strain detection). */
export function strainedRoots(elements: SnapElement[], strands: SnapStrand[], now = Date.now()): number[] {
  const roots = new Set(elements.filter((e) => e.kind === "root" && !e.retired && e.status !== "questioning").map((e) => e.lineage_id));
  const count = new Map<number, number>();
  for (const s of strands) {
    if (s.status === "rejected" || s.relation !== "strains" || !roots.has(s.lineage_id)) continue;
    if (now - Date.parse(s.at) > 60 * DAY) continue;
    count.set(s.lineage_id, (count.get(s.lineage_id) || 0) + 1);
  }
  return [...count].filter(([, n]) => n >= 3).map(([id]) => id);
}

// --- sky / soil geometry helpers (deterministic, so SSR and client agree) ----

/** Stable pseudo-random in [0,1) from an integer seed. */
export function seeded(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Moon phase 0..1 (0 = new, 0.5 = full) from a date — mean synodic month. */
export function moonPhase(at: Date): number {
  const ref = Date.UTC(2000, 0, 6, 18, 14); // a known new moon
  const synodic = 29.530588853 * DAY;
  const p = ((at.getTime() - ref) % synodic) / synodic;
  return p < 0 ? p + 1 : p;
}

export function moonPhaseName(p: number): string {
  const names = ["New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous", "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent"];
  return names[Math.round(p * 8) % 8];
}
