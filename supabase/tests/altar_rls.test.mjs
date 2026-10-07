// altar_rls.test.mjs — the Living Altar's privacy, proven in Postgres.
//
//   (a) A person's altar, reflections, strands, rituals, invitations are
//       invisible to everyone else (owner-only RLS on every v4 table).
//   (b) Nobody can write rows into another person's altar or journal.
//   (c) An OFFERING is visible only to actively-consented co-members, only
//       while not withdrawn — and only while the offerer's consent stands.
//   (d) Witness notes go only between consented co-members.
//   (e) Accountability completions show cadence + date, never content, and
//       only between mutual accountability partners.
//
// Run: node --test supabase/tests/altar_rls.test.mjs   (local PG on :54322, migrations applied)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const CONN = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const A = "a1a1a1a1-0000-4000-8000-000000000001";
const B = "b2b2b2b2-0000-4000-8000-000000000002";
const C = "c3c3c3c3-0000-4000-8000-000000000003"; // outsider
const db = new pg.Client({ connectionString: CONN });

async function as(user, fn) {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query(`set local request.jwt.claims = '${JSON.stringify({ sub: user, role: "authenticated" })}'`);
    const r = await fn();
    await db.query("commit");
    return r;
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}
const count = async (sql, args = []) => (await db.query(sql, args)).rows.length;

let cid, consentB, reflA, offeringB;

before(async () => {
  await db.connect();
  await db.query("delete from auth.users where id = any($1::uuid[])", [[A, B, C]]);
  for (const [id, email] of [[A, "rls-a@ecodharma.test"], [B, "rls-b@ecodharma.test"], [C, "rls-c@ecodharma.test"]]) {
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2,'',now(),now(),now(),'{}','{}')`, [id, email]);
  }
  // A's altar + a reflection with a strand (as A, through RLS).
  reflA = await as(A, async () => {
    const el = (await db.query("insert into altar_elements (user_id, kind, title) values ($1,'work','A secret work') returning id", [A])).rows[0].id;
    await db.query("update altar_elements set lineage_id = id where id = $1", [el]);
    const r = (await db.query("insert into reflections (user_id, body_enc) values ($1, '\\x01'::bytea) returning id", [A])).rows[0].id;
    await db.query("insert into strands (user_id, reflection_id, lineage_id, relation, charge) values ($1,$2,$3,'embodies',1)", [A, r, el]);
    await db.query("insert into rituals (user_id, cadence, depth, due_at, completed_reflection_id) values ($1,'weekly',1,now(),$2)", [A, r]);
    return r;
  });
  // A constellation of A and B (both consented); C is not a member.
  cid = (await db.query("insert into constellations (owner_id, name) values ($1,'RLS pod') returning id", [A])).rows[0].id;
  const ca = (await db.query("insert into consents (granter_id, constellation_id) values ($1,$2) returning id", [A, cid])).rows[0].id;
  consentB = (await db.query("insert into consents (granter_id, constellation_id) values ($1,$2) returning id", [B, cid])).rows[0].id;
  await db.query("insert into constellation_members (constellation_id, user_id, consent_id, dharma_role) values ($1,$2,$3,'accountability'), ($1,$4,$5,'accountability')", [cid, A, ca, B, consentB]);
});

after(async () => {
  await db.query("delete from auth.users where id = any($1::uuid[])", [[A, B, C]]);
  await db.end();
});

test("(a) the altar and journal are owner-only", async () => {
  for (const viewer of [B, C]) {
    await as(viewer, async () => {
      for (const t of ["altar_elements", "reflections", "strands", "rituals", "invitations", "element_events", "alignment_readings"]) {
        assert.equal(await count(`select 1 from ${t} where user_id = $1`, [A]), 0, `${viewer} must not see A's ${t}`);
      }
    });
  }
  await as(A, async () => assert.equal(await count("select 1 from reflections where user_id = $1", [A]), 1));
});

test("(b) nobody can write into another's altar", async () => {
  await assert.rejects(as(B, () => db.query("insert into altar_elements (user_id, kind, title) values ($1,'root','planted by B')", [A])));
  await assert.rejects(as(B, () => db.query("insert into reflections (user_id, body_enc) values ($1,'\\x01'::bytea)", [A])));
  await as(B, async () => {
    const r = await db.query("update reflections set cadence = 'weekly' where user_id = $1", [A]);
    assert.equal(r.rowCount, 0);
  });
});

test("(c) offerings: consented co-members only, revocable both ways", async () => {
  offeringB = await as(B, async () => {
    const r = (await db.query("insert into reflections (user_id, body_enc) values ($1,'\\x01'::bytea) returning id", [B])).rows[0].id;
    return (await db.query("insert into offerings_shared (reflection_id, user_id, constellation_id, excerpt_enc) values ($1,$2,$3,'\\x02'::bytea) returning id", [r, B, cid])).rows[0].id;
  });
  await as(A, async () => assert.equal(await count("select 1 from offerings_shared where id = $1", [offeringB]), 1, "A (consented member) sees it"));
  await as(C, async () => assert.equal(await count("select 1 from offerings_shared where id = $1", [offeringB]), 0, "outsider C does not"));
  // C cannot offer into a pod they're not in.
  await assert.rejects(as(C, async () => {
    const r = (await db.query("insert into reflections (user_id, body_enc) values ($1,'\\x01'::bytea) returning id", [C])).rows[0].id;
    await db.query("insert into offerings_shared (reflection_id, user_id, constellation_id, excerpt_enc) values ($1,$2,$3,'\\x02'::bytea)", [r, C, cid]);
  }));
  // B revokes consent → A can no longer see B's offering.
  await db.query("update consents set revoked_at = now() where id = $1", [consentB]);
  await as(A, async () => assert.equal(await count("select 1 from offerings_shared where id = $1", [offeringB]), 0));
  await db.query("update consents set revoked_at = null where id = $1", [consentB]);
  // B withdraws the offering → hidden from A.
  await as(B, () => db.query("update offerings_shared set revoked_at = now() where id = $1", [offeringB]));
  await as(A, async () => assert.equal(await count("select 1 from offerings_shared where id = $1", [offeringB]), 0));
});

test("(d) witness notes only between consented co-members", async () => {
  await as(A, () => db.query("insert into witness_notes (from_user, to_user, constellation_id, body_enc) values ($1,$2,$3,'\\x03'::bytea)", [A, B, cid]));
  await as(B, async () => assert.equal(await count("select 1 from witness_notes where to_user = $1", [B]), 1));
  await as(C, async () => assert.equal(await count("select 1 from witness_notes"), 0));
  await assert.rejects(as(C, () => db.query("insert into witness_notes (from_user, to_user, constellation_id, body_enc) values ($1,$2,$3,'\\x03'::bytea)", [C, A, cid])));
});

test("(e) accountability: completions (no content) between mutual partners only", async () => {
  const rowsB = await as(B, async () => (await db.query("select * from public.accountability_completions(now() - interval '1 day')")).rows);
  assert.equal(rowsB.length, 1);
  assert.equal(rowsB[0].user_id, A);
  assert.deepEqual(Object.keys(rowsB[0]).sort(), ["cadence", "completed_at", "constellation_id", "display_name", "user_id"]);
  const rowsC = await as(C, async () => (await db.query("select * from public.accountability_completions(now() - interval '1 day')")).rows);
  assert.equal(rowsC.length, 0);
});
