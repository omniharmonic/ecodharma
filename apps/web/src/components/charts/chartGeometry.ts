// Dependency-free geometry + glyph constants shared by the v3 chart components.
// Astro glyph maps live here so NatalWheel (and any future zodiac viz) can swap
// between 3-letter abbreviations (default — reliable in IBM Plex Mono) and the
// true Unicode glyphs. Pure data; no React, no DOM.

// ---- zodiac (Aries-first, 30° each) ----
export const SIGN_ABBR = [
  "Ari",
  "Tau",
  "Gem",
  "Can",
  "Leo",
  "Vir",
  "Lib",
  "Sco",
  "Sag",
  "Cap",
  "Aqr",
  "Psc",
] as const;

export const SIGN_GLYPH = [
  "♈", // Aries
  "♉", // Taurus
  "♊", // Gemini
  "♋", // Cancer
  "♌", // Leo
  "♍", // Virgo
  "♎", // Libra
  "♏", // Scorpio
  "♐", // Sagittarius
  "♑", // Capricorn
  "♒", // Aquarius
  "♓", // Pisces
] as const;

export const SIGN_INDEX: Record<string, number> = {
  Aries: 0,
  Taurus: 1,
  Gemini: 2,
  Cancer: 3,
  Leo: 4,
  Virgo: 5,
  Libra: 6,
  Scorpio: 7,
  Sagittarius: 8,
  Capricorn: 9,
  Aquarius: 10,
  Pisces: 11,
};

// ---- bodies ----
export const PLANET_ABBR: Record<string, string> = {
  Sun: "Sun",
  Moon: "Moo",
  Mercury: "Mer",
  Venus: "Ven",
  Mars: "Mar",
  Jupiter: "Jup",
  Saturn: "Sat",
  Uranus: "Ura",
  Neptune: "Nep",
  Pluto: "Plu",
  North_Node: "NN",
  South_Node: "SN",
};

export const PLANET_GLYPH: Record<string, string> = {
  Sun: "☉",
  Moon: "☽",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄",
  Uranus: "♅",
  Neptune: "♆",
  Pluto: "♇",
  North_Node: "☊",
  South_Node: "☋",
};

// ---- aspect style table (token / stroke-width / dash) ----
export interface AspectStyle {
  token: string;
  width: number;
  dash?: string;
}
export const ASPECT_STYLE: Record<string, AspectStyle> = {
  conjunction: { token: "--accent", width: 1.4 },
  sextile: { token: "--link", width: 1, dash: "4 3" },
  square: { token: "--flag", width: 1.4 },
  trine: { token: "--live", width: 1.4 },
  opposition: { token: "--flag", width: 1.2 },
};

// ---- NatalWheel radii (fixed 400×400 viewBox, center 200,200) ----
export const WHEEL = {
  cx: 200,
  cy: 200,
  signOuter: 195,
  signInner: 165,
  signGlyph: 180,
  cuspInner: 96,
  cuspOuter: 165,
  planet: 140,
  planetTier: 14,
  maxTier: 2,
  houseNum: 116,
  hub: 96,
  callout: 205,
} as const;

export const clamp = (min: number, max: number, v: number): number =>
  Math.min(max, Math.max(min, v));
