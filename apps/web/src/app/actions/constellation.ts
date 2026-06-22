"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { withService, withUser } from "@/lib/db";
import { findUserByEmail } from "@/lib/auth";
import { generateConstellationRead, type Member } from "@/lib/interpret-constellation";
import { assertWithinQuota, PaywallError } from "@/lib/entitlements";
import { frameworkVersion } from "@/lib/framework";
import type { GiftProfile } from "@/lib/types";

export async function createConstellationAction(_prev: unknown, formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const name = String(formData.get("name") || "").trim() || "Untitled constellation";

  try {
    await assertWithinQuota(user!.id, "constellation");
  } catch (e) {
    if (e instanceof PaywallError) {
      return { error: "You've reached the free limit of constellations. (Paid tier would lift this.)" };
    }
    throw e;
  }

  // Create as owner (RLS owner-insert). Auto-add owner as a consented member.
  const id = await withUser(user!.id, async (c) => {
    const { rows } = await c.query(
      "insert into constellations (owner_id, name, type) values ($1,$2,'group') returning id",
      [user!.id, name],
    );
    return rows[0].id as number;
  });
  // Owner is implicitly a member; self-profile reads need no consent.
  await withService((c) =>
    c.query(
      "insert into constellation_members (constellation_id, user_id, role) values ($1,$2,'owner') on conflict do nothing",
      [id, user!.id],
    ),
  );
  redirect(`/constellations/${id}`);
}

export async function inviteMemberAction(_prev: unknown, formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const constellationId = Number(formData.get("constellation_id"));
  const email = z.string().email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email." };

  // Must own the constellation.
  const owns = await withUser(user!.id, async (c) => {
    const { rows } = await c.query(
      "select 1 from constellations where id=$1 and owner_id=$2",
      [constellationId, user!.id],
    );
    return rows.length > 0;
  });
  if (!owns) return { error: "Only the owner can invite." };

  const invitee = await findUserByEmail(email.data);
  if (!invitee) return { error: "No EcoDharma member with that email yet. Invite them to sign up first." };
  if (invitee.id === user!.id) return { error: "You're already in your own constellation." };

  // Pending membership (consent_id null). The invitee must actively opt in.
  await withService((c) =>
    c.query(
      "insert into constellation_members (constellation_id, user_id, role) values ($1,$2,'member') on conflict do nothing",
      [constellationId, invitee.id],
    ),
  );
  revalidatePath(`/constellations/${constellationId}`);
  return { ok: "Invitation sent. They'll see it and choose whether to consent." };
}

export async function respondInviteAction(_prev: unknown, formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const constellationId = Number(formData.get("constellation_id"));
  const decision = String(formData.get("decision"));

  // Confirm there is a pending membership for this user.
  const owner = await withService(async (c) => {
    const { rows } = await c.query(
      `select cs.owner_id from constellation_members m
         join constellations cs on cs.id = m.constellation_id
        where m.constellation_id=$1 and m.user_id=$2`,
      [constellationId, user!.id],
    );
    return rows[0]?.owner_id as string | undefined;
  });
  if (!owner) return { error: "No such invitation." };

  if (decision === "accept") {
    // Active consent: the invitee writes the consent row (RLS manage_own_consent).
    const consentId = await withUser(user!.id, async (c) => {
      const { rows } = await c.query(
        `insert into consents (granter_id, grantee_id, constellation_id, scope)
         values ($1,$2,$3,'constellation') returning id`,
        [user!.id, owner, constellationId],
      );
      return rows[0].id as number;
    });
    await withService((c) =>
      c.query(
        "update constellation_members set consent_id=$1 where constellation_id=$2 and user_id=$3",
        [consentId, constellationId, user!.id],
      ),
    );
  } else {
    // Decline -> remove pending membership.
    await withService((c) =>
      c.query("delete from constellation_members where constellation_id=$1 and user_id=$2 and consent_id is null", [
        constellationId, user!.id,
      ]),
    );
  }
  revalidatePath("/constellations");
  return { ok: decision === "accept" ? "You've joined — your gifts can now be woven." : "Declined." };
}

export async function revokeConsentAction(_prev: unknown, formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const constellationId = Number(formData.get("constellation_id"));
  // Revoke my consent for this constellation (RLS manage_own_consent).
  await withUser(user!.id, (c) =>
    c.query(
      "update consents set revoked_at=now() where granter_id=$1 and constellation_id=$2 and revoked_at is null",
      [user!.id, constellationId],
    ),
  );
  revalidatePath("/constellations");
  return { ok: "Consent revoked. Your profile is no longer woven into that constellation." };
}

export async function generateReadAction(_prev: unknown, formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const constellationId = Number(formData.get("constellation_id"));

  // Must own it.
  const owns = await withUser(user!.id, async (c) => {
    const { rows } = await c.query("select 1 from constellations where id=$1 and owner_id=$2", [
      constellationId, user!.id,
    ]);
    return rows.length > 0;
  });
  if (!owns) return { error: "Only the owner can generate a read." };

  // Load members' profiles AS the owner — RLS returns only CONSENTED members'
  // data (this is the consent gate in action). Non-consented members drop out.
  const members: Member[] = await withUser(user!.id, async (c) => {
    const { rows } = await c.query(
      `select m.user_id,
              p.display_name,
              gp.content_json
         from constellation_members m
         left join profiles p on p.id = m.user_id
         left join lateral (
           select content_json from gift_profiles g
            where g.user_id = m.user_id order by generated_at desc limit 1
         ) gp on true
        where m.constellation_id = $1`,
      [constellationId],
    );
    return rows
      .filter((r) => r.content_json) // only members whose profile we can actually see (consented or self)
      .map((r) => ({
        display_name: r.display_name || "A kin",
        profile: r.content_json as GiftProfile,
      }));
  });

  if (members.length < 2) {
    return { error: "Need at least two consented members (including you) to weave a read." };
  }

  const read = await generateConstellationRead(members);
  await withUser(user!.id, (c) =>
    c.query(
      "insert into constellation_reads (constellation_id, framework_version, content_json) values ($1,$2,$3)",
      [constellationId, frameworkVersion(), JSON.stringify(read)],
    ),
  );
  revalidatePath(`/constellations/${constellationId}`);
  return { ok: "Constellation read woven." };
}
