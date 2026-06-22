import "server-only";

/** True when we should call real Claude. Set ECODHARMA_INTERPRETER=fixture to force
 *  the deterministic offline interpreter (used by e2e for speed + determinism). */
export function useClaude(): boolean {
  return !!process.env.ANTHROPIC_API_KEY && process.env.ECODHARMA_INTERPRETER !== "fixture";
}
