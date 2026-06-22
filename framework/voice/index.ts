import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Versioned identifier for the EcoDharma voice system prompt.
 * Bump this (and add a matching `ecodharma-voice@<version>.md`) whenever the
 * persona/guardrails change, so generated profiles can be traced to the exact
 * voice that produced them.
 */
export const VOICE_VERSION = "ecodharma-voice@1.0.0";

/** Absolute path to this module's directory, resolved for ESM. */
const VOICE_DIR = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the markdown system-prompt asset for the current version. */
export const VOICE_PATH = join(VOICE_DIR, `${VOICE_VERSION}.md`);

/**
 * Loads the EcoDharma voice system prompt from disk.
 *
 * Server-side only (uses Node fs). In Next.js, call this from a Server
 * Component, Route Handler, or Server Action — never from the client. The file
 * is read synchronously and is small, so this is safe at request or build time.
 *
 * @returns the full markdown of the voice system prompt
 */
export function loadVoice(): string {
  return readFileSync(VOICE_PATH, "utf8");
}
