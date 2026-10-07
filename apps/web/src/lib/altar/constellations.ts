import "server-only";
import { withUser } from "../db";
import { decOpt, encrypt } from "../crypto";
import { loadFramework } from "../framework";
import { normalizeReading } from "../normalize-reading";

// Dharma Constellations — the people co-arising with you. All reads run under
// RLS as the viewer; every cross-person row is consent-gated in Postgres
// (0021: is_consented_member). Offerings are excerpt COPIES, revocable.

export const DHARMA_ROLES = ["kin", "witness", "accountability", "mentor", "collaborator"] as const;
export type DharmaRole = (typeof DHARMA_ROLES)[number];
export const ROLE_META: Record<DharmaRole, { glyph: string; meaning: string }> = {
  kin: { glyph: "✶", meaning: "co-arising — shares devotions or the prayer's direction" },
  witness: { glyph: "◉", meaning: "holds you in your becoming; receives what you offer" },
  accountability: { glyph: "⇄", meaning: "a reciprocal pact — you see each other's ritual completions" },
  mentor: { glyph: "△", meaning: "has walked further along a path you're on" },
  collaborator: { glyph: "◈", meaning: "shares a work with you" },
};

export type Offering = { id: number; constellation_id: number; constellation: string; from: string; from_id: string; excerpt: string; at: string; mine: boolean };

export async function myConstellations(userId: string) {
  return withUser(userId, async (c) => {
    const { rows } = await c.query(
      `select co.id, co.name, m.dharma_role
         from constellations co join constellation_members m on m.constellation_id = co.id and m.user_id = auth.uid()
         join consents cs on cs.id = m.consent_id and cs.revoked_at is null
        order by co.created_at`);
    return rows.map((r) => ({ id: Number(r.id), name: r.name as string, role: r.dharma_role as DharmaRole }));
  });
}

export async function constellationDharma(userId: string, cid: number) {
  return withUser(userId, async (c) => {
    const members = (await c.query(
      `select m.user_id, m.dharma_role, p.display_name, (cs.revoked_at is null) as consented
         from constellation_members m left join consents cs on cs.id = m.consent_id
         left join profiles p on p.id = m.user_id where m.constellation_id = $1`, [cid])).rows;
    const prayer = (await c.query(
      "select id, lineage_id, version, title, created_at from constellation_altar where constellation_id=$1 and kind='prayer' order by version", [cid])).rows;
    const works = (await c.query(
      "select id, title from constellation_altar where constellation_id=$1 and kind='work' and superseded_at is null order by created_at", [cid])).rows;
    const offs = (await c.query(
      `select o.id, o.user_id, o.excerpt_enc, o.offered_at, p.display_name
         from offerings_shared o left join profiles p on p.id = o.user_id
        where o.constellation_id = $1 and o.revoked_at is null order by o.offered_at desc limit 50`, [cid])).rows;
    const notes = (await c.query(
      `select w.id, w.offering_id, w.from_user, w.body_enc, w.created_at, p.display_name
         from witness_notes w left join profiles p on p.id = w.from_user
        where w.constellation_id = $1 and (w.to_user = auth.uid() or w.from_user = auth.uid()) order by w.created_at`, [cid])).rows;
    return {
      members: members.map((m) => ({ id: m.user_id as string, name: (m.display_name as string) || "a member", role: (m.dharma_role || "kin") as DharmaRole, consented: !!m.consented, me: m.user_id === userId })),
      prayerRings: prayer.map((p) => ({ version: p.version as number, title: p.title as string, at: new Date(p.created_at).toISOString() })),
      works: works.map((w) => ({ id: Number(w.id), title: w.title as string })),
      offerings: offs.map((o) => ({ id: Number(o.id), from_id: o.user_id as string, from: (o.display_name as string) || "a member", excerpt: decOpt(o.excerpt_enc), at: new Date(o.offered_at).toISOString(), mine: o.user_id === userId })),
      notes: notes.map((n) => ({ id: Number(n.id), offering_id: n.offering_id ? Number(n.offering_id) : null, from: (n.display_name as string) || "a member", mine: n.from_user === userId, body: decOpt(n.body_enc), at: new Date(n.created_at).toISOString() })),
    };
  });
}

export async function setMyRole(userId: string, cid: number, role: DharmaRole) {
  await withUser(userId, (c) => c.query("select public.set_my_dharma_role($1, $2)", [cid, role]));
}

export async function offerReflection(userId: string, reflectionId: number, cid: number, excerpt: string): Promise<number> {
  const text = excerpt.trim().slice(0, 4000);
  if (!text) throw new Error("Choose the words you want to offer.");
  return withUser(userId, async (c) => {
    const own = await c.query("select 1 from reflections where id=$1 and user_id=auth.uid()", [reflectionId]);
    if (!own.rowCount) throw new Error("That reflection isn't yours to offer.");
    const { rows } = await c.query(
      "insert into offerings_shared (reflection_id, user_id, constellation_id, excerpt_enc) values ($1,$2,$3,$4) returning id",
      [reflectionId, userId, cid, encrypt(text)]);
    return Number(rows[0].id);
  });
}

export async function revokeOffering(userId: string, offeringId: number) {
  await withUser(userId, (c) => c.query("update offerings_shared set revoked_at = now() where id=$1 and user_id=auth.uid()", [offeringId]));
}

export async function sendWitness(userId: string, toUser: string, cid: number, body: string, offeringId?: number | null) {
  const text = body.trim().slice(0, 2000);
  if (!text) throw new Error("Write a few words of witness.");
  await withUser(userId, (c) => c.query(
    "insert into witness_notes (from_user, to_user, constellation_id, offering_id, body_enc) values ($1,$2,$3,$4,$5)",
    [userId, toUser, cid, offeringId ?? null, encrypt(text)]));
}

/** Append a new version of the constellation's shared prayer (or add a shared work). */
export async function addSharedElement(userId: string, cid: number, kind: "prayer" | "work", title: string) {
  const t = title.trim().slice(0, 500);
  if (!t) throw new Error("Give it words.");
  await withUser(userId, async (c) => {
    if (kind === "prayer") {
      const cur = (await c.query("select id, lineage_id, version from constellation_altar where constellation_id=$1 and kind='prayer' and superseded_at is null", [cid])).rows[0];
      if (cur) await c.query("update constellation_altar set superseded_at = now() where id=$1", [cur.id]);
      const { rows } = await c.query(
        "insert into constellation_altar (constellation_id, kind, lineage_id, version, title, created_by) values ($1,'prayer',$2,$3,$4,$5) returning id",
        [cid, cur?.lineage_id ?? null, (cur?.version ?? 0) + 1, t, userId]);
      if (!cur) await c.query("update constellation_altar set lineage_id = id where id = $1", [rows[0].id]);
    } else {
      await c.query("insert into constellation_altar (constellation_id, kind, title, created_by) values ($1,'work',$2,$3)", [cid, t, userId]);
    }
  });
}

/** Kin for the Sky: consented co-members with their lead gifts (RLS-visible readings only). */
export async function kinFor(userId: string): Promise<{ id: string; name: string; gifts: string[] }[]> {
  const fw = loadFramework();
  return withUser(userId, async (c) => {
    const { rows } = await c.query(
      `select distinct on (m2.user_id) m2.user_id, p.display_name,
              (select content_json from gift_profiles g where g.user_id = m2.user_id and g.status='ready' order by generated_at desc limit 1) as reading
         from constellation_members m1
         join consents c1 on c1.id = m1.consent_id and c1.revoked_at is null
         join constellation_members m2 on m2.constellation_id = m1.constellation_id and m2.user_id <> m1.user_id
         join consents c2 on c2.id = m2.consent_id and c2.revoked_at is null
         left join profiles p on p.id = m2.user_id
        where m1.user_id = auth.uid()`);
    return rows.map((r) => ({
      id: r.user_id as string,
      name: ((r.display_name as string) || "kin").split(/\s+/)[0],
      gifts: r.reading ? normalizeReading(r.reading).gift_constellation.slice(0, 2).map((g) => fw.gifts.find((x) => x.id === g.gift_id)?.name || g.gift_id) : [],
    }));
  });
}

/** The constellation pulse (for MCP, Telegram /pulse, the dashboard). */
export async function constellationPulse(userId: string): Promise<string> {
  const mine = await myConstellations(userId);
  if (!mine.length) return "You're not in a Dharma Constellation yet. Weave one at /constellations and invite the people co-arising with you.";
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const lines: string[] = [];
  for (const c of mine) {
    const d = await constellationDharma(userId, c.id);
    lines.push(`✶ ${c.name} — you are ${c.role}. Members: ${d.members.filter((m) => m.consented).map((m) => `${m.name} (${m.role})`).join(", ")}`);
    if (d.prayerRings.length) lines.push(`  shared prayer: “${d.prayerRings[d.prayerRings.length - 1].title}”`);
    for (const o of d.offerings.filter((o) => !o.mine && o.at >= since).slice(0, 5)) lines.push(`  ◉ ${o.from} offered (${o.at.slice(0, 10)}): “${o.excerpt.slice(0, 280)}”`);
    for (const n of d.notes.filter((n) => !n.mine && n.at >= since).slice(0, 5)) lines.push(`  ✉ witness from ${n.from}: “${n.body.slice(0, 200)}”`);
  }
  const comps = await withUser(userId, async (c) => (await c.query("select * from public.accountability_completions($1)", [since])).rows);
  if (comps.length) {
    lines.push("⇄ Accountability partners' completed rituals (30d):");
    for (const r of comps.slice(0, 12)) lines.push(`  - ${r.display_name || "partner"}: ${r.cadence} on ${new Date(r.completed_at).toISOString().slice(0, 10)}`);
  }
  return lines.join("\n");
}
