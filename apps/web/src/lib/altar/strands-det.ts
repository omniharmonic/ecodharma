// Deterministic strand extraction — the no-AI path (and the safety net when
// Claude is off). Turns a reflection into proposed STRANDS: typed, charged links
// from the person's own words to the altar elements they touched, each grounded
// in a verbatim quote. The person confirms/edits; nothing is final until they do.
// Pure (no server-only).

import { RELATION_META, type ElementKind, type Relation } from "./model";

export type StrandTarget = { lineage_id: number; kind: ElementKind; title: string; aliases?: string[] };
export type DetStrand = { lineage_id: number; relation: Relation; charge: number; quote: string; proposed_by: "det"; score: number };

const STOP = new Set([
  "about", "after", "again", "being", "could", "every", "first", "from", "have", "into", "just", "more", "other",
  "really", "should", "since", "some", "than", "that", "their", "them", "then", "there", "these", "they", "thing",
  "things", "this", "those", "through", "very", "what", "when", "where", "which", "while", "with", "would", "your",
  "work", "life", "make", "made", "want", "feel", "felt", "like", "time", "week",
]);

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim();
const stem = (w: string) => w.replace(/(ings?|ed|es|s)$/u, "");
export const keywords = (s: string): string[] =>
  [...new Set(norm(s).split(" ").filter((w) => w.length >= 4 && !STOP.has(w)).map(stem))];

// Relation cues, highest priority first (a "let go" sentence that also says
// "alive" is primarily a release).
const CUES: [Relation, RegExp][] = [
  ["releases", /\b(let(?:ting)? go|releas\w*|compost\w*|done with|step(?:ping)? back from|quit\w*|lay(?:ing)? down|no longer (?:need|want|serv))/i],
  ["strains", /\b(drain\w*|exhaust\w*|tired|frustrat\w*|resent\w*|struggl\w*|heavy|stuck|overwhelm\w*|burn(?:ed|t)? ?out|depleted|anxious|against|forc(?:ed|ing)|grind\w*|out of alignment|misalign\w*|hollow)\b/i],
  ["questions", /(\?|\b(wonder\w*|question\w*|unsure|not sure|doubt\w*|is it still|rethink\w*|reconsider\w*|whether)\b)/i],
  ["discovers", /\b(realiz\w*|realis\w*|notic\w*|discover\w*|learn\w*|insight|dawned|saw that|turns out|it hit me)\b/i],
  ["evidences", /\b(shipped|launch\w*|finish\w*|complet\w*|result\w*|outcome|feedback|told me|thanked|grew|harvest\w*|bore fruit|fruit)\b/i],
  ["nourishes", /\b(nourish\w*|rest\w*|restor\w*|replenish\w*|supported|held me|grateful|gratitude|refill\w*|recharg\w*)\b/i],
  ["embodies", /\b(alive|joy\w*|flow|lit up|aligned|in service|meaningful|devot\w*|prayer in motion|on purpose|true to)\b/i],
];

const POS = /\b(alive|joy\w*|flow|lit up|love\w*|grateful|gratitude|beautiful|aligned|clear|clarity|nourish\w*|rest\w*|delight\w*|peace\w*|meaning\w*|energi[sz]ed|warm\w*|connected|free)\b/gi;
const NEG = /\b(drain\w*|exhaust\w*|tired|frustrat\w*|resent\w*|struggl\w*|heavy|stuck|overwhelm\w*|depleted|anxious|afraid|fear\w*|lonely|hollow|numb|forc(?:ed|ing)|grind\w*|ashamed|angry|sad)\b/gi;

export function chargeOf(sentence: string): number {
  const p = (sentence.match(POS) || []).length;
  const n = (sentence.match(NEG) || []).length;
  return Math.max(-2, Math.min(2, p - n));
}

export function relationOf(sentence: string, charge: number): Relation {
  for (const [rel, re] of CUES) if (re.test(sentence)) return rel;
  return charge < 0 ? "strains" : "embodies";
}

export function sentences(text: string): string[] {
  return (text.replace(/\s+/g, " ").match(/[^.!?\n]+[.!?]*/g) || []).map((s) => s.trim()).filter((s) => s.length > 3);
}

/** How strongly a sentence mentions an element (0 = not at all). */
export function mentionScore(sentence: string, t: StrandTarget): number {
  const s = ` ${norm(sentence)} `;
  const title = norm(t.title);
  if (title.length >= 3 && s.includes(` ${title} `)) return 3;
  for (const a of t.aliases || []) if (norm(a).length >= 3 && s.includes(` ${norm(a)} `)) return 3;
  const kw = keywords(t.title);
  if (!kw.length) return 0;
  const words = new Set(norm(sentence).split(" ").map(stem));
  const hits = kw.filter((k) => words.has(k)).length;
  if (kw.length === 1) return hits ? 2 : 0;
  if (hits >= Math.min(2, kw.length)) return 2;
  // One distinctive (long) keyword is a weaker signal.
  return hits && kw.some((k) => k.length >= 7 && words.has(k)) ? 1 : 0;
}

export function proposeStrandsDet(text: string, targets: StrandTarget[], max = 8): DetStrand[] {
  const out: DetStrand[] = [];
  const ss = sentences(text);
  for (const t of targets) {
    let best: DetStrand | null = null;
    for (const s of ss) {
      const m = mentionScore(s, t);
      if (!m) continue;
      const charge = chargeOf(s);
      const relation = relationOf(s, charge);
      const c = charge === 0 ? RELATION_META[relation].defaultCharge * (m >= 2 ? 1 : 0) : charge;
      const score = m * 10 + Math.abs(c);
      if (!best || score > best.score) best = { lineage_id: t.lineage_id, relation, charge: c, quote: s.slice(0, 280), proposed_by: "det", score };
    }
    if (best) out.push(best);
  }
  return out.sort((a, b) => b.score - a.score).slice(0, max);
}
