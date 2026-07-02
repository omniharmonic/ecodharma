import "server-only";
import { randomBytes } from "node:crypto";
import { withService } from "./db";

// Constellation join links. Owner-created; redeemed by any signed-in user. Still
// consent-gated — redeeming makes you a PENDING member; your gifts aren't woven
// until you actively consent on /constellations.

export async function createInvite(
  constellationId: number,
  createdBy: string,
  maxUses: number | null,
  ttlDays = 14,
): Promise<string> {
  const token = randomBytes(9).toString("base64url"); // 12 urlsafe chars
  await withService((c) =>
    c.query(
      `insert into constellation_invites (token, constellation_id, created_by, max_uses, expires_at)
       values ($1, $2, $3, $4, now() + make_interval(days => $5))`,
      [token, constellationId, createdBy, maxUses, ttlDays],
    ),
  );
  return token;
}

export type RedeemResult =
  | { ok: true; constellationId: number; alreadyMember: boolean }
  | { ok: false; reason: string };

/** Redeem a join link → add the viewer as a pending member (idempotent). */
export async function redeemInvite(token: string, userId: string): Promise<RedeemResult> {
  return withService(async (c) => {
    const { rows } = await c.query(
      "select constellation_id, max_uses, uses, expires_at from constellation_invites where token = $1",
      [token],
    );
    const inv = rows[0] as
      | { constellation_id: number; max_uses: number | null; uses: number; expires_at: Date | null }
      | undefined;
    if (!inv) return { ok: false, reason: "This invite link is invalid." };
    if (inv.expires_at && inv.expires_at.getTime() < Date.now()) return { ok: false, reason: "This invite link has expired." };

    // Already a member? Idempotent — don't consume a use on a revisit.
    const existing = await c.query(
      "select 1 from constellation_members where constellation_id = $1 and user_id = $2",
      [inv.constellation_id, userId],
    );
    if (existing.rows.length > 0) return { ok: true, constellationId: inv.constellation_id, alreadyMember: true };

    if (inv.max_uses != null && inv.uses >= inv.max_uses) return { ok: false, reason: "This invite link has been used up." };

    await c.query(
      "insert into constellation_members (constellation_id, user_id, role) values ($1, $2, 'member') on conflict do nothing",
      [inv.constellation_id, userId],
    );
    await c.query("update constellation_invites set uses = uses + 1 where token = $1", [token]);
    return { ok: true, constellationId: inv.constellation_id, alreadyMember: false };
  });
}
