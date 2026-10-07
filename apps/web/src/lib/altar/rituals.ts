import "server-only";
import { withService, withUser } from "../db";
import { inviteUser } from "../invitations";
import { carrying, dueRituals, folds, type Due, type Prefs, type Threshold } from "./cycles";

// The ritual engine (server): thresholds from the ephemeris, per-person solar
// returns, due rituals → rows (idempotent), and the cron that sends ONE
// invitation for the deepest ritual whose moment has arrived.

const EPHEMERIS = () => process.env.EPHEMERIS_URL || "http://127.0.0.1:8000";

async function fetchCycles(year: number, lat: number, natalSunLon?: number): Promise<any | null> {
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (process.env.EPHEMERIS_TOKEN) headers.authorization = `Bearer ${process.env.EPHEMERIS_TOKEN}`;
    const r = await fetch(`${EPHEMERIS()}/cycles`, { method: "POST", headers, body: JSON.stringify({ year, lat, natal_sun_lon: natalSunLon ?? null }), cache: "no-store" });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Cache equinoxes/solstices + lunations for a hemisphere/year in ritual_thresholds. */
export async function ensureThresholds(year: number, hemisphere: "N" | "S"): Promise<void> {
  const have = await withService(async (c) => (await c.query("select 1 from ritual_thresholds where year=$1 and hemisphere=$2 limit 1", [year, hemisphere])).rowCount);
  if (have) return;
  const data = await fetchCycles(year, hemisphere === "N" ? 40 : -40);
  if (!data) return;
  await withService(async (c) => {
    for (const t of [...data.seasons, ...data.moons]) {
      await c.query("insert into ritual_thresholds (year, hemisphere, kind, label, at) values ($1,$2,$3,$4,$5) on conflict do nothing", [year, hemisphere, t.kind, t.label, t.at]);
    }
  });
}

async function thresholdsFor(hemisphere: "N" | "S", now: number): Promise<Threshold[]> {
  const y = new Date(now).getUTCFullYear();
  await ensureThresholds(y - 1, hemisphere);
  await ensureThresholds(y, hemisphere);
  await ensureThresholds(y + 1, hemisphere);
  return withService(async (c) => {
    const { rows } = await c.query("select kind, label, at from ritual_thresholds where hemisphere=$1 and year between $2 and $3 order by at", [hemisphere, y - 1, y + 1]);
    return rows.map((r) => ({ kind: r.kind, label: r.label, at: new Date(r.at).toISOString() }));
  });
}

/** Exact solar returns (Sun back at its natal longitude) — cached in profile settings. */
async function solarReturns(userId: string, now: number): Promise<string[]> {
  const row = await withService(async (c) => (await c.query(
    `select p.settings->'solar_returns' as sr, (select raw_json->'positions'->'Sun'->>'lon' from charts where user_id=p.id and modality='western') as sun
       from profiles p where p.id=$1`, [userId])).rows[0]);
  if (!row?.sun) return [];
  const cache: Record<string, string> = row.sr || {};
  const y = new Date(now).getUTCFullYear();
  let changed = false;
  for (const year of [y - 1, y]) {
    if (cache[year]) continue;
    const d = await fetchCycles(year, 40, Number(row.sun));
    if (d?.solar_return?.at) { cache[year] = d.solar_return.at; changed = true; }
  }
  if (changed) {
    await withService((c) => c.query("update profiles set settings = jsonb_set(coalesce(settings,'{}'::jsonb), '{solar_returns}', $2::jsonb, true) where id=$1", [userId, JSON.stringify(cache)]));
  }
  return Object.values(cache);
}

async function prefsOf(userId: string): Promise<Prefs & { channels: string[] } | null> {
  return withService(async (c) => {
    const { rows } = await c.query("select * from ritual_prefs where user_id=$1", [userId]);
    return (rows[0] as any) ?? null;
  });
}

async function upsertRituals(userId: string, due: Due[]): Promise<Map<string, { id: number; done: boolean; invited: boolean }>> {
  return withService(async (c) => {
    const out = new Map<string, { id: number; done: boolean; invited: boolean }>();
    for (const d of due) {
      const { rows } = await c.query(
        `insert into rituals (user_id, cadence, depth, due_at, threshold_label) values ($1,$2,$3,$4,$5)
         on conflict (user_id, cadence, due_at) do update set threshold_label = excluded.threshold_label
         returning id, completed_reflection_id, invited_at`,
        [userId, d.cadence, d.depth, d.due_at, d.label]);
      out.set(`${d.cadence}@${d.due_at}`, { id: Number(rows[0].id), done: !!rows[0].completed_reflection_id, invited: !!rows[0].invited_at });
    }
    return out;
  });
}

async function computeDue(userId: string, now: number) {
  const prefs = await prefsOf(userId);
  if (!prefs) return null;
  const [th, sr] = await Promise.all([thresholdsFor(prefs.hemisphere, now), solarReturns(userId, now)]);
  const due = dueRituals(prefs, th, sr, now);
  const rows = await upsertRituals(userId, due);
  return { prefs, due, rows };
}

/** For the dashboard: the ritual to begin now (deepest, open, not completed). */
export async function dueRitualFor(userId: string, now = Date.now()): Promise<{ id: number; cadence: string; label: string; depth: number } | null> {
  try {
    const r = await computeDue(userId, now);
    if (!r) return null;
    const done = new Set([...r.rows].filter(([, v]) => v.done).map(([k]) => k));
    // Completing the carrier also completes what it folded.
    const top = r.due.find((d) => !done.has(`${d.cadence}@${d.due_at}`));
    if (!top) return null;
    const row = r.rows.get(`${top.cadence}@${top.due_at}`)!;
    return { id: row.id, cadence: top.cadence, label: top.label, depth: top.depth };
  } catch (e) {
    console.error("[rituals] dueRitualFor failed:", (e as Error).message);
    return null;
  }
}

export async function getRitual(userId: string, id: number) {
  return withUser(userId, async (c) => {
    const { rows } = await c.query("select * from rituals where id=$1 and user_id=auth.uid()", [id]);
    return rows[0] ? { id: Number(rows[0].id), cadence: rows[0].cadence, depth: rows[0].depth, label: rows[0].threshold_label || rows[0].cadence, due_at: new Date(rows[0].due_at).toISOString(), done: !!rows[0].completed_reflection_id } : null;
  });
}

/** Mark the folded (shallower) rituals done along with their carrier. */
export async function completeFolded(userId: string, reflectionId: number, now = Date.now()) {
  const r = await computeDue(userId, now);
  if (!r) return;
  for (const f of folds(r.due)) {
    const row = r.rows.get(`${f.cadence}@${f.due_at}`);
    if (row && !row.done) await withService((c) => c.query("update rituals set completed_reflection_id=$2 where id=$1 and completed_reflection_id is null", [row.id, reflectionId]));
  }
}

/** The hourly job. Sends at most ONE invitation per person per moment. */
export async function runRitualsCron(now = Date.now()): Promise<{ people: number; invited: string[]; skipped: number }> {
  const people = await withService(async (c) => (await c.query(
    `select rp.user_id, u.email from ritual_prefs rp join auth.users u on u.id = rp.user_id
      where coalesce((select settings->>'nudges' from profiles where id = rp.user_id), 'on') <> 'off'`)).rows);
  const invited: string[] = [];
  let skipped = 0;
  for (const p of people) {
    const r = await computeDue(p.user_id, now);
    if (!r) continue;
    const done = new Set([...r.rows].filter(([, v]) => v.done).map(([k]) => k));
    const inv = new Set([...r.rows].filter(([, v]) => v.invited).map(([k]) => k));
    const pick = carrying(r.due, done, inv);
    // Only send once the person's local send time has arrived for that ritual.
    if (!pick || Date.parse(pick.due_at) > now) { skipped++; continue; }
    // A weekly invitation is only worth sending within 2 days of its moment.
    if (pick.cadence === "weekly" && now - Date.parse(pick.due_at) > 2 * 86_400_000) { skipped++; continue; }
    const row = r.rows.get(`${pick.cadence}@${pick.due_at}`)!;
    const out = await inviteUser(p.user_id, {
      cadence: pick.cadence, depth: pick.depth, thresholdLabel: pick.cadence === "weekly" ? undefined : pick.label,
      ritualId: row.id, channels: r.prefs.channels, email: p.email,
    });
    await withService((c) => c.query("update rituals set invited_at = now() where id = $1", [row.id]));
    if (out) invited.push(p.email);
  }
  return { people: people.length, invited, skipped };
}
