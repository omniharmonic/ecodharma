import "server-only";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Framework } from "./types";

// A minimal built-in fallback so the app runs before the M0 distillation lands.
// Replaced automatically the moment framework/framework.json exists.
const STUB: Framework = {
  framework_version: "0.0.0-stub",
  voice_ref: "ecodharma-voice@1.0.0",
  summary:
    "A provisional lens on regenerative civilization while the distilled framework is finalized.",
  domains: [
    { id: "inner", name: "Inner / Consciousness", description: "Earth dharma, healing, sovereign unity, sacred ecology." },
    { id: "relational", name: "Relational / Kinship", description: "Conscious relating, leaderful spaces, the infrastructure of belonging." },
    { id: "ecological", name: "Ecological", description: "Watershed restoration, regenerative land, bioregional stewardship." },
    { id: "economic", name: "Economic", description: "Cooperatives, upward-spiral economics, bioregional finance." },
    { id: "governance", name: "Governance / Civic", description: "Polycentric, place-based governance; protocols of place." },
    { id: "technological", name: "Technological / Protocol", description: "d/acc, open protocols, cosmolocalism, mycelial networks." },
    { id: "cultural", name: "Cultural / Story / Ritual", description: "The new-and-ancient story, initiation, regenerative narrative." },
  ],
  gifts: [
    { id: "weaver", name: "The Weaver", description: "Connects people and threads into living wholes.", shadow: "Over-extends holding others together; neglects own thread.", modality_signals: { human_design: ["channel 19-49", "emotional authority"], western: ["Libra emphasis", "7th house"] } },
    { id: "healer", name: "The Healer", description: "Tends trauma and restores wholeness.", shadow: "Carries others' pain; forgets own care.", modality_signals: { western: ["Chiron emphasis", "12th house"], human_design: ["defined Solar Plexus"] } },
    { id: "builder", name: "The Builder", description: "Manifests durable structures and systems.", shadow: "Builds past the point of life; rigidity.", modality_signals: { human_design: ["Manifesting Generator", "defined Sacral"], western: ["Capricorn emphasis"] } },
    { id: "steward", name: "The Steward", description: "Holds and protects the commons and the land.", shadow: "Control masquerading as care.", modality_signals: { western: ["Taurus emphasis", "Saturn strong"] } },
    { id: "storyteller", name: "The Storyteller", description: "Carries the new-and-ancient story.", shadow: "Performs meaning instead of living it.", modality_signals: { western: ["Gemini/Sagittarius axis", "Mercury strong"], human_design: ["defined Throat"] } },
    { id: "protocol-smith", name: "The Protocol-smith", description: "Designs open protocols and coordination tech.", shadow: "Mistakes the map for the territory.", modality_signals: { human_design: ["defined Ajna"], western: ["Aquarius emphasis"] } },
    { id: "convener", name: "The Convener", description: "Calls people into generative space.", shadow: "Centralizes; struggles to let go.", modality_signals: { human_design: ["Projector", "Manifestor"], western: ["Leo emphasis", "1st house"] } },
    { id: "way-shower", name: "The Way-shower", description: "Walks ahead and points toward the threshold.", shadow: "Outpaces the people; isolation.", modality_signals: { western: ["Sagittarius emphasis", "9th house"] } },
  ],
  trim_tabs: [
    { id: "tt-weaver-relational", gift_id: "weaver", domain_id: "relational", pattern: "Convene a small circle from existing relationships and name the shared longing.", upward_spiral_logic: "Each new connection increases trust and the viability of the next gathering." },
    { id: "tt-builder-economic", gift_id: "builder", domain_id: "economic", pattern: "Start one solidarity squad or mutual-credit pool with three people.", upward_spiral_logic: "Circulation compounds; each member's participation makes the next more valuable." },
    { id: "tt-storyteller-cultural", gift_id: "storyteller", domain_id: "cultural", pattern: "Tell one true story of regeneration to an audience that hasn't heard it.", upward_spiral_logic: "Stories seed imagination; imagination seeds action; action makes new stories." },
    { id: "tt-steward-ecological", gift_id: "steward", domain_id: "ecological", pattern: "Adopt one patch of watershed and learn its names with others.", upward_spiral_logic: "Place-knowledge deepens care; care recruits more stewards." },
    { id: "tt-protocol-smith-technological", gift_id: "protocol-smith", domain_id: "technological", pattern: "Open-source one coordination tool your community already needs.", upward_spiral_logic: "Each fork and contribution lowers the cost of the next commons." },
    { id: "tt-healer-inner", gift_id: "healer", domain_id: "inner", pattern: "Hold one reparenting / grief-tending space for peers.", upward_spiral_logic: "Healed nervous systems make braver, more relational builders." },
  ],
  ikigai_lens: {
    love: "What you would do even unpaid, that makes you feel alive.",
    skill: "What you are genuinely good at, that others recognize.",
    world_need: "What the Great Turning actually needs here, now.",
    livelihood: "What can sustain you materially so the gift endures.",
  },
};

let cached: Framework | null = null;

export function loadFramework(): Framework {
  if (cached) return cached;
  const candidates = [
    process.env.FRAMEWORK_PATH && resolve(process.cwd(), process.env.FRAMEWORK_PATH),
    resolve(process.cwd(), "../../framework/framework.json"),
    resolve(process.cwd(), "framework/framework.json"),
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    try {
      const raw = readFileSync(p, "utf8");
      cached = JSON.parse(raw) as Framework;
      return cached;
    } catch {
      /* try next */
    }
  }
  cached = STUB;
  return cached;
}

export function frameworkVersion(): string {
  return loadFramework().framework_version;
}
