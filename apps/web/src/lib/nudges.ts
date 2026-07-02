import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { withService } from "./db";
import { loadFramework } from "./framework";
import { loadVoice } from "./voice";
import { claudeMode } from "./config";
import { clip } from "./interpret-fixture";
import { sendEmail, emailEnabled, htmlEmail } from "./email";
import { unsubscribeToken } from "./unsubscribe";
import type { GiftProfile } from "./types";

// Weekly "dharma nudges" — a small, strengths-playing prompt grounded in the
// member's reading. Claude writes a fresh one when available; otherwise we
// surface one of their trim-tabs (already personalised) as the nudge.

const NUDGE_MODEL = process.env.ECODHARMA_BOT_MODEL || "claude-sonnet-4-6";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://ecodharma.vercel.app";

export type NudgeRow = { body: string; created_at: Date };

export async function latestNudge(userId: string): Promise<NudgeRow | null> {
  return withService(async (c) => {
    const { rows } = await c.query(
      "select body, created_at from nudges where user_id=$1 order by created_at desc limit 1",
      [userId],
    );
    return (rows[0] as NudgeRow | undefined) ?? null;
  });
}

async function nudgeCount(userId: string): Promise<number> {
  return withService(async (c) => {
    const { rows } = await c.query("select count(*)::int as n from nudges where user_id=$1", [userId]);
    return rows[0].n as number;
  });
}

async function recordNudge(userId: string, body: string) {
  await withService((c) => c.query("insert into nudges (user_id, body) values ($1,$2)", [userId, body]));
}

/** A deterministic, personalised nudge from the reading's own trim-tabs. */
function fixtureNudge(profile: GiftProfile, index: number): string {
  const fw = loadFramework();
  const giftName = (id: string) => fw.gifts.find((g) => g.id === id)?.name || id;
  const domainName = (id: string) => fw.domains.find((d) => d.id === id)?.name || id;
  const tabs = profile.trim_tabs || [];
  const lead = (profile.gift_constellation || [])[0];
  const arche = lead ? giftName(lead.gift_id) : "your gift";
  if (tabs.length) {
    const tt = tabs[index % tabs.length];
    return [
      `A small lever this week — playing to your ${arche}:`,
      tt.action,
      tt.upward_spiral ? `Why it compounds: ${clip(tt.upward_spiral, 220)}` : "",
      tt.domain_id ? `(in the world-work of ${domainName(tt.domain_id)})` : "",
    ].filter(Boolean).join("\n\n");
  }
  return `This week, take one small action that only your ${arche} could take — the kind that leaves your corner of the world a little more alive. ${clip(profile.recognition || "", 160)}`;
}

async function claudeNudge(profile: GiftProfile): Promise<string | null> {
  if (!(await claudeMode())) return null;
  try {
    const arche = (profile.gift_constellation || []).map((g) => g.gift_id).join(", ");
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create(
      {
        model: NUDGE_MODEL,
        max_tokens: 350,
        system: [
          { type: "text", text: loadVoice(), cache_control: { type: "ephemeral" } },
          {
            type: "text",
            text:
              "Write ONE short weekly 'dharma nudge' (3–5 sentences) for this person: a concrete, inspiring, doable invitation this week that plays to their strengths and nudges them toward their dharma / the Great Turning. Warm, specific, never generic, no preamble.",
          },
        ] as any,
        messages: [
          {
            role: "user",
            content: `Recognition: ${clip(profile.recognition || "", 400)}\nArchetypes: ${arche}\nPortrait: ${clip(profile.portrait || "", 600)}`,
          },
        ],
      },
      { signal: AbortSignal.timeout(30_000) },
    );
    const out = msg.content.filter((b) => b.type === "text").map((b: any) => b.text).join("").trim();
    return out || null;
  } catch {
    return null;
  }
}

export async function generateNudge(userId: string, profile: GiftProfile): Promise<string> {
  const viaClaude = await claudeNudge(profile);
  if (viaClaude) return viaClaude;
  const index = await nudgeCount(userId);
  return fixtureNudge(profile, index);
}

type CohortMember = { userId: string; email: string; profile: GiftProfile };

/** Premium, opted-in members who have a ready reading. */
async function nudgeCohort(): Promise<CohortMember[]> {
  return withService(async (c) => {
    const { rows } = await c.query(
      `select p.id as user_id, u.email, gp.content_json
         from profiles p
         join auth.users u on u.id = p.id
         join lateral (
           select content_json from gift_profiles g
            where g.user_id = p.id and g.status = 'ready'
            order by generated_at desc limit 1
         ) gp on true
        where p.plan = 'premium'
          and (p.current_period_end is null or p.current_period_end > now())
          and coalesce(p.settings->>'nudges', 'on') <> 'off'`,
    );
    return rows.map((r) => ({ userId: r.user_id as string, email: r.email as string, profile: r.content_json as GiftProfile }));
  });
}

/** The weekly job: generate + record + (if configured) email a nudge to each member. */
export async function runWeeklyNudges(): Promise<{ count: number; emailed: number; processed: string[] }> {
  const cohort = await nudgeCohort();
  let emailed = 0;
  const processed: string[] = [];
  for (const m of cohort) {
    const body = await generateNudge(m.userId, m.profile);
    await recordNudge(m.userId, body);
    if (emailEnabled()) {
      const unsub = `${SITE}/api/unsubscribe?u=${await unsubscribeToken(m.userId)}`;
      const ok = await sendEmail({
        to: m.email,
        subject: "Your weekly dharma nudge",
        text: `${body}\n\n—\nReflect deeper any time: ${SITE}\nUnsubscribe: ${unsub}`,
        html: htmlEmail({ heading: "Your weekly dharma nudge", body, siteUrl: SITE, unsubscribeUrl: unsub }),
        listUnsubscribe: unsub,
      });
      if (ok) emailed += 1;
    }
    processed.push(m.email);
  }
  return { count: cohort.length, emailed, processed };
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
