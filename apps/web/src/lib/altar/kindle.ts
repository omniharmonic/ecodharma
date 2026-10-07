// Kindling — the first lighting of the altar, seeded from the reading.
// The person writes their Prayer themselves; we offer QUESTIONS for that, and
// suggestions (never auto-created) for Devotions, Practices, and Measures drawn
// from their gifts, Ikigai, world-work domains, and Human Design.
// Pure (no server-only).

import type { Framework, GiftProfile, Ikigai } from "../types";
import type { ConstitutionRef } from "./model";

export type Suggestion = { kind: "devotion" | "practice" | "measure" | "root" | "work"; title: string; why: string; constitution_refs?: ConstitutionRef[] };

export type Kindling = {
  prayerPrompts: string[];
  suggestions: Suggestion[];
};

const STRATEGY_PRACTICE: Record<string, { title: string; why: string }> = {
  Generator: { title: "Wait to respond — let life ask first", why: "Your design: energy that answers rather than initiates." },
  "Manifesting Generator": { title: "Respond, then inform before I leap", why: "Your design: fast, multi-passionate energy that works best answering, then telling." },
  Manifestor: { title: "Inform the people my moves will touch", why: "Your design: an initiator whose path clears when others know what's coming." },
  Projector: { title: "Wait for the invitation; rest without guilt", why: "Your design: a guide whose wisdom lands when it's asked for." },
  Reflector: { title: "Give big decisions a full lunar cycle", why: "Your design: a mirror of the community, clarified over a month." },
};

const AUTHORITY_MEASURE: Record<string, string> = {
  Emotional: "I decided from clarity, not in the wave",
  Sacral: "I followed my gut's yes and honored its no",
  Splenic: "I trusted the quiet in-the-moment knowing",
  Ego: "I committed only to what my heart truly wanted",
  "Self-Projected": "I listened to what my own voice said was true",
  Mental: "I talked it through with trusted people before deciding",
  Lunar: "I let the moon's cycle carry the big decision",
};

export function kindle(reading: GiftProfile | null, charts: Record<string, any>, ikigai: Ikigai, fw: Framework): Kindling {
  const giftName = (id: string) => fw.gifts.find((g) => g.id === id)?.name || id;
  const domainName = (id: string) => fw.domains.find((d) => d.id === id)?.name || id;
  const lead = reading?.gift_constellation?.[0];
  const leadName = lead ? giftName(lead.gift_id).replace(/^The\s+/, "the ") : null;

  const prayerPrompts = [
    "If your life were a prayer offered to the world, what would it ask for?",
    ikigai.love ? `You said you come alive through “${ikigai.love.trim().replace(/[.?!]+$/, "")}.” Who or what is that aliveness ultimately for?` : "What makes you most alive — and who is that aliveness for?",
    leadName ? `Your reading names ${leadName} as alive in you. What does ${leadName} in you long to serve?` : "What do you long to serve that is larger than you?",
    "Finish the sentence without editing: “May my life…”",
  ];

  const suggestions: Suggestion[] = [];
  // Devotions from the domains the reading paired them with.
  const seenDomains = new Set<string>();
  for (const d of reading?.domains || []) {
    if (seenDomains.has(d.domain_id) || seenDomains.size >= 3) continue;
    seenDomains.add(d.domain_id);
    suggestions.push({ kind: "devotion", title: domainName(d.domain_id), why: d.why || "A world-work your reading says you're built for." });
  }
  // Practices from Human Design strategy.
  const hd = charts.human_design;
  if (hd?.type && STRATEGY_PRACTICE[hd.type]) {
    suggestions.push({ kind: "practice", ...STRATEGY_PRACTICE[hd.type], constitution_refs: [{ lens: "hd", ref: `type:${hd.type}`, label: hd.type }] });
  }
  // Measures: the Constitution lens made concrete from authority.
  if (hd?.authority && AUTHORITY_MEASURE[hd.authority]) {
    suggestions.push({ kind: "measure", title: AUTHORITY_MEASURE[hd.authority], why: `Constitution: your ${hd.authority} authority as a sign of alignment.`, constitution_refs: [{ lens: "hd", ref: `authority:${hd.authority}`, label: `${hd.authority} authority` }] });
  }
  suggestions.push({ kind: "measure", title: "I end the week with more life than I started", why: "Aliveness — the simplest sign." });
  // Works from the gift × domain pairings (the trim-tabs), phrased as candidate paths.
  for (const t of (reading?.trim_tabs || []).slice(0, 2)) {
    if (!t.action) continue;
    suggestions.push({ kind: "work", title: t.action.length > 90 ? `${t.action.slice(0, 87)}…` : t.action, why: `A small lever in ${domainName(t.domain_id)} your reading surfaced.` });
  }
  // A seed root to examine (they can discard it).
  if (lead) {
    suggestions.push({
      kind: "root",
      title: `My ${giftName(lead.gift_id).replace(/^The\s+/, "")} nature is needed, not just tolerated`,
      why: "A belief worth holding consciously — or questioning.",
      constitution_refs: [{ lens: "gift", ref: lead.gift_id, label: giftName(lead.gift_id) }],
    });
  }
  return { prayerPrompts, suggestions };
}
