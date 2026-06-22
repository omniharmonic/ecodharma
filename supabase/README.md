# EcoDharma — Supabase (Phase M2: data model + consent)

Local-only Supabase project. Consent is enforced in the **database** via Postgres
Row-Level Security (RLS), so the gate holds even if application code has bugs.

## Layout

```
supabase/
  config.toml                       # local CLI config (api 54321, db 54322, studio 54323)
  migrations/
    0001_schema.sql                 # tables, indexes, handle_new_user() trigger
    0002_rls.sql                    # RLS: enable + policies + helper functions
    0003_seed_framework.sql         # placeholder framework_versions row
  tests/
    consent_matrix.test.mjs         # proves the consent gate via real RLS
```

## Prerequisites

- Docker running
- Supabase CLI (`supabase --version`)
- Node 18+ and the `pg` package for the test (`npm i pg` or `pnpm add pg`)

## Run it

```bash
# 1. Start the local stack (Postgres, Auth, Studio, ...). First run pulls images.
supabase start

# 2. Apply all migrations + seed, in lexical order, against a fresh db.
supabase db reset

# 3. Prove the consent gate.
node supabase/tests/consent_matrix.test.mjs
```

`supabase db reset` recreates the local database and re-applies everything in
`migrations/` in filename order (`0001` -> `0002` -> `0003`).

Local connection string (used by the test):
`postgresql://postgres:postgres@127.0.0.1:54322/postgres`

Studio: http://127.0.0.1:54323

## How the consent gate works

- Every new `auth.users` row auto-gets a `profiles` row via the
  `on_auth_user_created` trigger (`handle_new_user()`).
- `birth_data` and `charts` are **owner-only** — no sharing path at all.
- `gift_profiles`, `profiles`, and `offerings` are readable by the **owner**, or
  by any user who holds an **active consent grant** from the owner. The check is
  the `has_consent(target, viewer)` SQL function:

  ```sql
  select exists (
    select 1 from consents c
    where c.granter_id = target
      and c.grantee_id = viewer
      and c.revoked_at is null
  );
  ```

- A consent is an `consents` row (`granter_id` -> `grantee_id`). **Revoking** sets
  `revoked_at`, which immediately drops it out of `has_consent` and therefore out
  of every SELECT policy — no row deletion, full audit trail.
- A user can only create/modify consent rows **they granted** (`manage_own_consent`).
- `constellations`, `constellation_members`, and `constellation_reads` are visible
  to the constellation owner and its members (via SECURITY DEFINER helpers
  `is_constellation_owner` / `is_constellation_member`, which avoid RLS recursion).
- `framework_versions` is world-readable reference data with **no write policy**,
  so only the `service_role` key (which bypasses RLS) can load the real framework
  artifact later (the M0 loader).

## The consent matrix (what the test proves)

| # | Scenario                                   | Expected         |
|---|--------------------------------------------|------------------|
| a | A reads A's own gift_profile               | visible          |
| b | B reads A's gift_profile, no consent       | NOT visible      |
| c | B reads A's gift_profile after A grants    | visible          |
| d | B reads A's gift_profile after A revokes   | NOT visible      |

The test simulates end-users the same way PostgREST does — per transaction:

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"<user-uuid>","role":"authenticated"}';
```

so `auth.uid()` resolves to the simulated user and the real policies apply.
