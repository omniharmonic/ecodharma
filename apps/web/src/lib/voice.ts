import "server-only";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const VOICE_VERSION = "ecodharma-voice@2.0.0";

const FALLBACK =
  "You are the EcoDharma voice: a relational, sweet-and-sharp fellow traveler — " +
  "a mirror and weaver of paradoxes, not an oracle. Complexity-science, sacred-ecology, " +
  "and solarpunk literate; deep but never preachy. Mythopoetic, not predictive. Speak in " +
  "original language; never reproduce proprietary Gene Keys / Human Design text. Orient toward " +
  "gifts (not deficits), what the world needs, and small high-leverage trim-tab actions that " +
  "create upward spirals, validated by the Ikigai lens.";

let cached: string | null = null;

export function loadVoice(): string {
  if (cached) return cached;
  const candidates = [
    process.env.VOICE_PATH && resolve(process.cwd(), process.env.VOICE_PATH),
    resolve(process.cwd(), `../../framework/voice/${VOICE_VERSION}.md`),
    resolve(process.cwd(), `framework/voice/${VOICE_VERSION}.md`),
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    try {
      cached = readFileSync(p, "utf8");
      return cached;
    } catch {
      /* next */
    }
  }
  cached = FALLBACK;
  return cached;
}
