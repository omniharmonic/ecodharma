// The Dharma Inquiry — seven chambers for finding what your life is for.
//
// Structure after Daniel Schmachtenberger's "Dharma Inquiry"
// (https://civilizationemerging.com/dharma-inquiry-2/): dharma as *right
// relationship with Life*; universal and unique dharma; and the three modes of
// being, doing and becoming. Our question wording is original and credits his
// structure — it does not reproduce his document. Pure (no server-only).

import type { Mode } from "./model";

export type Question = { id: string; q: string; hint?: string; feeds: string };
export type Chamber = {
  id: string;
  numeral: string;
  glyph: string;
  title: string;
  essence: string; // what this chamber is for
  mode: Mode | "all";
  questions: Question[];
};

export const DHARMA_FRAME = {
  dharma: "Right relationship with Life — the path of greatest integrity, of choices that do not create unnecessary suffering and help heal its sources, toward more wholeness, intimacy, aliveness and love for all beings.",
  universal: "Universal dharma: what is right action for anyone.",
  unique: "Unique dharma: what is right action for you — given your particular capacities and experiences. Your unique life path.",
  modes: "Dharma lives in your being (receiving the beauty of what is), your doing (adding to it — protecting and creating), and your becoming (growing in both).",
  credit: "After Daniel Schmachtenberger's Dharma Inquiry.",
  source: "https://civilizationemerging.com/dharma-inquiry-2/",
};

export const CHAMBERS: Chamber[] = [
  {
    id: "values", numeral: "I", glyph: "✶", title: "Values", mode: "all",
    essence: "What moves you, what you revere, and what you could not bear to leave undone.",
    questions: [
      { id: "values.inspire", q: "Who inspires you most — living or not, known or unknown? What is it about them?", feeds: "devotion · root" },
      { id: "values.beauty", q: "Where do you find the most beauty? What moves you to stillness, or to tears?", feeds: "prayer · being" },
      { id: "values.wrong", q: "What feels most deeply wrong, or off, in the world — the thing you can't unsee?", feeds: "prayer · toward what" },
      { id: "values.news", q: "What news about the world would move you most to read one day?", feeds: "prayer · toward what" },
      { id: "values.deathbed", q: "Imagine looking back from the end of your life. Who would you be most proud to have been?", feeds: "measure" },
      { id: "values.sacred", q: "What is sacred to you?", hint: "Not what should be — what is.", feeds: "devotion" },
    ],
  },
  {
    id: "propensities", numeral: "II", glyph: "∿", title: "Propensities", mode: "being",
    essence: "How you are naturally made — what comes easily, what fascinates you for its own sake, what refills you.",
    questions: [
      { id: "prop.easy", q: "What comes easily to you that seems hard for others?", feeds: "gift · work" },
      { id: "prop.fascination", q: "What are you intrinsically fascinated by — what would you study just because it's interesting?", feeds: "capacity · work" },
      { id: "prop.replenish", q: "What kinds of activity replenish you rather than deplete you?", feeds: "practice" },
      { id: "prop.attention", q: "What does your attention keep returning to, uninvited?", feeds: "work · inquiry" },
    ],
  },
  {
    id: "capacities", numeral: "III", glyph: "△", title: "Capacities", mode: "becoming",
    essence: "Who you could become — the capacities you are growing toward.",
    questions: [
      { id: "cap.study", q: "If you went back to school tomorrow, what would you study?", feeds: "capacity" },
      { id: "cap.download", q: "If you could download three skills instantly, which would they be?", feeds: "capacity" },
      { id: "cap.fearless", q: "If you were far more confident and much less afraid, what would you do — and how would you be?", feeds: "work · root" },
      { id: "cap.free", q: "If your material needs were met for the rest of your life, how would you spend it — and your resources?", feeds: "work · prayer" },
    ],
  },
  {
    id: "karma", numeral: "IV", glyph: "∞", title: "Karma", mode: "doing",
    essence: "What you have received, and what you owe forward.",
    questions: [
      { id: "karma.helped", q: "Who has helped make you who you are?", feeds: "devotion" },
      { id: "karma.blessings", q: "What blessings have you received, without which you wouldn't have what you're most grateful for?", feeds: "root" },
      { id: "karma.forward", q: "What do you feel called to pay forward — and what might that look like?", feeds: "work" },
    ],
  },
  {
    id: "issues", numeral: "V", glyph: "⚕", title: "Issues & Gifts", mode: "becoming",
    essence: "The wound that sensitized you is often the doorway to what you have to give.",
    questions: [
      { id: "issues.wound", q: "What has hurt you most deeply — and what did it make you sensitive to?", hint: "Go only as far as feels safe. You can leave this blank.", feeds: "root · gift" },
      { id: "issues.medicine", q: "How has that sensitivity become an insight or capacity you now offer others?", feeds: "work · gift" },
      { id: "issues.limit", q: "Where does the old hurt still limit the fullest expression of your gift?", feeds: "inquiry" },
    ],
  },
  {
    id: "opportunities", numeral: "VI", glyph: "⟁", title: "Opportunities", mode: "becoming",
    essence: "The edge: where fear chooses for you, where you are divided, where the past holds you.",
    questions: [
      { id: "opp.fear", q: "Where is fear making your choices?", feeds: "inquiry" },
      { id: "opp.incongruent", q: "Where are your actions out of line with your values — or one desire at war with another?", feeds: "root · inquiry" },
      { id: "opp.trapped", q: "Where do past choices make you feel trapped? What would it take to be free?", feeds: "release" },
    ],
  },
  {
    id: "devotion", numeral: "VII", glyph: "☉", title: "Devotion", mode: "all",
    essence: "The heart of it. What you would give yourself to.",
    questions: [
      { id: "dev.sacrifice", q: "What would you sacrifice personal benefit for? What matters more to you than your own life?", feeds: "prayer" },
      { id: "dev.devoted", q: "What are you devoted to — and what does devotion mean to you?", feeds: "prayer · devotion" },
      { id: "dev.offering", q: "If your life were an offering, to whom or what would you offer it?", feeds: "prayer · for whom" },
    ],
  },
];

export const QUESTION = new Map(CHAMBERS.flatMap((c) => c.questions.map((q) => [q.id, { ...q, chamber: c.id }] as const)));
export const chamberOf = (id: string) => CHAMBERS.find((c) => c.id === id);
export const nextChamber = (id: string) => CHAMBERS[CHAMBERS.findIndex((c) => c.id === id) + 1] || null;

// ------------------------------------------------------------------ phrasing --

/** Split a free answer into short, placeable phrases (list items, clauses). */
export function phrases(answer: string, max = 4): string[] {
  const raw = (answer || "")
    .split(/\n+|;|•|·|(?<=[.!?])\s+/)
    .flatMap((s) => (s.split(",").length >= 3 ? s.split(",") : [s]))
    .map((s) => s.trim().replace(/^[-–—*\d.)\s]+/, "").replace(/[.!?]+$/, "").trim())
    .filter((s) => s.length >= 3 && s.length <= 140);
  return [...new Set(raw)].slice(0, max);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type InquirySuggestion = { kind: "devotion" | "root" | "work" | "practice" | "measure" | "inquiry" | "capacity"; title: string; why: string; mode?: Mode; scope?: "universal" | "unique"; chamber: string };

/** Turn a chamber's answers into proposed altar elements (the person chooses). */
export function proposeFromChamber(chamber: string, a: Record<string, string>): InquirySuggestion[] {
  const out: InquirySuggestion[] = [];
  const push = (s: Omit<InquirySuggestion, "chamber">) => out.push({ ...s, chamber });
  switch (chamber) {
    case "values":
      for (const p of phrases(a["values.sacred"], 3)) push({ kind: "devotion", title: cap(p), why: "You named it sacred.", mode: "doing" });
      if (a["values.deathbed"]) push({ kind: "measure", title: `I am becoming who I'd be proud to have been: ${phrases(a["values.deathbed"], 1)[0] || a["values.deathbed"].slice(0, 90)}`, why: "Your deathbed answer, as a living sign of alignment.", mode: "being" });
      for (const p of phrases(a["values.inspire"], 1)) push({ kind: "root", title: `What inspires me in ${p} is worth living by`, why: "Admiration points at a value you already hold.", scope: "universal" });
      break;
    case "propensities":
      for (const p of phrases(a["prop.replenish"], 2)) push({ kind: "practice", title: cap(p), why: "It replenishes you — a practice of being.", mode: "being" });
      for (const p of phrases(a["prop.attention"], 1)) push({ kind: "inquiry", title: `Why does my attention keep returning to ${p}?`, why: "Uninvited attention is often a calling.", mode: "becoming" });
      for (const p of phrases(a["prop.easy"], 1)) push({ kind: "work", title: `Offer what comes easily: ${p}`, why: "Ease is a signature of gift.", mode: "doing" });
      break;
    case "capacities":
      for (const p of [...phrases(a["cap.study"], 1), ...phrases(a["cap.download"], 2)]) push({ kind: "capacity", title: cap(p), why: "A capacity you're reaching toward.", mode: "becoming" });
      for (const p of phrases(a["cap.fearless"], 1)) push({ kind: "work", title: cap(p), why: "What you'd do with less fear.", mode: "doing" });
      break;
    case "karma":
      for (const p of phrases(a["karma.helped"], 3)) push({ kind: "devotion", title: cap(p), why: "Lineage — those who made you.", mode: "doing" });
      for (const p of phrases(a["karma.forward"], 1)) push({ kind: "work", title: `Pay it forward: ${p}`, why: "What you owe forward.", mode: "doing" });
      if (a["karma.blessings"]) push({ kind: "root", title: "I have been given much, and it is mine to pass on", why: "Gratitude as a foundation.", scope: "universal" });
      break;
    case "issues":
      for (const p of phrases(a["issues.medicine"], 1)) push({ kind: "work", title: cap(p), why: "Your wound, become medicine.", mode: "doing" });
      for (const p of phrases(a["issues.limit"], 1)) push({ kind: "inquiry", title: `How might I heal where ${p}?`, why: "Where the old hurt still limits the gift.", mode: "becoming" });
      if (a["issues.wound"]) push({ kind: "root", title: "What hurt me also sensitized me to what I have to give", why: "Issues and gifts are related.", scope: "unique" });
      break;
    case "opportunities":
      for (const p of phrases(a["opp.fear"], 1)) push({ kind: "inquiry", title: `What would I choose if fear weren't choosing: ${p}?`, why: "Fear at the edge of growth.", mode: "becoming" });
      for (const p of phrases(a["opp.incongruent"], 1)) push({ kind: "inquiry", title: `How do I bring ${p} back into integrity?`, why: "A place where values and actions part ways.", mode: "becoming" });
      break;
    case "devotion":
      for (const p of phrases(a["dev.offering"], 2)) push({ kind: "devotion", title: cap(p), why: "Whom your life is offered to.", mode: "doing" });
      break;
  }
  // de-duplicate by title
  return out.filter((s, i) => out.findIndex((x) => x.title.toLowerCase() === s.title.toLowerCase()) === i);
}

/** The raw material for the Prayer — the person's own most luminous lines. */
export function prayerMaterial(all: Record<string, string>): { label: string; text: string }[] {
  const pick: [string, string][] = [
    ["dev.offering", "you'd offer your life to"], ["dev.sacrifice", "more important than your own life"], ["dev.devoted", "you are devoted to"],
    ["values.news", "the news you long to read"], ["values.wrong", "what you can't unsee"], ["values.beauty", "where you find beauty"],
    ["karma.forward", "what you'd pay forward"], ["issues.medicine", "your wound become medicine"],
  ];
  return pick.filter(([k]) => (all[k] || "").trim()).map(([k, label]) => ({ label, text: all[k].trim().slice(0, 280) }));
}

/** Draft facets for the Prayer from the inquiry (the person edits them). */
export function prayerFacets(all: Record<string, string>): { for_whom: string; toward_what: string; through_what: string } {
  return {
    for_whom: phrases(all["dev.offering"], 1)[0] || phrases(all["values.sacred"], 1)[0] || "",
    toward_what: phrases(all["values.news"], 1)[0] || phrases(all["values.wrong"], 1)[0] || "",
    through_what: phrases(all["issues.medicine"], 1)[0] || phrases(all["prop.easy"], 1)[0] || "",
  };
}

/** A deterministic mirror: what we heard, in their words, joined to their reading. */
export function mirrorChamber(chamber: string, a: Record<string, string>, reading?: { gifts?: string[]; hdType?: string }): string {
  const ch = chamberOf(chamber);
  if (!ch) return "";
  const heard = ch.questions.flatMap((q) => phrases(a[q.id], 1)).slice(0, 3);
  if (!heard.length) return "Silence is an answer too. Return to this chamber whenever you are ready.";
  const echo = heard.map((h) => `“${h}”`).join(", ");
  const gift = reading?.gifts?.[0];
  const bridges: Record<string, string> = {
    values: "These are the coordinates of your prayer — what it reaches toward.",
    propensities: gift ? `This is how ${gift.replace(/^The\s+/, "the ")} in you moves when no one is asking.` : "This is how you move when no one is asking.",
    capacities: "This is your becoming — the edge you are growing toward.",
    karma: "This is your lineage. What was given to you wants to keep moving.",
    issues: "The wound and the gift share an address.",
    opportunities: "This is the edge where your next becoming is waiting.",
    devotion: "This is the heart of it. Hold these words close — your prayer will come from here.",
  };
  return `You spoke of ${echo}. ${bridges[chamber] || ""}`;
}
