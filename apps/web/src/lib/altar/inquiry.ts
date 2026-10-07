// The Dharma Inquiry — six chambers for finding what your life is for.
//
// Structure, sequence and themes follow Daniel Schmachtenberger's "Dharma
// Inquiry" (Personal, August 3, 2024 — https://civilizationemerging.com/dharma-inquiry-2/):
// Values · Propensities · Capacities · Karma · Patterns · Guidance; dharma as
// right relationship with Life, lived in being, doing and becoming; the "ask
// why until it's fundamental" ladder; gifts and shadows explored together; an
// ongoing, unending inquiry. Questions are paraphrased in our own voice (short
// attributed phrases only) — read his original for the full text. Pure.

import type { Mode } from "./model";

export type Question = { id: string; q: string; hint?: string; feeds: string; deep?: boolean };
export type Chamber = {
  id: string;
  numeral: string;
  glyph: string;
  title: string;
  essence: string; // what this chamber is for
  mode: Mode | "all";
  /** Daniel: "ask 'why' to your answers … until you come to something that feels fundamental." */
  ladder?: boolean;
  questions: Question[];
};

export const DHARMA_FRAME = {
  dharma: "Dharma, as Daniel Schmachtenberger uses it, means something like right relationship with Life — the path of greatest integrity; choices that don't create unnecessary suffering and help heal its sources; a life moving toward more wholeness, intimacy, aliveness, clarity and love for all beings.",
  ineffable: "Every definition falls short. It can be felt more than described, and never prescribed — “the dharma that is prescribable is not the essential dharma.”",
  universal: "Some principles of dharma hold for everyone.",
  unique: "And there is your unique dharma: right action for you, here, given your particular capacities and experiences — your own life path.",
  free: "This isn't deterministic. No algorithm can compute your right choice ahead of time. The inquiry won't tell you what to do; it deepens your relationship with yourself — and more awareness, clarity and love moves a path in ways no one can predict.",
  modes: "Dharma lives in your being (who and how you are, moment to moment), your doing (what you do, and what it's in service of), and your becoming (how you grow in both).",
  unfolding: "It is an ongoing, unending inquiry. It includes how you meet the small things, and it changes across the seasons of a life.",
  shadow: "Your issues and your gifts are related. The hurts that limit you often sensitized you to what is yours to give — “every gift has a shadow, every shadow has a gift.” Explore them together.",
  why: "Where a chamber invites it, ask “why?” of your answer — and again — until you reach something that feels fundamental.",
  credit: "After Daniel Schmachtenberger's Dharma Inquiry (2024).",
  source: "https://civilizationemerging.com/dharma-inquiry-2/",
};

/** Daniel's five orienting questions, by mode. */
export const MODE_QUESTIONS: Record<Mode, string[]> = {
  being: ["Who and how are you being, moment to moment?", "How connected are you to your own being — your love, your principles — and how does that shape what you perceive and express?"],
  doing: ["What are you doing with your life, and where does the motivation come from?", "What are your actions in service of?"],
  becoming: ["How are you growing — in your being, and in your capacity to do?"],
};

export const CHAMBERS: Chamber[] = [
  {
    id: "values", numeral: "I", glyph: "✶", title: "Values", mode: "all", ladder: true,
    essence: "What you revere, what you can't bear, and what you'd give yourself to.",
    questions: [
      { id: "values.inspire", q: "Who inspires you most — people you know, or figures from history? What is it about them?", feeds: "root" },
      { id: "values.beauty", q: "Where do you find the most beauty? What moves you most?", feeds: "prayer · being" },
      { id: "values.wrong", q: "What feels most deeply wrong — most “off” — in the world?", feeds: "prayer · toward what" },
      { id: "values.deathbed", q: "Looking back from your deathbed, who would you be most proud to have been?", feeds: "measure" },
      { id: "values.sacred", q: "What is sacred to you? And what does “sacred” mean to you?", feeds: "devotion" },
      { id: "values.devoted", q: "What are you devoted to — and what does devotion mean?", feeds: "prayer · for whom" },
      { id: "values.respect", q: "Who do you respect most, and what is it you respect in them?", feeds: "root", deep: true },
      { id: "values.virtues", q: "Which virtues would you most like to grow in yourself — and why those?", feeds: "capacity", deep: true },
      { id: "values.bother", q: "What kinds of behaviour — and people — bother you most?", feeds: "inquiry", deep: true },
      { id: "values.issues", q: "Which issues in the world upset you most?", feeds: "prayer", deep: true },
      { id: "values.news", q: "What news about the world would move you most to read one day?", feeds: "prayer · toward what", deep: true },
      { id: "values.unseen", q: "What would you work on if you could succeed — but no one would ever know it was you?", feeds: "work", deep: true },
      { id: "values.increase", q: "If you could, which few qualities would you grow in everyone? Which few would you lessen?", feeds: "prayer", deep: true },
      { id: "values.sacrifice", q: "What would you give up personal benefit for? What matters more to you than your own life?", feeds: "prayer", deep: true },
      { id: "values.meaning", q: "What is meaningfulness founded on, for you?", feeds: "root", deep: true },
      { id: "values.loyal", q: "What are you loyal to — what does loyalty mean — and what would be reason enough to break it?", feeds: "root", deep: true },
      { id: "values.shame", q: "What do you carry shame or guilt about? Remorse or regret?", hint: "Only as far as feels safe. Blank is fine.", feeds: "inquiry", deep: true },
      { id: "values.desires", q: "If every personal desire were already met, what would you then want, or care about?", feeds: "prayer", deep: true },
      { id: "values.oneyear", q: "If you knew you would die next year, what would you do?", feeds: "work", deep: true },
    ],
  },
  {
    id: "propensities", numeral: "II", glyph: "∿", title: "Propensities", mode: "being",
    essence: "How you are made — natural strengths, what refills you, what you can't not attend to, and the shadow that walks with each gift.",
    questions: [
      { id: "prop.easy", q: "Thinking of aptitudes more than skills: what are you naturally good at — what comes easily?", feeds: "gift · work" },
      { id: "prop.replenish", q: "What kinds of activity replenish you?", feeds: "practice" },
      { id: "prop.attention", q: "What does your attention keep being called to — what can you not not pay attention to?", feeds: "work · inquiry" },
      { id: "prop.alive", q: "When have you felt most fully alive?", feeds: "measure · being" },
      { id: "prop.shadow", q: "What shadow or weakness travels with your greatest strength?", hint: "Every gift has a shadow.", feeds: "inquiry" },
      { id: "prop.paingift", q: "What has been most painful or difficult in your life — and what gift might live inside it?", hint: "Every shadow has a gift. Go only as far as feels safe.", feeds: "work · gift" },
      { id: "prop.taxing", q: "What are you willing to do even when it costs you?", feeds: "work", deep: true },
      { id: "prop.forits", q: "What do you love doing for its own sake — no results, no acknowledgement?", feeds: "practice", deep: true },
      { id: "prop.fascination", q: "What are you intrinsically fascinated by — what would you study simply because it's interesting?", feeds: "capacity · work", deep: true },
      { id: "prop.pride", q: "When have you felt the deepest satisfaction in something you did?", feeds: "measure", deep: true },
    ],
  },
  {
    id: "capacities", numeral: "III", glyph: "△", title: "Capacities", mode: "becoming", ladder: true,
    essence: "Who you could become — with the constraints lifted, one at a time.",
    questions: [
      { id: "cap.free", q: "If your financial needs were met for the rest of your life, what would you do?", feeds: "work · prayer" },
      { id: "cap.study", q: "If you went back to school, what would you study?", feeds: "capacity" },
      { id: "cap.download", q: "If you could download skills instantly, which few would you choose?", feeds: "capacity" },
      { id: "cap.fearless", q: "What would you do — and how would you be — if you were far more confident and far less afraid?", feeds: "work · root" },
      { id: "cap.loved", q: "If you had already received all the love, recognition and validation you could ever want — and no longer needed any of it — what would you do?", feeds: "work · prayer" },
      { id: "cap.wealth", q: "With vast wealth at your disposal, what would you do with your life and resources?", feeds: "work", deep: true },
      { id: "cap.smarter", q: "…if you were meaningfully smarter?", feeds: "capacity", deep: true },
      { id: "cap.discipline", q: "…if you had much better discipline?", feeds: "capacity", deep: true },
      { id: "cap.people", q: "…if you were better with people — more understanding, patient, empathetic?", feeds: "capacity", deep: true },
      { id: "cap.regulation", q: "…if your emotional regulation were steadier?", feeds: "capacity", deep: true },
      { id: "cap.deficits", q: "…if your main character deficits were resolved?", feeds: "capacity", deep: true },
      { id: "cap.team", q: "…if the right team and people were supporting you?", feeds: "work", deep: true },
      { id: "cap.slate", q: "…if your life started over with a clean slate — no commitments, no baggage?", feeds: "work", deep: true },
      { id: "cap.200", q: "…if you knew you'd live, and stay vital, until 200?", feeds: "work", deep: true },
    ],
  },
  {
    id: "karma", numeral: "IV", glyph: "∞", title: "Karma", mode: "doing",
    essence: "What you have received, what you owe forward, what you owe back — and who lives on through you.",
    questions: [
      { id: "karma.helped", q: "Who has helped you in your life?", feeds: "devotion" },
      { id: "karma.blessings", q: "What blessings have you received, without which you wouldn't have what you're most grateful for?", feeds: "root" },
      { id: "karma.forward", q: "What do you owe forward for those gifts — and what might paying it forward look like?", feeds: "work" },
      { id: "karma.hurt", q: "Whom have you hurt, directly or indirectly — and what amends are yours to make?", hint: "Where amends can't be made directly, how might you make them to life itself?", feeds: "work" },
      { id: "karma.loved", q: "Who have you loved that has died? What did you love most in them — and how could those traits keep living through you?", feeds: "capacity" },
      { id: "karma.expense", q: "Where has your success or benefit come at someone else's expense — family, partners, friends, other beings?", feeds: "inquiry", deep: true },
      { id: "karma.lineage", q: "Where has your family and lineage carried gifts or greatness — and how is that part of your story?", feeds: "root", deep: true },
      { id: "karma.lineage_harm", q: "Where has your lineage caused suffering — and how might you help repair it?", feeds: "work", deep: true },
    ],
  },
  {
    id: "patterns", numeral: "V", glyph: "⟁", title: "Patterns", mode: "becoming",
    essence: "Where compulsion, fear and ego choose for you — the edge your next becoming waits behind.",
    questions: [
      { id: "pat.compulsion", q: "Which of your habits feel more like compulsion than dharma?", feeds: "inquiry · release" },
      { id: "pat.fear", q: "What fears and attachments keep you from living what you know is highest in your heart?", feeds: "inquiry" },
      { id: "pat.ego", q: "How does ego get in the way of being the person you'd most respect?", feeds: "inquiry" },
      { id: "pat.rewarded", q: "What do you do because you're good at it or rewarded for it — but don't deeply care about?", feeds: "release" },
      { id: "pat.imbalance", q: "Where does your life feel out of balance?", feeds: "practice" },
      { id: "pat.doubt", q: "How do insecurity and self-doubt narrow your choices?", feeds: "inquiry", deep: true },
      { id: "pat.respect", q: "Which parts of your life would not earn the respect of those you respect most?", feeds: "inquiry", deep: true },
      { id: "pat.honest", q: "What do you do that you wouldn't want to be fully honest about?", feeds: "inquiry", deep: true },
      { id: "pat.expense", q: "Where is your success happening at others' expense?", feeds: "inquiry", deep: true },
    ],
  },
  {
    id: "guidance", numeral: "VI", glyph: "☉", title: "Guidance", mode: "all",
    essence: "The clearest moments of your life — the knowings you return to.",
    questions: [
      { id: "guide.spiritual", q: "What were the most profound spiritual experiences of your life — and what was clear in those moments?", feeds: "devotion · root" },
      { id: "guide.peace", q: "When have you felt most at peace? What would it be like to live from there?", feeds: "practice · being" },
      { id: "guide.sacred", q: "When have you felt the sacred most profoundly? When have you felt most in love?", feeds: "prayer · devotion" },
      { id: "guide.knowings", q: "What are the deepest, clearest knowings you have experienced?", feeds: "root · prayer" },
      { id: "guide.epiphany", q: "Which epiphanies have felt most clarifying, empowering or liberating?", feeds: "root", deep: true },
      { id: "guide.dying", q: "When you were with people you loved as they were dying, what mattered most? Afterward, what did you understand about life?", hint: "Only if this is part of your story.", feeds: "prayer", deep: true },
    ],
  },
];

export const QUESTION = new Map(CHAMBERS.flatMap((c) => c.questions.map((q) => [q.id, { ...q, chamber: c.id }] as const)));
export const chamberOf = (id: string) => CHAMBERS.find((c) => c.id === id);
export const nextChamber = (id: string) => CHAMBERS[CHAMBERS.findIndex((c) => c.id === id) + 1] || null;
export const coreQuestions = (c: Chamber) => c.questions.filter((q) => !q.deep);
export const deepQuestions = (c: Chamber) => c.questions.filter((q) => q.deep);

// ---------------------------------------------------------------- the ladder --
// An answer may carry "why" layers beneath it, stored inline: "answer\n↳ why1\n↳ why2".

export const WHY = "\n↳ ";

/** [surface, why1, why2, …] */
export function layers(answer: string | undefined): string[] {
  return (answer || "").split(WHY).map((s) => s.trim()).filter((s, i) => i === 0 || s);
}
export const surface = (answer: string | undefined) => layers(answer)[0] || "";
/** The deepest layer reached — "something that feels fundamental" (undefined if they didn't ladder). */
export function fundamental(answer: string | undefined): string | undefined {
  const l = layers(answer);
  return l.length > 1 ? l[l.length - 1] : undefined;
}
export const composeLayers = (ls: string[]) => ls.map((s) => s.trim()).filter((s, i) => i === 0 || s).join(WHY).trim();

// ------------------------------------------------------------------ phrasing --

/** Split a free answer into short, placeable phrases (list items, clauses). Uses the surface layer. */
export function phrases(answer: string | undefined, max = 4): string[] {
  const raw = surface(answer)
    .split(/\n+|;|•|·|(?<=[.!?])\s+/)
    .flatMap((s) => (s.split(",").length >= 3 ? s.split(",") : [s]))
    .map((s) => s.trim().replace(/^[-–—*\d.)\s]+/, "").replace(/[.!?]+$/, "").trim())
    .filter((s) => s.length >= 3 && s.length <= 140);
  return [...new Set(raw)].slice(0, max);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const clip = (s: string, n = 120) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s).replace(/[.!?]+$/, "");

export type InquirySuggestion = { kind: "devotion" | "root" | "work" | "practice" | "measure" | "inquiry" | "capacity"; title: string; why: string; mode?: Mode; scope?: "universal" | "unique"; chamber: string };

/** Turn a chamber's answers into proposed altar elements (the person chooses). */
export function proposeFromChamber(chamber: string, a: Record<string, string>): InquirySuggestion[] {
  const out: InquirySuggestion[] = [];
  const push = (s: Omit<InquirySuggestion, "chamber">) => out.push({ ...s, chamber });
  const ch = chamberOf(chamber);
  // The ladder first: what they reached as fundamental is the strongest seed.
  if (ch?.ladder) {
    for (const q of ch.questions) {
      const f = fundamental(a[q.id]);
      if (f) push({ kind: "root", title: cap(clip(f)), why: "Where your “why” came to rest — something fundamental.", scope: "universal" });
    }
  }
  switch (chamber) {
    case "values":
      for (const p of phrases(a["values.sacred"], 3)) push({ kind: "devotion", title: cap(p), why: "You named it sacred.", mode: "doing" });
      for (const p of phrases(a["values.devoted"], 2)) push({ kind: "devotion", title: cap(p), why: "You are devoted to it.", mode: "doing" });
      if (surface(a["values.deathbed"])) push({ kind: "measure", title: `I am becoming who I'd be proud to have been: ${phrases(a["values.deathbed"], 1)[0] || clip(surface(a["values.deathbed"]), 90)}`, why: "Your deathbed answer, as a living sign of alignment.", mode: "being" });
      for (const p of phrases(a["values.inspire"], 1)) push({ kind: "root", title: `What inspires me in ${p} is worth living by`, why: "Admiration points at a value you already hold.", scope: "universal" });
      for (const p of phrases(a["values.virtues"], 2)) push({ kind: "capacity", title: cap(p), why: "A virtue you want to grow.", mode: "becoming" });
      for (const p of phrases(a["values.unseen"], 1)) push({ kind: "work", title: cap(p), why: "What you'd do with no one watching.", mode: "doing" });
      break;
    case "propensities":
      for (const p of phrases(a["prop.replenish"], 2)) push({ kind: "practice", title: cap(p), why: "It replenishes you — a practice of being.", mode: "being" });
      for (const p of phrases(a["prop.attention"], 1)) push({ kind: "inquiry", title: `Why does my attention keep returning to ${p}?`, why: "Attention you can't not pay is often a calling.", mode: "becoming" });
      for (const p of phrases(a["prop.easy"], 1)) push({ kind: "work", title: `Offer what comes easily: ${p}`, why: "Ease is a signature of gift.", mode: "doing" });
      for (const p of phrases(a["prop.alive"], 1)) push({ kind: "measure", title: `More moments like this: ${p}`, why: "When you felt most fully alive.", mode: "being" });
      for (const p of phrases(a["prop.shadow"], 1)) push({ kind: "inquiry", title: `How do I hold the shadow of my gift: ${p}?`, why: "Every gift has a shadow.", mode: "becoming" });
      if (surface(a["prop.paingift"])) push({ kind: "root", title: "What hurt me also sensitized me to what is mine to give", why: "Every shadow has a gift.", scope: "unique" });
      break;
    case "capacities":
      for (const p of [...phrases(a["cap.study"], 1), ...phrases(a["cap.download"], 2)]) push({ kind: "capacity", title: cap(p), why: "A capacity you're reaching toward.", mode: "becoming" });
      for (const p of phrases(a["cap.fearless"], 1)) push({ kind: "work", title: cap(p), why: "What you'd do with less fear.", mode: "doing" });
      for (const p of phrases(a["cap.free"], 1)) push({ kind: "work", title: cap(p), why: "What you'd do if money weren't the question.", mode: "doing" });
      for (const p of phrases(a["cap.loved"], 1)) push({ kind: "work", title: cap(p), why: "What you'd do needing no recognition at all.", mode: "doing" });
      break;
    case "karma":
      for (const p of phrases(a["karma.helped"], 3)) push({ kind: "devotion", title: cap(p), why: "Those who helped make you.", mode: "doing" });
      for (const p of phrases(a["karma.forward"], 1)) push({ kind: "work", title: `Pay it forward: ${p}`, why: "What you owe forward.", mode: "doing" });
      for (const p of phrases(a["karma.hurt"], 1)) push({ kind: "work", title: `Make amends: ${p}`, why: "What you owe back — to them, or to life.", mode: "doing" });
      for (const p of phrases(a["karma.loved"], 2)) push({ kind: "capacity", title: `Let it live through me: ${p}`, why: "A trait you loved in someone gone.", mode: "becoming" });
      if (surface(a["karma.blessings"])) push({ kind: "root", title: "I have been given much, and it is mine to pass on", why: "Gratitude as a foundation.", scope: "universal" });
      for (const p of phrases(a["karma.lineage"], 1)) push({ kind: "root", title: `My lineage carries ${p}`, why: "Where your family's gift becomes your story.", scope: "unique" });
      break;
    case "patterns":
      for (const p of phrases(a["pat.compulsion"], 1)) push({ kind: "inquiry", title: `Is ${p} compulsion or dharma?`, why: "A habit that may not be yours to keep.", mode: "becoming" });
      for (const p of phrases(a["pat.fear"], 1)) push({ kind: "inquiry", title: `What would I choose if ${p} weren't choosing?`, why: "Fear and attachment at the edge of growth.", mode: "becoming" });
      for (const p of phrases(a["pat.ego"], 1)) push({ kind: "inquiry", title: `How do I get out of my own way: ${p}?`, why: "Where ego stands between you and who you'd respect.", mode: "becoming" });
      for (const p of phrases(a["pat.rewarded"], 1)) push({ kind: "inquiry", title: `Is it time to release ${p}?`, why: "Good at it, rewarded for it — but not what you care about.", mode: "doing" });
      for (const p of phrases(a["pat.imbalance"], 1)) push({ kind: "practice", title: `Rebalance: ${p}`, why: "Where your life feels out of balance.", mode: "being" });
      break;
    case "guidance":
      for (const p of phrases(a["guide.peace"], 1)) push({ kind: "practice", title: `Return to where I was most at peace: ${p}`, why: "Live from that place.", mode: "being" });
      for (const p of phrases(a["guide.knowings"], 2)) push({ kind: "root", title: cap(p), why: "One of your deepest, clearest knowings.", scope: "unique" });
      for (const p of phrases(a["guide.sacred"], 2)) push({ kind: "devotion", title: cap(p), why: "Where you felt the sacred, or most in love.", mode: "doing" });
      break;
  }
  return out.filter((s, i) => out.findIndex((x) => x.title.toLowerCase() === s.title.toLowerCase()) === i);
}

/** The raw material for the Prayer — the person's own most luminous lines (deepest "why" first). */
export function prayerMaterial(all: Record<string, string>): { label: string; text: string }[] {
  const out: { label: string; text: string }[] = [];
  for (const c of CHAMBERS.filter((c) => c.ladder)) {
    for (const q of c.questions) {
      const f = fundamental(all[q.id]);
      if (f) out.push({ label: "where your why came to rest", text: f.slice(0, 280) });
    }
  }
  const pick: [string, string][] = [
    ["values.devoted", "you are devoted to"], ["values.sacred", "sacred to you"], ["values.sacrifice", "more important than your own life"],
    ["guide.knowings", "your clearest knowing"], ["guide.sacred", "where you felt the sacred"],
    ["values.news", "the news you long to read"], ["values.wrong", "what is most off in the world"], ["values.beauty", "where you find beauty"],
    ["karma.forward", "what you'd pay forward"], ["prop.paingift", "the gift inside your pain"],
  ];
  for (const [k, label] of pick) if (surface(all[k])) out.push({ label, text: surface(all[k]).slice(0, 280) });
  return out.slice(0, 9);
}

/** Draft facets for the Prayer from the inquiry (the person edits them). */
export function prayerFacets(all: Record<string, string>): { for_whom: string; toward_what: string; through_what: string } {
  return {
    for_whom: phrases(all["values.devoted"], 1)[0] || phrases(all["values.sacred"], 1)[0] || "",
    toward_what: phrases(all["values.news"], 1)[0] || phrases(all["values.wrong"], 1)[0] || "",
    through_what: phrases(all["prop.paingift"], 1)[0] || phrases(all["prop.easy"], 1)[0] || "",
  };
}

/** A deterministic mirror: what we heard, in their words, joined to their reading. */
export function mirrorChamber(chamber: string, a: Record<string, string>, reading?: { gifts?: string[]; hdType?: string }): string {
  const ch = chamberOf(chamber);
  if (!ch) return "";
  const heard = ch.questions.flatMap((q) => phrases(a[q.id], 1)).slice(0, 3);
  if (!heard.length) return "Silence is an answer too. Return to this chamber whenever you are ready.";
  const echo = heard.map((h) => `“${h}”`).join(", ");
  const deepest = ch.questions.map((q) => fundamental(a[q.id])).find(Boolean);
  const gift = reading?.gifts?.[0];
  const bridges: Record<string, string> = {
    values: "These are the coordinates of your prayer — what it reaches toward.",
    propensities: gift ? `This is how ${gift.replace(/^The\s+/, "the ")} in you moves when no one is asking — gift and shadow together.` : "This is how you move when no one is asking — gift and shadow together.",
    capacities: "This is your becoming — who you'd be with the constraints lifted.",
    karma: "This is your lineage. What was given to you wants to keep moving; what was broken wants repair.",
    patterns: "This is the edge where your next becoming is waiting. Seeing it clearly is already a kind of freedom.",
    guidance: "These are your clearest moments. Your prayer will come from here.",
  };
  const rest = deepest ? ` And beneath it all, where your why came to rest: “${clip(deepest, 160)}.”` : "";
  return `You spoke of ${echo}. ${bridges[chamber] || ""}${rest}`;
}

/** "An ongoing and unending inquiry": one question to return to at a deep ritual, rotating by seed. */
export function returnQuestion(all: Record<string, string>, seed: number): { id: string; q: string; prior?: string } {
  const answered = [...QUESTION.values()].filter((q) => surface(all[q.id]));
  const pool = answered.length ? answered : [...QUESTION.values()].filter((q) => !q.deep);
  const q = pool[Math.abs(Math.floor(seed)) % pool.length];
  return { id: q.id, q: q.q, prior: surface(all[q.id]) || undefined };
}
