// Plain-meaning vocabulary for the deterministic (fixture) interpreter, so it can
// write real per-placement meaning instead of filler. Mythopoetic, not predictive —
// "mirrors for reflection." Our own words; no proprietary Gene Keys / Human Design
// descriptive text (only computed positions + these plain glosses).

export const SIGN_MEANING: Record<string, string> = {
  Aries: "a starter's fire — you move first and open the way",
  Taurus: "steady, embodied persistence and a feel for what lasts",
  Gemini: "quick links between people, ideas, and words",
  Cancer: "protective care and a strong sense of home and belonging",
  Leo: "warm, visible heart that wants to give generously",
  Virgo: "patient craft, discernment, and care for the details that matter",
  Libra: "a pull toward fairness, pairing, and keeping the peace",
  Scorpio: "depth, honesty about hard things, and the will to transform",
  Sagittarius: "meaning-seeking, wide horizons, and the teacher's reach",
  Capricorn: "long patience, structure, and responsibility for the whole",
  Aquarius: "future-facing, systems-minded care for the collective",
  Pisces: "porous empathy and a channel to the more-than-human",
};

// Whole-sign / Placidus house → life arena (kept plain and warm).
export const HOUSE_MEANING: Record<number, string> = {
  1: "how you show up and meet a room",
  2: "what you value and how you resource yourself",
  3: "your voice, learning, and immediate community",
  4: "home, roots, and the ground you stand on",
  5: "creativity, play, and what you love to make",
  6: "daily work, service, and tending the body of things",
  7: "partnership and the people you meet as equals",
  8: "depth, shared resources, and honest transformation",
  9: "meaning, travel, teaching, and the long view",
  10: "your public work and the role you carry for others",
  11: "networks, movements, and the future you build with others",
  12: "the unseen, rest, and what moves beneath the surface",
};

export const PLANET_MEANING: Record<string, string> = {
  Sun: "your core purpose and what you're here to shine",
  Moon: "your inner weather and what makes you feel safe",
  Mercury: "how you think, learn, and connect",
  Venus: "what you love and how you make harmony",
  Mars: "how you act, assert, and get things done",
  Jupiter: "where you grow, teach, and find meaning",
  Saturn: "where you take responsibility and build for the long term",
  Uranus: "where you break pattern and bring the new",
  Neptune: "where you dissolve boundaries and sense the whole",
  Pluto: "where you transform, compost, and regenerate power",
  North_Node: "the growth edge you're leaning toward",
  South_Node: "the gifts you already carry from behind you",
};

export const ASPECT_MEANING: Record<string, string> = {
  conjunction: "fused and amplified together",
  sextile: "an easy, available cooperation",
  trine: "a natural, flowing gift",
  square: "a productive friction that asks for work",
  opposition: "a tension to balance between two poles",
};

export const HD_TYPE_MEANING: Record<string, string> = {
  Generator: "built to respond — your energy sustains work you truly say yes to",
  "Manifesting Generator": "a fast, multi-track responder who skips steps and covers ground",
  Manifestor: "an initiator — you start things and free others to follow",
  Projector: "a guide and seer of systems, potent when recognized and invited",
  Reflector: "a mirror of your community's health, sampling the whole",
};

export const HD_AUTHORITY_MEANING: Record<string, string> = {
  Emotional: "clarity comes over time — sleep on it, ride the wave before deciding",
  Sacral: "a gut yes/no in the moment is your truest guide",
  Splenic: "a quiet in-the-instant knowing you can trust",
  Ego: "decide from what you truly have the will and want for",
  "Self-Projected": "you hear your truth by talking it out loud",
  Mental: "you clarify by sounding things out with trusted others, over time",
  Lunar: "wait a full cycle; clarity arrives after living with it",
};

export const HD_CENTER_MEANING: Record<string, string> = {
  Head: "inspiration and the questions that pull you",
  Ajna: "how you make sense of things and hold ideas",
  Throat: "how you voice, manifest, and bring things into form",
  G: "identity, direction, and love — the self others orient around",
  Heart: "willpower, worth, and what you can promise",
  Sacral: "life-force, work, and sustainable yes",
  SolarPlexus: "emotional depth, moods, and social warmth",
  Spleen: "instinct, health, and in-the-moment survival sense",
  Root: "drive, pressure, and the fuel to begin",
};

// Gene Keys spheres → the life-area each names (our plain gloss, not GK text).
export const GK_SPHERE_MEANING: Record<string, string> = {
  lifes_work: "the work you're here to do in plain view",
  evolution: "the challenge that grows you",
  radiance: "what keeps you well and shining",
  purpose: "the deep purpose beneath the work",
  attraction: "how you draw close what's yours to love",
  iq: "how your mind serves",
  eq: "how your heart serves",
  sq: "how your spirit serves",
  vocation: "the direction of your calling",
  culture: "what you build with and for others",
  brand: "how your gift is known in the world",
};

export const GK_SPHERE_LABEL: Record<string, string> = {
  lifes_work: "Life's Work",
  evolution: "Evolution",
  radiance: "Radiance",
  purpose: "Purpose",
  attraction: "Attraction",
  iq: "IQ",
  eq: "EQ",
  sq: "SQ",
  vocation: "Vocation",
  culture: "Culture",
  brand: "Brand",
};

// House number from an ecliptic longitude given the 12 Placidus cusps (wrap-aware).
export function houseOf(lon: number, cusps: number[] | undefined): number | null {
  if (!cusps || cusps.length !== 12) return null;
  const norm = (x: number) => ((x % 360) + 360) % 360;
  const p = norm(lon);
  for (let i = 0; i < 12; i++) {
    const a = norm(cusps[i]);
    const b = norm(cusps[(i + 1) % 12]);
    const span = norm(b - a);
    if (norm(p - a) < span) return i + 1;
  }
  return null;
}
