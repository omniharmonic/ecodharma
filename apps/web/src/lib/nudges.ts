import "server-only";
import { withService } from "./db";
import { inviteUser, latestInvitation } from "./invitations";

// Weekly "dharma nudges" — now INVITATIONS (lib/invitations.ts): grounded in the
// person's altar + reading, checked by a grounding contract before anything is
// sent. This module keeps the legacy entry points (cron route, settings page)
// and the opt-out preference.
//
// The old implementation reused the READING system prompt with three clipped
// fragments, so Claude replied "I need the person's Ikigai words…" — and that
// meta-reply was emailed (Aug 24, Sep 14, Sep 28 2026). See invitation-core.ts.

export type NudgeRow = { body: string; created_at: Date };

export async function latestNudge(userId: string): Promise<NudgeRow | null> {
  const inv = await latestInvitation(userId);
  if (inv) return inv;
  return withService(async (c) => {
    const { rows } = await c.query(
      "select body, created_at from nudges where user_id=$1 order by created_at desc limit 1",
      [userId],
    );
    return (rows[0] as NudgeRow | undefined) ?? null;
  });
}

type CohortMember = { userId: string; email: string };

/** Premium (or altar-access), opted-in members who have a ready reading. */
async function nudgeCohort(): Promise<CohortMember[]> {
  return withService(async (c) => {
    const { rows } = await c.query(
      `select p.id as user_id, u.email
         from profiles p
         join auth.users u on u.id = p.id
        where p.plan = 'premium'
          and (p.current_period_end is null or p.current_period_end > now())
          and coalesce(p.settings->>'nudges', 'on') <> 'off'
          and exists (select 1 from gift_profiles g where g.user_id = p.id and g.status = 'ready')
          -- people with ritual prefs are served by the rituals cron on THEIR schedule
          and not exists (select 1 from ritual_prefs rp where rp.user_id = p.id)`,
    );
    return rows.map((r) => ({ userId: r.user_id as string, email: r.email as string }));
  });
}

/** The weekly job: one grounded invitation per member (email). */
export async function runWeeklyNudges(): Promise<{ count: number; emailed: number; processed: string[]; skipped: string[] }> {
  const cohort = await nudgeCohort();
  let emailed = 0;
  const processed: string[] = [];
  const skipped: string[] = [];
  for (const m of cohort) {
    const out = await inviteUser(m.userId, { cadence: "weekly", depth: 1, channels: ["email"], email: m.email });
    if (!out) {
      skipped.push(m.email);
      continue;
    }
    if (out.delivered.includes("email")) emailed += 1;
    processed.push(m.email);
  }
  return { count: cohort.length, emailed, processed, skipped };
}

/** Toggle a member's weekly-nudge preference (stored in profiles.settings). */
export async function setNudgesEnabled(userId: string, on: boolean): Promise<void> {
  await withService((c) =>
    c.query(
      "update profiles set settings = jsonb_set(coalesce(settings,'{}'::jsonb), '{nudges}', $2::jsonb, true) where id = $1",
      [userId, JSON.stringify(on ? "on" : "off")],
    ),
  );
}

export async function nudgesEnabled(userId: string): Promise<boolean> {
  return withService(async (c) => {
    const { rows } = await c.query("select coalesce(settings->>'nudges','on') as v from profiles where id=$1", [userId]);
    return (rows[0]?.v ?? "on") !== "off";
  });
}
