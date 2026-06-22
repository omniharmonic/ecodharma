import "server-only";
import { withUser, withService } from "./db";

// Gather EVERYTHING this user owns — for transparent export (PRD §10 data-ownership).
// Read as the user so RLS scopes it to exactly what is theirs.
export async function exportUserData(userId: string, email: string) {
  return withUser(userId, async (c) => {
    // Sequential — a single pg connection can't run queries concurrently.
    const q = async (sql: string) => (await c.query(sql, [userId])).rows;
    const profile = await q("select * from profiles where id = $1");
    const birth = await q("select * from birth_data where user_id = $1");
    const charts = await q("select modality, engine_version, computed_at, raw_json from charts where user_id = $1");
    const profiles = await q("select framework_version, voice_version, status, generated_at, content_json from gift_profiles where user_id = $1");
    const offerings = await q("select * from offerings where user_id = $1");
    const consentsGranted = await q("select id, grantee_id, constellation_id, scope, granted_at, revoked_at from consents where granter_id = $1");
    const memberships = await q("select constellation_id, role, consent_id from constellation_members where user_id = $1");
    const ownedConstellations = await q("select id, name, type, created_at from constellations where owner_id = $1");
    return {
      exported_at: new Date().toISOString(),
      account: { id: userId, email },
      profile: profile[0] ?? null,
      birth_data: birth[0] ?? null,
      charts,
      gift_profiles: profiles,
      offerings: offerings[0] ?? null,
      consents_granted: consentsGranted,
      constellation_memberships: memberships,
      owned_constellations: ownedConstellations,
      note: "Your data, exported in full. EcoDharma keeps your profile private by default; nothing here was ever shared without your active consent.",
    };
  });
}

export async function dataSummary(userId: string) {
  return withUser(userId, async (c) => {
    const one = async (sql: string) => Number((await c.query(sql, [userId])).rows[0]?.n ?? 0);
    const charts = await one("select count(*)::int n from charts where user_id=$1");
    const profiles = await one("select count(*)::int n from gift_profiles where user_id=$1");
    const activeConsents = await one("select count(*)::int n from consents where granter_id=$1 and revoked_at is null");
    const constellations = await one("select count(*)::int n from constellations where owner_id=$1");
    return { charts, profiles, activeConsents, constellations };
  });
}

// Hard delete: removing the auth.users row cascades to every owned table
// (birth_data, charts, gift_profiles, offerings, consents, constellations, ...).
export async function deleteAccount(userId: string): Promise<void> {
  await withService((c) => c.query("delete from auth.users where id = $1", [userId]));
}

// Revoke every consent this user has granted, in one move.
export async function revokeAllConsents(userId: string): Promise<number> {
  return withUser(userId, async (c) => {
    const res = await c.query(
      "update consents set revoked_at = now() where granter_id = $1 and revoked_at is null",
      [userId],
    );
    return res.rowCount ?? 0;
  });
}
