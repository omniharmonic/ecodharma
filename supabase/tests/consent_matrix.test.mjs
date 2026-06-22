// consent_matrix.test.mjs
//
// Proves the consent gate is enforced by Postgres Row-Level Security (not app code).
//
// WHAT IT VERIFIES (the consent matrix):
//   (a) A user CAN read their own gift_profile.
//   (b) User B CANNOT read user A's gift_profile when there is no consent.
//   (c) After A grants consent to B, B CAN read A's gift_profile.
//   (d) After A revokes that consent, B CANNOT read A's gift_profile again.
//
// HOW IT WORKS:
//   We connect directly to the local Supabase Postgres as the `postgres`
//   superuser. Setup writes (creating auth users, inserting a gift_profile) run
//   with RLS bypassed. To exercise RLS as a specific end-user we open a
//   transaction and run:
//       set local role authenticated;
//       set local request.jwt.claims = '{"sub":"<user-uuid>","role":"authenticated"}';
//   This is exactly what PostgREST does per request, so auth.uid() resolves to
//   the simulated user and every policy applies as it would in production.
//
// REQUIREMENTS:
//   - The `pg` package must be installed (npm i pg / pnpm add pg).
//   - A local Supabase stack must be running.
//
// HOW TO RUN:
//   1) supabase start
//   2) supabase db reset        # applies migrations 0001..0003
//   3) node supabase/tests/consent_matrix.test.mjs
//
// Connection string (local default): postgresql://postgres:postgres@127.0.0.1:54322/postgres

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const { Client } = pg;
const CONN = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

// Deterministic test UUIDs so the test is idempotent / rerunnable.
const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

const client = new Client({ connectionString: CONN });

/** Run a function's SQL as a simulated authenticated end-user (RLS applies). */
async function asUser(userId, fn) {
  await client.query('begin');
  try {
    await client.query("set local role authenticated");
    await client.query(
      `set local request.jwt.claims = '${JSON.stringify({ sub: userId, role: 'authenticated' })}'`
    );
    const result = await fn();
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback');
    throw err;
  }
}

/** Count gift_profile rows visible for owner === ownerId under current role. */
async function visibleGiftProfiles(ownerId) {
  const { rows } = await client.query(
    'select id from gift_profiles where user_id = $1',
    [ownerId]
  );
  return rows.length;
}

async function createAuthUser(id, email) {
  await client.query(
    `insert into auth.users
       (id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data)
     values
       ($1, '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', $2, '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)`,
    [id, email]
  );
}

before(async () => {
  await client.connect();

  // Clean slate (cascades to profiles, gift_profiles, consents, ...).
  await client.query('delete from auth.users where id = any($1::uuid[])', [
    [USER_A, USER_B],
  ]);

  // Create two users. The on_auth_user_created trigger auto-creates profiles.
  await createAuthUser(USER_A, 'a@ecodharma.test');
  await createAuthUser(USER_B, 'b@ecodharma.test');

  // Insert a gift_profile for A (as superuser; RLS bypassed for setup).
  await client.query(
    `insert into gift_profiles
       (user_id, framework_version, voice_version, content_json)
     values ($1, '0.0.0-pending', 'v0', '{"summary":"A gift"}'::jsonb)`,
    [USER_A]
  );
});

after(async () => {
  await client.query('delete from auth.users where id = any($1::uuid[])', [
    [USER_A, USER_B],
  ]);
  await client.end();
});

test('(a) a user can read their own gift_profile', async () => {
  const count = await asUser(USER_A, () => visibleGiftProfiles(USER_A));
  assert.equal(count, 1, "A should see A's own gift_profile");
});

test('(b) B cannot read A gift_profile without consent', async () => {
  const count = await asUser(USER_B, () => visibleGiftProfiles(USER_A));
  assert.equal(count, 0, "B should NOT see A's gift_profile (no consent)");
});

test('(c) after A grants consent to B, B can read A gift_profile', async () => {
  // A grants consent to B (exercises the manage_own_consent insert policy).
  await asUser(USER_A, () =>
    client.query(
      `insert into consents (granter_id, grantee_id, scope)
       values ($1, $2, 'constellation')`,
      [USER_A, USER_B]
    )
  );

  const count = await asUser(USER_B, () => visibleGiftProfiles(USER_A));
  assert.equal(count, 1, "B should see A's gift_profile after consent granted");
});

test('(d) after A revokes consent, B cannot read A gift_profile again', async () => {
  // A revokes (exercises the manage_own_consent update policy).
  await asUser(USER_A, () =>
    client.query(
      `update consents set revoked_at = now()
       where granter_id = $1 and grantee_id = $2 and revoked_at is null`,
      [USER_A, USER_B]
    )
  );

  const count = await asUser(USER_B, () => visibleGiftProfiles(USER_A));
  assert.equal(count, 0, "B should NOT see A's gift_profile after revocation");
});
