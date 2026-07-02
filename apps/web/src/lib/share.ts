import "server-only";
import { randomBytes } from "node:crypto";
import { withUser, withService } from "./db";
import { loadFramework } from "./framework";
import type { GiftProfile } from "./types";

// Social share cards — the privacy boundary for public sharing.
//
// A share is OPT-IN: a user must mint a token (getOrCreateShareToken) before any
// public surface exists. The public read (loadPublicCard) runs with service
// privileges but returns a STRICT WHITELIST — the recognition opener + archetype
// names + display name only. The full reading (gift_profiles.content_json) never
// leaves the server.

export type PublicCard = {
  recognition: string;
  archetypes: string[];
  display_name?: string;
};

/** Mint (or return the existing) public share token for a user. */
export async function getOrCreateShareToken(userId: string): Promise<string> {
  const candidate = randomBytes(9).toString("base64url"); // 12 urlsafe chars
  return withUser(userId, async (c) => {
    // coalesce keeps an already-set token stable across repeated calls.
    const { rows } = await c.query(
      "update profiles set share_token = coalesce(share_token, $2) where id = $1 returning share_token",
      [userId, candidate],
    );
    return rows[0].share_token as string;
  });
}

/** Turn sharing off — the public link 404s immediately after. */
export async function disableShareToken(userId: string): Promise<void> {
  await withUser(userId, (c) =>
    c.query("update profiles set share_token = null where id = $1", [userId]),
  );
}

/** The user's current token, or null if sharing is off. */
export async function getShareToken(userId: string): Promise<string | null> {
  return withUser(userId, async (c) => {
    const { rows } = await c.query("select share_token from profiles where id = $1", [userId]);
    return (rows[0]?.share_token as string | null) ?? null;
  });
}

/**
 * Resolve a public token to the whitelisted card data. Service-role read (the
 * viewer is anonymous), but we hand-pick only the safe fields off the reading.
 * Returns null for an unknown/disabled token or a user without a ready reading.
 */
export async function loadPublicCard(token: string): Promise<PublicCard | null> {
  if (!token) return null;
  const row = await withService(async (c) => {
    const { rows } = await c.query(
      `select p.display_name, gp.content_json
         from profiles p
         join lateral (
           select content_json from gift_profiles g
            where g.user_id = p.id and g.status = 'ready'
            order by generated_at desc limit 1
         ) gp on true
        where p.share_token = $1
        limit 1`,
      [token],
    );
    return rows[0] as { display_name: string | null; content_json: GiftProfile } | undefined;
  });
  if (!row) return null;

  const fw = loadFramework();
  const giftName = (id: string) => fw.gifts.find((g) => g.id === id)?.name || id;
  const content = row.content_json;
  const archetypes = (content.gift_constellation || [])
    .map((g) => giftName(g.gift_id))
    .filter(Boolean)
    .slice(0, 3);

  return {
    recognition: (content.recognition || "").trim(),
    archetypes,
    display_name: row.display_name || undefined,
  };
}
