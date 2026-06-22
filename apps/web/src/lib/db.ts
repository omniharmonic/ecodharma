import "server-only";
import { Pool, type PoolClient } from "pg";

// Single shared pool (server-only). Connects as the cluster superuser; we drop
// privileges per request via `SET LOCAL ROLE authenticated` so Postgres RLS —
// and therefore the consent gate — applies exactly as it does on hosted Supabase.
const globalForPg = globalThis as unknown as { _ecoPool?: Pool };

export function pool(): Pool {
  if (!globalForPg._ecoPool) {
    globalForPg._ecoPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    });
  }
  return globalForPg._ecoPool;
}

/**
 * Run queries AS a specific authenticated end-user. Opens a transaction, sets
 * the `authenticated` role + JWT claims (sub = userId), so auth.uid() resolves
 * to this user and every RLS policy is enforced. This is the ONLY way the app
 * reads another person's data — and RLS guarantees consent.
 */
export async function withUser<T>(
  userId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Run privileged queries (RLS bypassed) — for signup, auth lookups, and loading
 * the framework artifact. Mirrors Supabase's service_role. Never expose to clients.
 */
export async function withService<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
