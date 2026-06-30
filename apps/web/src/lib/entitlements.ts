import "server-only";
import { randomBytes } from "crypto";
import { withUser, withService } from "./db";

// Compute-driven free/paid boundary (PRD §11). Free covers the core profile and a
// bounded number of constellations; AI-heavy actions beyond that are gated. This is
// a stub: it enforces quotas but does not charge — the seam where billing plugs in.

export class PaywallError extends Error {
  constructor(public feature: string) {
    super(`paywall: ${feature} quota reached`);
    this.name = "PaywallError";
  }
}

const FREE_LIMITS: Record<string, number> = {
  profile_regen: 3, // regenerations beyond the first
  constellation: 3, // owned constellations
};

export async function checkQuota(
  userId: string,
  feature: keyof typeof FREE_LIMITS,
): Promise<{ used: number; limit: number; ok: boolean }> {
  const limit = FREE_LIMITS[feature];
  let used = 0;
  if (feature === "constellation") {
    used = await withUser(userId, async (c) => {
      const { rows } = await c.query(
        "select count(*)::int as n from constellations where owner_id = $1",
        [userId],
      );
      return rows[0].n as number;
    });
  } else if (feature === "profile_regen") {
    used = await withUser(userId, async (c) => {
      const { rows } = await c.query(
        "select greatest(count(*)::int - 1, 0) as n from gift_profiles where user_id = $1",
        [userId],
      );
      return rows[0].n as number;
    });
  }
  return { used, limit, ok: used < limit };
}

export async function assertWithinQuota(
  userId: string,
  feature: keyof typeof FREE_LIMITS,
): Promise<void> {
  const { ok } = await checkQuota(userId, feature);
  if (!ok) throw new PaywallError(feature);
}

// ---------------------------------------------------------------------------
// Tiered interpreter access (free fixture for all; Claude for code-holders).
// ---------------------------------------------------------------------------

export type Tier = "free" | "claude";

/** Real Claude is wired AND not force-disabled (e2e/local set fixture). */
export function claudeAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY && process.env.ECODHARMA_INTERPRETER !== "fixture";
}

/** An explicit admin allowlist auto-entitles its members (never when unset, so
 *  the prototype's "everyone is admin" default does NOT hand out Claude). */
function adminAutoEntitled(email: string): boolean {
  const list = (process.env.ECODHARMA_ADMIN_EMAILS || "").trim();
  if (!list) return false;
  return list.split(",").map((e) => e.trim().toLowerCase()).includes(email.toLowerCase());
}

export async function getTier(userId: string): Promise<Tier> {
  return withService(async (c) => {
    const { rows } = await c.query("select tier from profiles where id = $1", [userId]);
    return rows[0]?.tier === "claude" ? "claude" : "free";
  });
}

/** The per-user cost gate: only entitled friends (or an admin) burn Claude tokens. */
export async function userCanUseClaude(userId: string, email: string): Promise<boolean> {
  if (!claudeAvailable()) return false;
  if (adminAutoEntitled(email)) return true;
  return (await getTier(userId)) === "claude";
}

export type RedeemResult = { ok: boolean; message: string };

/** Redeem an unlock code → upgrade this user to the Claude tier. One per user. */
export async function redeemCode(userId: string, codeRaw: string): Promise<RedeemResult> {
  const code = codeRaw.trim().toLowerCase();
  if (!code) return { ok: false, message: "Enter a code." };
  return withService(async (c) => {
    const { rows } = await c.query(
      "select code, active, max_redemptions, redeemed_count from unlock_codes where code = $1",
      [code],
    );
    const rec = rows[0];
    if (!rec || !rec.active) return { ok: false, message: "That code isn't valid." };
    if (rec.max_redemptions != null && rec.redeemed_count >= rec.max_redemptions)
      return { ok: false, message: "That code has been fully redeemed." };

    const already = await c.query("select 1 from code_redemptions where user_id = $1", [userId]);
    await c.query("update profiles set tier = 'claude' where id = $1", [userId]);
    if (already.rowCount === 0) {
      await c.query("insert into code_redemptions (user_id, code) values ($1, $2)", [userId, code]);
      await c.query("update unlock_codes set redeemed_count = redeemed_count + 1 where code = $1", [code]);
    }
    return { ok: true, message: "Unlocked — your next reading will be Claude-powered." };
  });
}

export type UnlockCode = {
  code: string;
  note: string | null;
  active: boolean;
  max_redemptions: number | null;
  redeemed_count: number;
  created_at: string;
};

/** Mint a friendly, shareable code, e.g. "weave-trim-8421". */
export async function mintCode(note: string, maxRedemptions: number | null): Promise<string> {
  const code = freshCode();
  await withService((c) =>
    c.query("insert into unlock_codes (code, note, max_redemptions) values ($1, $2, $3)", [
      code,
      note.trim() || null,
      maxRedemptions,
    ]),
  );
  return code;
}

export async function listCodes(): Promise<UnlockCode[]> {
  return withService(async (c) => {
    const { rows } = await c.query(
      "select code, note, active, max_redemptions, redeemed_count, created_at from unlock_codes order by created_at desc",
    );
    return rows as UnlockCode[];
  });
}

const CODE_WORDS = [
  "weave", "trim", "tab", "spiral", "seed", "loom", "delta", "gift",
  "bloom", "fold", "root", "mend", "tide", "grove", "ember", "north",
];
function freshCode(): string {
  const pick = () => CODE_WORDS[randomBytes(1)[0] % CODE_WORDS.length];
  const n = 1000 + (randomBytes(2).readUInt16BE(0) % 9000);
  return `${pick()}-${pick()}-${n}`;
}
