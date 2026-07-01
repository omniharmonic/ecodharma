import "server-only";
import { withUser } from "./db";

// Compute-driven free/paid boundary (PRD §11). Free covers the core profile and a
// bounded number of constellations; AI-heavy actions beyond that are gated. This is
// a stub: it enforces quotas but does not charge — the seam where billing plugs in.
//
// (Per-user Claude entitlement / unlock codes were retired: Claude is now the global
// default engine, gated by a shared access password. See lib/config.ts.)

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
