// Invitations — the rebuilt "weekly dharma nudge". Pure core (no server-only):
// the grounding packet, the GROUNDING CONTRACT, and a personalised deterministic
// composer. The server side (invitations.ts) loads the packet, tries Claude,
// enforces this contract, and persists/sends.
//
// Why a contract: between Aug 24 and Oct 5 2026 the old nudge job emailed
// Claude's meta-replies ("I need the person's Ikigai words and chart data…")
// because it reused the READING prompt and checked nothing. Every invitation
// now must (1) reference ≥2 specific things from the person's own altar/reading,
// (2) contain no meta-language, (3) stay short, (4) not repeat recent ones.

export type Cadence = "weekly" | "lunar" | "monthly" | "quarterly" | "seasonal" | "solar_return" | "spontaneous";

/** One thing from the person's own world an invitation can be grounded in. */
export type PacketItem = {
  ref: string; // stable id, e.g. "gift:weaver", "work:12", "hd:authority"
  kind: "prayer" | "gift" | "work" | "practice" | "root" | "measure" | "inquiry" | "devotion" | "thread" | "capacity" | "hd" | "astro" | "gk" | "ikigai" | "trimtab";
  label: string; // human words for it ("the Weaver", "Building EcoDharma", "Sacral authority")
  detail?: string; // a sentence of context (how they carry it, the action…)
  anchors: string[]; // phrases whose presence in the output proves it was used
};

export type Packet = {
  firstName?: string;
  cadence: Cadence;
  depth: 1 | 2 | 3;
  thresholdLabel?: string; // "Winter Solstice 2026"
  items: PacketItem[];
  lastReflection?: string;
  recentBodies: string[]; // last ~6 invitations
  recentRefs: string[][]; // refs each of those touched
};

export type ContractResult = {
  ok: boolean;
  refs: string[];
  failures: string[];
  words: number;
  maxSimilarity: number;
};

export const MIN_REFS = 2;
export const MAX_WORDS = 140;
export const MAX_SIMILARITY = 0.6;

// The exact failure class we shipped, plus its cousins.
export const BANNED: RegExp[] = [
  /\bI need\b/i,
  /\bcould you (?:please )?(?:share|provide|send|tell me)\b/i,
  /\bthe person'?s\b/i,
  /\bthis person\b/i,
  /\bas an AI\b/i,
  /\blanguage model\b/i,
  /\bIkigai words\b/i,
  /\bchart data\b/i,
  /\b(?:your|the) message (?:may have been|was) cut off\b/i,
  /\bI(?:'m| am) (?:unable|not able)\b/i,
  /\bhere(?:'s| is) (?:a|your) (?:weekly )?(?:dharma )?(?:nudge|invitation)\b/i,
  /\{\{|\}\}|\[name\]|<\w+>/i, // unfilled template slots
  /\byour The\b/, // the "your The Storyteller" grammar bug
];

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

function trigrams(s: string): Set<string> {
  const w = norm(s).split(" ").filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 2 < w.length; i++) out.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return out;
}

export function similarity(a: string, b: string): number {
  const A = trigrams(a);
  const B = trigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Which packet items does this text demonstrably use? */
export function findRefs(text: string, items: PacketItem[]): string[] {
  const t = ` ${norm(text)} `;
  const out: string[] = [];
  for (const it of items) {
    if (it.anchors.some((a) => a && norm(a).length >= 3 && t.includes(` ${norm(a)} `))) out.push(it.ref);
  }
  return out;
}

export function checkContract(text: string, packet: Packet): ContractResult {
  const failures: string[] = [];
  const body = (text || "").trim();
  const words = body.split(/\s+/).filter(Boolean).length;
  if (!body) failures.push("empty");
  for (const re of BANNED) if (re.test(body)) failures.push(`banned:${re.source}`);
  if (words > MAX_WORDS) failures.push(`too_long:${words}`);
  if (words < 15) failures.push(`too_short:${words}`);
  const refs = findRefs(body, packet.items);
  if (refs.length < MIN_REFS) failures.push(`ungrounded:${refs.length}`);
  const maxSimilarity = Math.max(0, ...packet.recentBodies.map((r) => similarity(body, r)));
  if (maxSimilarity > MAX_SIMILARITY) failures.push(`repetitive:${maxSimilarity.toFixed(2)}`);
  return { ok: failures.length === 0, refs, failures, words, maxSimilarity };
}

// --- the deterministic, personalised composer ---------------------------------

/** "The Storyteller" → "the Storyteller" mid-sentence; never "your The …". */
export function midSentence(label: string): string {
  return label.replace(/^The\s+/, "the ");
}

/** Least-recently-touched first, so successive invitations rotate through the altar. */
export function rotate(items: PacketItem[], recentRefs: string[][], kinds?: PacketItem["kind"][]): PacketItem[] {
  const pool = kinds ? items.filter((i) => kinds.includes(i.kind)) : items;
  const lastSeen = (ref: string) => {
    const idx = recentRefs.findIndex((r) => r.includes(ref)); // 0 = most recent
    return idx === -1 ? Infinity : idx;
  };
  // Ties (never seen / seen equally long ago) break by the caller's kind priority.
  const prio = (k: PacketItem["kind"]) => (kinds ? kinds.indexOf(k) : 0);
  return [...pool].sort((a, b) => lastSeen(b.ref) - lastSeen(a.ref) || prio(a.kind) - prio(b.kind) || a.ref.localeCompare(b.ref));
}

const OPENERS: Record<Cadence, string[]> = {
  weekly: ["A small turning for this week", "For the week ahead", "This week's thread"],
  lunar: ["With the moon turning", "By this moon's light"],
  monthly: ["As the month closes", "Looking back across the month"],
  quarterly: ["At the turn of the season's quarter", "Three months of your becoming"],
  seasonal: ["At this threshold of the year", "The year turns"],
  solar_return: ["The Sun has come back to where you began", "Another ring on the tree"],
  spontaneous: ["A small invitation"],
};

const QUESTIONS: Record<1 | 2 | 3, string[]> = {
  1: [
    "Where did it come most alive — and where did you override it?",
    "What is one small act this week that only you would think to do?",
    "When did your work feel like your prayer in motion?",
  ],
  2: [
    "Is the way you're doing this still the right way — or just the familiar one?",
    "What are you measuring that no longer tells you the truth?",
    "Which path would you not choose again, knowing what you know now?",
  ],
  3: [
    "Is this still the prayer? What would you change if no one were watching?",
    "Which belief underneath it all is ready to be composted?",
    "Who have you become since you last asked what your life is for?",
  ],
};

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * A personalised invitation that satisfies the contract BY CONSTRUCTION: it names
 * two distinct packet items (rotated), each through its own anchor, plus a
 * depth-appropriate question. Used when Claude is off or fails the contract.
 */
export function composeDeterministic(packet: Packet): { body: string; refs: string[] } {
  // Search candidate (first, second, question, opener) combinations in rotation
  // order and return the first that passes the full contract — so even a small
  // altar never repeats itself. Falls back to the least-similar candidate.
  const primaryKinds: PacketItem["kind"][] = packet.depth === 3 ? ["prayer", "root", "devotion", "gift"] : packet.depth === 2 ? ["measure", "practice", "work", "gift"] : ["work", "gift", "trimtab", "practice"];
  const firsts = [...rotate(packet.items, packet.recentRefs, primaryKinds), ...rotate(packet.items, packet.recentRefs)]
    .filter((x, i, a) => a.findIndex((y) => y.ref === x.ref) === i).slice(0, 4);
  let best: { body: string; refs: string[]; sim: number } | null = null;
  const base = hash(packet.recentBodies.length + ":" + packet.items.map((i) => i.ref).join(","));
  for (let qi = 0; qi < 3; qi++) {
    for (const first of firsts) {
      const seconds = [
        ...rotate(packet.items.filter((i) => i.ref !== first.ref && i.kind !== first.kind), packet.recentRefs),
        ...rotate(packet.items.filter((i) => i.ref !== first.ref), packet.recentRefs),
      ].filter((x, i, a) => a.findIndex((y) => y.ref === x.ref) === i).slice(0, 3);
      for (const second of seconds.length ? seconds : [undefined]) {
        const cand = composeOne(packet, first, second, base + qi * 7);
        const c = checkContract(cand.body, packet);
        if (c.ok) return cand;
        if (!best || c.maxSimilarity < best.sim) best = { ...cand, sim: c.maxSimilarity };
      }
    }
  }
  return best ? { body: best.body, refs: best.refs } : composeOne(packet, packet.items[0], packet.items[1], base);
}

/** The first whole sentence of a detail, if it is short enough to quote cleanly. */
export function firstSentence(s?: string): string | undefined {
  if (!s) return undefined;
  const m = s.trim().match(/^[^.!?…]{12,170}[.!?]/);
  return m ? m[0] : undefined;
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function composeOne(packet: Packet, first: PacketItem | undefined, second: PacketItem | undefined, seed: number): { body: string; refs: string[] } {

  const opener = pick(OPENERS[packet.cadence], seed) + (packet.thresholdLabel ? ` — ${packet.thresholdLabel}` : "") + (packet.firstName ? `, ${packet.firstName}` : "") + ".";
  const line = (it: PacketItem | undefined, lead: boolean): string => {
    if (!it) return "";
    const L = midSentence(it.label);
    switch (it.kind) {
      case "gift": {
        const d = firstSentence(it.detail);
        return lead ? `Notice where ${L} in you came alive this week.${d ? ` ${d}` : ""}` : `Let ${L} in you lead the way.`;
      }
      case "work": return lead ? `Hold ${it.label} up to the light: is it serving what you most care about?` : `Bring it into ${it.label}.`;
      case "practice": return `Return to ${it.label}${lead ? " — not as a duty, as a homecoming" : ""}.`;
      case "prayer": return `Your prayer: “${it.label}”. Read it slowly, as if for the first time.`;
      case "root": return `Look at a belief you stand on — “${it.label}” — and ask whether it still holds you.`;
      case "measure": return `Check your sign of alignment: ${it.label}.`;
      case "inquiry": return `Keep living the question: ${it.label}`;
      case "devotion": return `Remember who this is for: ${it.label}.`;
      case "capacity": return `Your becoming: ${it.label}. What one step grew it this week?`;
      case "hd": return `${it.detail || `Trust your ${it.label}.`}`;
      case "trimtab": return lead ? `One small lever: ${it.detail || it.label}` : `A small lever, if it calls you: ${it.detail || it.label}`;
      case "astro":
      case "gk": return it.detail || `Let ${L} lead.`;
      case "ikigai": return `You once said you love ${it.label} — where did that show up?`;
      default: return `${it.label}${it.detail ? ` — ${it.detail}` : ""}.`;
    }
  };
  const q = pick(QUESTIONS[packet.depth], seed >> 3);
  const body = [opener, line(first, true), line(second, false), q, "Reply to this and your words become part of your journal."]
    .filter(Boolean)
    .map(cap)
    .join("\n\n")
    .replace(/\.\./g, ".");
  const refs = [first?.ref, second?.ref].filter(Boolean) as string[];
  return { body, refs };
}

// --- the HD embodiment lines (public structure, original language) ------------

export const STRATEGY: Record<string, string> = {
  Generator: "As a Generator, let something arrive first — then follow the yes in your body, not the should in your head.",
  "Manifesting Generator": "As a Manifesting Generator, respond first, then tell the people your speed will touch before you leap.",
  Manifestor: "As a Manifestor, inform the people your move will touch — then move; your initiating is the gift.",
  Projector: "As a Projector, notice where you were genuinely invited — and where you spent yourself uninvited.",
  Reflector: "As a Reflector, give the big decision a full moon's turning; let the month speak.",
};

export const AUTHORITY_LINE: Record<string, string> = {
  Emotional: "Decide nothing in the wave — let clarity arrive over time.",
  Sacral: "Listen for the gut's uh-huh or un-uh before the mind's reasons.",
  Splenic: "Trust the quiet in-the-moment knowing; it speaks once.",
  Ego: "Ask what you truly want and are willing to commit to — your heart's will is your authority.",
  "Self-Projected": "Talk it through out loud and listen for what your own voice says is true.",
  Mental: "Talk it through with people you trust, in places that feel right — and listen.",
  Lunar: "Let the moon's full cycle carry the decision.",
};
