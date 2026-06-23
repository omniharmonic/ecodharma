// Human Design RELATIONAL mechanics — connection (dyad) + penta (group).
//
// This is a structural substrate that sits UNDERNEATH the EcoDharma gift
// framework: it computes the energetic mechanics of how two or more bodygraphs
// meet (electromagnetics, conditioning, composite type, group roles), so the
// gift-level read can point at *why* a constellation hums or grinds. It does
// not interpret anyone's gifts — that stays with the framework.
//
// The algorithms are ported from natalengine by `unforced` (MIT-licensed):
//   src/calculators/compatibility/humandesign.js  (compareHumanDesign)
//   src/calculators/penta.js                       (analyzePenta)
// adapted to operate on our own HD chart shape (capitalized centre names,
// `channels: {gates,centers}`, `gates: {personality, design}`) and on a
// compact, shareable HD *signature* rather than a full chart — so the relational
// layer can be computed from a CONSENTED gift profile without ever touching
// another person's raw, owner-only chart.

// ---------------------------------------------------------------------------
// Reference data (canonical Human Design — gate wheel + 36 channels + 9 centres)
// ---------------------------------------------------------------------------

export type CenterName =
  | "Head" | "Ajna" | "Throat" | "G" | "Heart"
  | "Sacral" | "SolarPlexus" | "Spleen" | "Root";

export const ALL_CENTERS: CenterName[] = [
  "Head", "Ajna", "Throat", "G", "Heart", "Sacral", "SolarPlexus", "Spleen", "Root",
];

const MOTORS: ReadonlySet<CenterName> = new Set(["Sacral", "Heart", "SolarPlexus", "Root"]);

// Map natalengine's lowercase centre keys to ours.
const C: Record<string, CenterName> = {
  head: "Head", ajna: "Ajna", throat: "Throat", g: "G", heart: "Heart",
  sacral: "Sacral", solar: "SolarPlexus", spleen: "Spleen", root: "Root",
};

export const CENTER_LABEL: Record<CenterName, string> = {
  Head: "Head", Ajna: "Ajna", Throat: "Throat", G: "G Center", Heart: "Heart / Ego",
  Sacral: "Sacral", SolarPlexus: "Solar Plexus", Spleen: "Spleen", Root: "Root",
};

export type ChannelMeta = {
  gates: [number, number];
  name: string;
  centers: [CenterName, CenterName];
  theme: string;
  circuit: "individual" | "tribal" | "collective" | "integration";
};

// The 36 channels (gate pair → name / centres / theme / circuit).
const RAW_CHANNELS: [number, number, string, string, string, ChannelMeta["circuit"]][] = [
  [1, 8, "Inspiration", "g/throat", "Creative role model", "individual"],
  [2, 14, "The Beat", "g/sacral", "Keeper of keys", "individual"],
  [3, 60, "Mutation", "sacral/root", "Energy for mutation", "individual"],
  [4, 63, "Logic", "ajna/head", "Mental ease in doubt", "collective"],
  [5, 15, "Rhythm", "sacral/g", "Being in flow", "collective"],
  [6, 59, "Intimacy", "solar/sacral", "Focused on reproduction", "tribal"],
  [7, 31, "Alpha", "g/throat", "Leadership", "collective"],
  [9, 52, "Concentration", "sacral/root", "Focused determination", "collective"],
  [10, 20, "Awakening", "g/throat", "Commitment to self", "integration"],
  [10, 34, "Exploration", "g/sacral", "Following convictions", "integration"],
  [10, 57, "Perfected Form", "g/spleen", "Survival", "integration"],
  [11, 56, "Curiosity", "ajna/throat", "A searcher", "collective"],
  [12, 22, "Openness", "throat/solar", "Social being", "individual"],
  [13, 33, "The Prodigal", "g/throat", "A witness", "collective"],
  [16, 48, "The Wavelength", "throat/spleen", "Talent", "collective"],
  [17, 62, "Acceptance", "ajna/throat", "An organizational being", "collective"],
  [18, 58, "Judgement", "spleen/root", "Insatiability", "collective"],
  [19, 49, "Synthesis", "root/solar", "Sensitivity", "tribal"],
  [20, 34, "Charisma", "throat/sacral", "Busy-ness", "integration"],
  [20, 57, "The Brainwave", "throat/spleen", "Penetrating awareness", "integration"],
  [21, 45, "Money", "heart/throat", "A materialist", "tribal"],
  [23, 43, "Structuring", "throat/ajna", "Individuality", "individual"],
  [24, 61, "Awareness", "ajna/head", "A thinker", "individual"],
  [25, 51, "Initiation", "g/heart", "Needing to be first", "individual"],
  [26, 44, "Surrender", "heart/spleen", "A transmitter", "tribal"],
  [27, 50, "Preservation", "sacral/spleen", "Custodianship", "tribal"],
  [28, 38, "Struggle", "spleen/root", "Stubbornness", "individual"],
  [29, 46, "Discovery", "sacral/g", "Succeeding where others fail", "collective"],
  [30, 41, "Recognition", "solar/root", "Focused energy", "collective"],
  [32, 54, "Transformation", "spleen/root", "Being driven", "tribal"],
  [34, 57, "Power", "sacral/spleen", "An archetype", "integration"],
  [35, 36, "Transitoriness", "throat/solar", "A jack of all trades", "collective"],
  [37, 40, "Community", "solar/heart", "Part of a bargain", "tribal"],
  [39, 55, "Emoting", "root/solar", "Moodiness", "individual"],
  [42, 53, "Maturation", "sacral/root", "Balanced development", "collective"],
  [47, 64, "Abstraction", "ajna/head", "Mental activity / clarity", "collective"],
];

function channelKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export const CHANNELS: ChannelMeta[] = RAW_CHANNELS.map(([a, b, name, centers, theme, circuit]) => {
  const [c1, c2] = centers.split("/");
  return { gates: [a, b], name, centers: [C[c1], C[c2]], theme, circuit };
});

const CHANNEL_BY_KEY: Map<string, ChannelMeta> = new Map(
  CHANNELS.map((ch) => [channelKey(ch.gates[0], ch.gates[1]), ch]),
);

// ---------------------------------------------------------------------------
// The shareable signature — structure only (no birth data, no raw positions).
// Travels inside the gift profile, so it inherits the profile's consent grant.
// ---------------------------------------------------------------------------

export type HdSignature = {
  type: string; // "Generator" | "Manifesting Generator" | "Projector" | "Manifestor" | "Reflector"
  profile: string; // "1/3"
  authority: string; // "Emotional" | "Sacral" | "Splenic" | "Ego" | "Self-Projected" | "Lunar" | "Mental"
  defined_centers: CenterName[];
  gates: number[]; // all active gate numbers (personality ∪ design)
};

// Extract the signature from our stored human_design chart (charts["human_design"]).
export function extractHdSignature(hd: unknown): HdSignature | null {
  if (!hd || typeof hd !== "object") return null;
  const c = hd as Record<string, any>;
  if (!c.type || !c.gates) return null;
  const gateSet = new Set<number>();
  for (const phase of ["personality", "design"] as const) {
    const acts = c.gates?.[phase];
    if (acts && typeof acts === "object") {
      for (const body of Object.keys(acts)) {
        const g = acts[body]?.gate;
        if (typeof g === "number") gateSet.add(g);
      }
    }
  }
  return {
    type: String(c.type),
    profile: String(c.profile ?? ""),
    authority: String(c.authority ?? ""),
    defined_centers: (Array.isArray(c.defined_centers) ? c.defined_centers : []) as CenterName[],
    gates: [...gateSet].sort((a, b) => a - b),
  };
}

// ---------------------------------------------------------------------------
// Graph helpers (motor→throat connectivity → composite/group type)
// ---------------------------------------------------------------------------

function channelsFromGates(gates: Set<number>): ChannelMeta[] {
  return CHANNELS.filter((ch) => gates.has(ch.gates[0]) && gates.has(ch.gates[1]));
}

function definedFromChannels(channels: ChannelMeta[]): Set<CenterName> {
  const s = new Set<CenterName>();
  for (const ch of channels) ch.centers.forEach((c) => s.add(c));
  return s;
}

function motorToThroat(channels: ChannelMeta[]): boolean {
  const adj = new Map<CenterName, Set<CenterName>>();
  for (const ch of channels) {
    const [a, b] = ch.centers;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  }
  if (!adj.has("Throat")) return false;
  const seen = new Set<CenterName>(["Throat"]);
  const queue: CenterName[] = ["Throat"];
  while (queue.length) {
    const cur = queue.shift()!;
    if (MOTORS.has(cur)) return true;
    for (const n of adj.get(cur) || []) {
      if (!seen.has(n)) { seen.add(n); queue.push(n); }
    }
  }
  return false;
}

function typeFromCenters(definedFromCh: Set<CenterName>, channels: ChannelMeta[]): string {
  const hasSacral = definedFromCh.has("Sacral");
  const m2t = motorToThroat(channels);
  if (!hasSacral && m2t) return "Manifestor";
  if (hasSacral && m2t) return "Manifesting Generator";
  if (hasSacral) return "Generator";
  if (definedFromCh.size === 0) return "Reflector";
  return "Projector";
}

// ---------------------------------------------------------------------------
// DYAD: compareHumanDesign
// ---------------------------------------------------------------------------

const TYPE_ORDER = ["generator", "manifestingGenerator", "projector", "manifestor", "reflector"];

function normalizeType(t: string): string {
  const s = t.toLowerCase();
  if (s.includes("manifesting") && s.includes("generator")) return "manifestingGenerator";
  if (s.includes("generator")) return "generator";
  if (s.includes("projector")) return "projector";
  if (s.includes("manifestor")) return "manifestor";
  if (s.includes("reflector")) return "reflector";
  return s;
}

const TYPE_DYNAMICS: Record<string, { dynamic: string; gifts: string; challenges: string; tips: string }> = {
  "generator-generator": { dynamic: "Powerful work partnership", gifts: "Sustainable energy, mutual response, deep satisfaction potential", challenges: "May get stuck in routines, need external stimulation", tips: "Take turns surfacing things to respond to" },
  "generator-manifestingGenerator": { dynamic: "High-energy partnership", gifts: "Combined stamina and speed, complementary work styles", challenges: "MG may move too fast for the Generator", tips: "MG informs before changing direction" },
  "generator-projector": { dynamic: "Classic guidance relationship", gifts: "Projector sees and guides the Generator's energy; mutual recognition", challenges: "Projector may feel overlooked, Generator may feel managed", tips: "Generator invites the Projector's guidance; Projector waits for the invitation" },
  "generator-manifestor": { dynamic: "Initiator–sustainer dynamic", gifts: "Manifestor sparks; Generator builds and sustains", challenges: "Manifestor may feel slowed, Generator may feel pushed", tips: "Manifestor informs; Generator responds authentically" },
  "generator-reflector": { dynamic: "Energy source meets mirror", gifts: "Reflector samples the Generator's healthy energy and reflects wisdom", challenges: "Reflector needs space from constant energy", tips: "Reflector gives feedback after a lunar cycle of observation" },
  "manifestingGenerator-manifestingGenerator": { dynamic: "Multi-passionate duo", gifts: "Fast-paced, adaptable, exciting work together", challenges: "May skip steps together; scattered energy", tips: "Build in response time before major decisions" },
  "manifestingGenerator-projector": { dynamic: "Speed meets depth", gifts: "Projector helps the MG focus energy efficiently", challenges: "MG may overwhelm; Projector may slow the MG", tips: "MG invites guidance; Projector rests and observes" },
  "manifestingGenerator-manifestor": { dynamic: "Dual initiator energy", gifts: "Both can make things happen quickly", challenges: "Power struggles; competing for initiative", tips: "Define domains; inform each other before acting" },
  "manifestingGenerator-reflector": { dynamic: "Fast meets reflective", gifts: "MG brings action; Reflector brings perspective", challenges: "Very different rhythms; Reflector needs time", tips: "MG slows down; Reflector gets full lunar cycles" },
  "projector-projector": { dynamic: "Mutual recognition", gifts: "Deep seeing of each other; efficient together", challenges: "Both need outside energy; may over-guide each other", tips: "Take turns being guided; rest together" },
  "projector-manifestor": { dynamic: "Guide meets initiator", gifts: "Projector sees the Manifestor's impact clearly", challenges: "Manifestor may not wait for guidance; Projector may feel bypassed", tips: "Manifestor invites the Projector's input before initiating" },
  "projector-reflector": { dynamic: "Seer meets mirror", gifts: "Deep wisdom together; non-energy types understand each other", challenges: "Neither has sustained energy; need outside sources", tips: "Work in bursts; honor rest needs" },
  "manifestor-manifestor": { dynamic: "Double initiator", gifts: "Major creative power; can catalyze big changes", challenges: "Power struggles; both want to lead", tips: "Define separate domains; inform thoroughly" },
  "manifestor-reflector": { dynamic: "Impact meets reflection", gifts: "Reflector mirrors the Manifestor's true impact", challenges: "Manifestor may overwhelm; Reflector needs processing time", tips: "Manifestor informs; Reflector gives lunar-cycle feedback" },
  "reflector-reflector": { dynamic: "Rare mirror connection", gifts: "Deep understanding of each other's openness", challenges: "Both highly sensitive to environment; may amplify issues", tips: "Create a nurturing environment together; honor lunar rhythms" },
};

export type Connection = {
  channel: string;
  gates: [number, number];
  centers: [CenterName, CenterName];
  theme: string;
  circuit: ChannelMeta["circuit"];
  kind: "electromagnetic" | "companionship" | "compromise" | "dominance";
  gateA?: number;
  gateB?: number;
  dominant?: "A" | "B";
  partialGate?: number;
  description: string;
};

export type CenterConditioning = {
  center: CenterName;
  label: string;
  dynamic: "Both defined" | "Both open" | "A conditions B" | "B conditions A";
  description: string;
};

export type CompareResult = {
  nameA: string;
  nameB: string;
  typeInteraction: { typeA: string; typeB: string; dynamic: string; gifts: string; challenges: string; tips: string };
  authorityDynamic: { authorityA: string; authorityB: string; timing: string; description: string };
  profileHarmony: { profileA: string; profileB: string; harmony: number; description: string };
  connections: Record<Connection["kind"], Connection[]>;
  centerConditioning: CenterConditioning[];
  bridgedChannels: { channel: string; theme: string }[];
  compositeType: string;
  stats: {
    electromagnetic: number;
    companionship: number;
    compromise: number;
    dominance: number;
    conditioningCenters: number;
  };
  summary: string;
};

function authorityLabel(a: string): string {
  // our chart stores "Emotional" / "Sacral" / "Splenic" / "Ego" / "Self-Projected" / "Lunar" / "Mental"
  const map: Record<string, string> = {
    Emotional: "Emotional Authority", Sacral: "Sacral Authority", Splenic: "Splenic Authority",
    Ego: "Ego / Heart Authority", "Self-Projected": "Self-Projected Authority",
    Lunar: "Lunar Authority", Mental: "Mental / Environmental",
  };
  return map[a] || a || "Authority";
}

function profileHarmony(profileA: string, profileB: string) {
  const [l1a] = profileA.split("/").map(Number);
  const [l1b] = profileB.split("/").map(Number);
  let harmony = 0.6;
  let description = `${profileA} and ${profileB} bring different gifts — an opportunity for growth.`;
  if (profileA === profileB) {
    harmony = 0.75;
    description = `Both ${profileA} — deep mutual recognition, but you share the same challenges.`;
  } else if (l1a === l1b) {
    harmony = 0.7;
    description = `Both lead with Line ${l1a} energy — a natural read on each other's approach.`;
  } else if (
    (l1a === 1 && l1b === 4) || (l1a === 4 && l1b === 1) ||
    (l1a === 2 && l1b === 5) || (l1a === 5 && l1b === 2) ||
    (l1a === 3 && l1b === 6) || (l1a === 6 && l1b === 3)
  ) {
    harmony = 0.8;
    description = `Lines ${l1a} and ${l1b} are complementary — an attractive polarity.`;
  }
  return { profileA, profileB, harmony, description };
}

export function compareHumanDesign(
  a: HdSignature,
  b: HdSignature,
  nameA = "A",
  nameB = "B",
): CompareResult {
  const gatesA = new Set(a.gates);
  const gatesB = new Set(b.gates);

  const tKey = (() => {
    const t1 = normalizeType(a.type);
    const t2 = normalizeType(b.type);
    return TYPE_ORDER.indexOf(t1) <= TYPE_ORDER.indexOf(t2) ? `${t1}-${t2}` : `${t2}-${t1}`;
  })();
  const dyn = TYPE_DYNAMICS[tKey] || {
    dynamic: "A unique combination", gifts: "Room for growth and understanding",
    challenges: "Different operating styles", tips: "Honor each other's strategy",
  };

  // Authority timing
  const authA = authorityLabel(a.authority);
  const authB = authorityLabel(b.authority);
  let timing = "Standard";
  let aDesc = `Different decision styles: ${authA} meets ${authB}. Honor both processes.`;
  if (a.authority === "Emotional" || b.authority === "Emotional") {
    timing = "Extended"; aDesc = "One or both ride an emotional wave — give decisions time to settle into clarity.";
  } else if (a.authority === "Lunar" || b.authority === "Lunar") {
    timing = "Lunar cycle"; aDesc = "Major decisions benefit from a 28-day observation period.";
  } else if (a.authority === b.authority) {
    timing = "Aligned"; aDesc = `Both use ${authA} — a shared, intuitive read on how to decide.`;
  }

  // Four connection types over every channel.
  const connections: CompareResult["connections"] = {
    electromagnetic: [], companionship: [], compromise: [], dominance: [],
  };
  for (const ch of CHANNELS) {
    const [g1, g2] = ch.gates;
    const a1 = gatesA.has(g1), a2 = gatesA.has(g2);
    const b1 = gatesB.has(g1), b2 = gatesB.has(g2);
    const aHas = a1 && a2;
    const bHas = b1 && b2;
    const base = { channel: ch.name, gates: ch.gates, centers: ch.centers, theme: ch.theme, circuit: ch.circuit };
    if (aHas && bHas) {
      connections.companionship.push({ ...base, kind: "companionship", description: `You both fully carry the ${ch.name} channel — easy, shared common ground here.` });
    } else if (aHas && !b1 && !b2) {
      connections.dominance.push({ ...base, kind: "dominance", dominant: "A", description: `${nameA}'s ${ch.name} channel steadily conditions ${nameB}, who has no gates in it.` });
    } else if (bHas && !a1 && !a2) {
      connections.dominance.push({ ...base, kind: "dominance", dominant: "B", description: `${nameB}'s ${ch.name} channel steadily conditions ${nameA}, who has no gates in it.` });
    } else if (aHas && (b1 || b2)) {
      const bGate = b1 ? g1 : g2;
      connections.compromise.push({ ...base, kind: "compromise", dominant: "A", partialGate: bGate, description: `${nameA} carries the whole ${ch.name} channel; ${nameB} has Gate ${bGate} and gets drawn into ${nameA}'s frequency.` });
    } else if (bHas && (a1 || a2)) {
      const aGate = a1 ? g1 : g2;
      connections.compromise.push({ ...base, kind: "compromise", dominant: "B", partialGate: aGate, description: `${nameB} carries the whole ${ch.name} channel; ${nameA} has Gate ${aGate} and gets drawn into ${nameB}'s frequency.` });
    } else if ((a1 && b2 && !a2 && !b1) || (a2 && b1 && !a1 && !b2)) {
      const gateA = a1 ? g1 : g2;
      const gateB = b1 ? g1 : g2;
      connections.electromagnetic.push({ ...base, kind: "electromagnetic", gateA, gateB, description: `${nameA}'s Gate ${gateA} meets ${nameB}'s Gate ${gateB} — together you complete the ${ch.name} channel, energy neither has alone.` });
    }
  }

  // Centre conditioning.
  const defA = new Set(a.defined_centers);
  const defB = new Set(b.defined_centers);
  const centerConditioning: CenterConditioning[] = ALL_CENTERS.map((center) => {
    const aHas = defA.has(center), bHas = defB.has(center);
    const label = CENTER_LABEL[center];
    if (aHas && bHas) return { center, label, dynamic: "Both defined" as const, description: `You both define ${label} — fixed, reliable common ground.` };
    if (!aHas && !bHas) return { center, label, dynamic: "Both open" as const, description: `${label} is open in you both — you amplify each other (and the room) here.` };
    if (aHas && !bHas) return { center, label, dynamic: "A conditions B" as const, description: `${nameA} defines ${label}; ${nameB} takes it in — a consistent, often unspoken influence.` };
    return { center, label, dynamic: "B conditions A" as const, description: `${nameB} defines ${label}; ${nameA} takes it in — a consistent, often unspoken influence.` };
  });

  // Composite type (the two charts overlaid).
  const compositeGates = new Set<number>([...gatesA, ...gatesB]);
  const compositeChannels = channelsFromGates(compositeGates);
  const compositeType = typeFromCenters(definedFromChannels(compositeChannels), compositeChannels);

  const bridgedChannels = connections.electromagnetic.map((e) => ({ channel: e.channel, theme: e.theme }));
  const ph = profileHarmony(a.profile || "1/3", b.profile || "1/3");
  const conditioningCenters = centerConditioning.filter((c) => c.dynamic === "A conditions B" || c.dynamic === "B conditions A").length;

  const summaryParts = [`${a.type} + ${b.type}: ${dyn.dynamic.toLowerCase()}.`];
  if (ph.harmony >= 0.75) summaryParts.push(`Profiles ${ph.profileA} and ${ph.profileB} sit in natural harmony.`);
  if (connections.electromagnetic.length) summaryParts.push(`${connections.electromagnetic.length} electromagnetic channel${connections.electromagnetic.length > 1 ? "s" : ""} spark between you.`);
  if (connections.companionship.length) summaryParts.push(`${connections.companionship.length} shared channel${connections.companionship.length > 1 ? "s" : ""} give easy common ground.`);

  return {
    nameA, nameB,
    typeInteraction: { typeA: a.type, typeB: b.type, ...dyn },
    authorityDynamic: { authorityA: authA, authorityB: authB, timing, description: aDesc },
    profileHarmony: ph,
    connections,
    centerConditioning,
    bridgedChannels,
    compositeType,
    stats: {
      electromagnetic: connections.electromagnetic.length,
      companionship: connections.companionship.length,
      compromise: connections.compromise.length,
      dominance: connections.dominance.length,
      conditioningCenters,
    },
    summary: summaryParts.join(" "),
  };
}

// ---------------------------------------------------------------------------
// GROUP: analyzePenta
// ---------------------------------------------------------------------------

const CAREER_TYPES: Record<string, string> = {
  Manifestor: "Initiator",
  Generator: "Classic Builder",
  "Manifesting Generator": "Express Builder",
  Projector: "Advisor",
  Reflector: "Evaluator",
};

const PENTA_ROLES: Record<CenterName, { role: string; description: string }> = {
  Throat: { role: "Communicator", description: "Brings voice and manifestation — can articulate and act on what the group decides." },
  Sacral: { role: "Worker", description: "Provides sustainable life-force energy for the work. The engine of productivity." },
  Heart: { role: "Director", description: "Provides willpower and material direction — can make promises on the group's behalf." },
  G: { role: "Guide", description: "Holds the group's identity and direction — its sense of love and purpose." },
  SolarPlexus: { role: "Emotional Navigator", description: "Brings emotional depth and timing — helps the group feel its way to clarity." },
  Spleen: { role: "Health Monitor", description: "Provides intuition and survival instinct — keeps the group healthy and safe." },
  Head: { role: "Inspirer", description: "Brings mental pressure and inspiration — the questions that drive the group forward." },
  Ajna: { role: "Conceptualizer", description: "Processes and frames ideas — gives the group its mental scaffolding." },
  Root: { role: "Driver", description: "Brings pressure and momentum — keeps the group moving under productive stress." },
};

export type PentaMember = { name: string; sig: HdSignature };

export type PentaResult = {
  memberCount: number;
  isPenta: boolean;
  groupType: string;
  groupCareerType: string;
  members: { name: string; type: string; careerType: string; authority: string; profile: string }[];
  filledRoles: { center: CenterName; role: string; description: string; contributors: string[]; strength: "strong" | "moderate" }[];
  missingRoles: { center: CenterName; role: string; description: string; suggestion: string }[];
  electromagnetics: { personA: string; personB: string; channel: string; gates: [number, number]; theme: string }[];
  circuitBalance: Record<ChannelMeta["circuit"], number>;
  recommendations: { category: string; insight: string }[];
  stats: { totalChannels: number; filledRoleCount: number; missingRoleCount: number; electromagneticCount: number };
};

export function analyzePenta(input: PentaMember[]): PentaResult {
  const members = input.slice(0, 9);
  const memberCount = members.length;
  const isPenta = memberCount >= 3 && memberCount <= 5;

  const gateSets = members.map((m) => new Set(m.sig.gates));
  const allGates = new Set<number>();
  const allDefined = new Set<CenterName>();
  for (const m of members) {
    m.sig.gates.forEach((g) => allGates.add(g));
    m.sig.defined_centers.forEach((c) => allDefined.add(c));
  }

  const groupChannels = channelsFromGates(allGates);
  const groupCenters = definedFromChannels(groupChannels);
  const groupType = typeFromCenters(groupCenters, groupChannels);

  // Roles by who defines each centre.
  const filledRoles: PentaResult["filledRoles"] = [];
  const missingRoles: PentaResult["missingRoles"] = [];
  for (const center of ALL_CENTERS) {
    const info = PENTA_ROLES[center];
    const contributors = members.filter((m) => m.sig.defined_centers.includes(center)).map((m) => m.name);
    if (contributors.length > 0) {
      filledRoles.push({ center, ...info, contributors, strength: contributors.length > 1 ? "strong" : "moderate" });
    } else {
      missingRoles.push({ center, ...info, suggestion: `Consider weaving in someone with a defined ${CENTER_LABEL[center]} to hold this.` });
    }
  }

  // Electromagnetics across every pair.
  const electromagnetics: PentaResult["electromagnetics"] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const ga = gateSets[i], gb = gateSets[j];
      for (const ch of CHANNELS) {
        const [g1, g2] = ch.gates;
        if ((ga.has(g1) && gb.has(g2) && !ga.has(g2) && !gb.has(g1)) ||
            (ga.has(g2) && gb.has(g1) && !ga.has(g1) && !gb.has(g2))) {
          electromagnetics.push({ personA: members[i].name, personB: members[j].name, channel: ch.name, gates: ch.gates, theme: ch.theme });
        }
      }
    }
  }

  const circuitBalance: Record<ChannelMeta["circuit"], number> = { individual: 0, tribal: 0, collective: 0, integration: 0 };
  for (const ch of groupChannels) circuitBalance[ch.circuit]++;

  const recommendations = pentaRecommendations(groupType, missingRoles, circuitBalance, members, memberCount);

  return {
    memberCount,
    isPenta,
    groupType,
    groupCareerType: CAREER_TYPES[groupType] || groupType,
    members: members.map((m) => ({
      name: m.name, type: m.sig.type, careerType: CAREER_TYPES[m.sig.type] || "—",
      authority: authorityLabel(m.sig.authority), profile: m.sig.profile,
    })),
    filledRoles,
    missingRoles,
    electromagnetics,
    circuitBalance,
    recommendations,
    stats: {
      totalChannels: groupChannels.length,
      filledRoleCount: filledRoles.length,
      missingRoleCount: missingRoles.length,
      electromagneticCount: electromagnetics.length,
    },
  };
}

function pentaRecommendations(
  groupType: string,
  missingRoles: PentaResult["missingRoles"],
  circuitBalance: Record<ChannelMeta["circuit"], number>,
  members: PentaMember[],
  memberCount: number,
): { category: string; insight: string }[] {
  const recs: { category: string; insight: string }[] = [];

  const energy: Record<string, string> = {
    Generator: "Sustainable work energy — but it moves best by responding to real opportunities rather than initiating cold.",
    "Manifesting Generator": "Both initiates and sustains, with quick adaptability — watch for skipped steps.",
    Manifestor: "Initiating power — it serves the group to inform stakeholders before it moves.",
    Projector: "Excels at guidance and seeing the system — it works best when recognized and invited.",
    Reflector: "Mirrors its environment — major moves benefit from a full lunar cycle of reflection.",
  };
  recs.push({ category: "Group energy", insight: `Together you function as a ${groupType}. ${energy[groupType] || ""}`.trim() });

  const critical = missingRoles.filter((r) => (["Throat", "Sacral", "G"] as CenterName[]).includes(r.center));
  if (critical.length) {
    recs.push({
      category: "Critical gaps",
      insight: `No one holds: ${critical.map((r) => `${r.role} (${CENTER_LABEL[r.center]})`).join(", ")}. ` + (
        critical.some((r) => r.center === "Throat") ? "Watch for stalls in communicating and manifesting decisions." :
        critical.some((r) => r.center === "Sacral") ? "Watch for thin, unsustained work energy." :
        "Watch for drift in shared identity and direction."
      ),
    });
  }

  const total = Object.values(circuitBalance).reduce((a, b) => a + b, 0);
  if (total > 0) {
    const [name, count] = Object.entries(circuitBalance).sort((a, b) => b[1] - a[1])[0];
    if (count > total * 0.5) {
      const note: Record<string, string> = {
        individual: "Strong individual creativity, but it can struggle with shared norms.",
        tribal: "Strong loyalty and mutual support, but it can resist outside perspective.",
        collective: "Strong at sharing patterns and ideas, but it can lack individual initiative.",
        integration: "Strongly self-empowered, but it can turn inward.",
      };
      recs.push({ category: "Circuit balance", insight: `The field leans ${name} (${count}/${total} channels). ${note[name]}` });
    }
  }

  const types = members.map((m) => m.sig.type);
  const builders = types.filter((t) => t === "Generator" || t === "Manifesting Generator").length;
  const advisors = types.filter((t) => t === "Projector").length;
  if (builders === 0) recs.push({ category: "Composition", insight: "No Generators here — the group may run short on sustained work energy. A Builder would ballast it." });
  if (advisors === 0 && memberCount >= 3) recs.push({ category: "Composition", insight: "No Projectors here — the group may miss guidance and efficiency. An Advisor would sharpen it." });

  if (memberCount < 3) recs.push({ category: "Size", insight: "A true Penta wants 3–5. With two, the trans-auric form is incomplete — read this as a connection, not yet a group field." });
  else if (memberCount > 5) recs.push({ category: "Size", insight: `With ${memberCount}, you're past a single Penta — consider sub-teams of 3–5 for the cleanest group dynamics.` });

  return recs;
}

export { CHANNEL_BY_KEY };

// Build a self-consistent signature from the full channels a person carries
// (defined centres are derived from those channels) plus any lone gates. Used
// for sample/demo data and tests — never for real users (their signature comes
// from the real chart via extractHdSignature).
export function signatureFromChannels(opts: {
  type: string;
  profile: string;
  authority: string;
  channels: [number, number][];
  loneGates?: number[];
}): HdSignature {
  const gates = new Set<number>();
  const defined = new Set<CenterName>();
  for (const [a, b] of opts.channels) {
    gates.add(a);
    gates.add(b);
    const ch = CHANNEL_BY_KEY.get(channelKey(a, b));
    if (ch) ch.centers.forEach((c) => defined.add(c));
  }
  (opts.loneGates || []).forEach((g) => gates.add(g));
  return {
    type: opts.type,
    profile: opts.profile,
    authority: opts.authority,
    defined_centers: ALL_CENTERS.filter((c) => defined.has(c)),
    gates: [...gates].sort((a, b) => a - b),
  };
}
