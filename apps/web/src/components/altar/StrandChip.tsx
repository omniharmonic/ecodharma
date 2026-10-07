import { RELATION_META, type Relation } from "@/lib/altar/model";

const GLYPH: Record<Relation, string> = {
  embodies: "☉", strains: "⟂", questions: "?", evidences: "✦", nourishes: "∿", releases: "⤓", discovers: "✧",
};

export function chargeClass(charge: number) {
  return charge > 0 ? "charge-pos" : charge < 0 ? "charge-neg" : "charge-zero";
}

/** A strand rendered as a small signal tag: relation glyph · element · charge. */
export function StrandChip({ relation, title, charge, status }: { relation: Relation; title: string; charge: number; status?: string }) {
  return (
    <span className={`strand-chip ${chargeClass(charge)} ${status === "proposed" ? "border-dashed" : ""}`} title={`${RELATION_META[relation].label} · charge ${charge > 0 ? "+" : ""}${charge}`}>
      <span className="glyph" aria-hidden>{GLYPH[relation]}</span>
      <span>{RELATION_META[relation].label}</span>
      <span className="normal-case tracking-normal text-fg/80">{title.length > 38 ? `${title.slice(0, 36)}…` : title}</span>
      <span aria-hidden>{charge > 0 ? "+".repeat(charge) : charge < 0 ? "−".repeat(-charge) : "·"}</span>
    </span>
  );
}

export { GLYPH as RELATION_GLYPH };
