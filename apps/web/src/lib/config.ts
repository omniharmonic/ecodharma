import "server-only";
import { withService } from "./db";
import { hashPassword, verifyPassword } from "./auth";

// Global runtime config (app_config singleton). Lets the admin flip the reading
// engine and set a shared access password WITHOUT a redeploy. See 0010_app_config.

export type InterpreterMode = "claude" | "fixture";
export type AppConfig = { interpreterMode: InterpreterMode; hasPassword: boolean };

// Small in-process cache — config is read on infrequent paths (reading generation,
// signup render, /curate), never the hot home path, so a few seconds is plenty.
let cache: { at: number; value: AppConfig; hash: string | null } | null = null;
const TTL_MS = 5_000;

function nowMs(): number {
  // Date.now() is fine in the app runtime (only workflow scripts forbid it).
  return Date.now();
}

async function load(): Promise<{ value: AppConfig; hash: string | null }> {
  if (cache && nowMs() - cache.at < TTL_MS) return { value: cache.value, hash: cache.hash };
  const row = await withService(async (c) => {
    const { rows } = await c.query(
      "select interpreter_mode, access_password_hash from app_config where id = true",
    );
    return rows[0] as { interpreter_mode?: string; access_password_hash?: string | null } | undefined;
  });
  const mode: InterpreterMode = row?.interpreter_mode === "fixture" ? "fixture" : "claude";
  const hash = row?.access_password_hash ?? null;
  const value: AppConfig = { interpreterMode: mode, hasPassword: !!hash };
  cache = { at: nowMs(), value, hash };
  return { value, hash };
}

function bust() {
  cache = null;
}

export async function getConfig(): Promise<AppConfig> {
  return (await load()).value;
}

export async function interpreterMode(): Promise<InterpreterMode> {
  return (await getConfig()).interpreterMode;
}

/** The single source of truth for "should this reading use Claude?". Env stays a
 *  hard override: no key, or ECODHARMA_INTERPRETER=fixture (e2e/local), forces the
 *  deterministic engine regardless of the DB mode. */
export async function claudeMode(): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ECODHARMA_INTERPRETER === "fixture") return false;
  return (await interpreterMode()) === "claude";
}

export async function setInterpreterMode(mode: InterpreterMode): Promise<void> {
  await withService((c) =>
    c.query("update app_config set interpreter_mode = $1, updated_at = now() where id = true", [mode]),
  );
  bust();
}

/** Set (or clear, with null) the shared access password. */
export async function setAccessPassword(plain: string | null): Promise<void> {
  const hash = plain && plain.trim() ? hashPassword(plain.trim()) : null;
  await withService((c) =>
    c.query("update app_config set access_password_hash = $1, updated_at = now() where id = true", [hash]),
  );
  bust();
}

/** True when no password is set (open) or the supplied one matches. */
export async function checkAccessPassword(plain: string | null): Promise<boolean> {
  const { hash } = await load();
  if (!hash) return true;
  return !!plain && verifyPassword(plain.trim(), hash);
}
