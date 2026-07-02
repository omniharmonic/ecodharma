import "server-only";
import { randomBytes } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { withService } from "./db";
import { loadFramework } from "./framework";
import { loadVoice } from "./voice";
import { claudeMode } from "./config";
import { isPremium } from "./billing";
import { clip } from "./interpret-fixture";
import type { GiftProfile } from "./types";

// The reflection bot's platform-agnostic core. Transports (Telegram now, Slack
// later) are thin: they normalise an inbound message to { platform,
// platformUserId, text } and post back `reply`. Everything below is testable
// without any external service — Claude is used when available, else a grounded
// deterministic reflection.

const BOT_MODEL = process.env.ECODHARMA_BOT_MODEL || "claude-sonnet-4-6";
const LINK_TTL_MIN = 30;
const HISTORY_TURNS = 8;
const BOT_TIMEOUT_MS = 30_000;

export type BotReplyKind = "linked" | "needs_link" | "upsell" | "reflection" | "help" | "no_reading";
export type BotReply = { kind: BotReplyKind; reply: string };

type Reading = {
  profile: GiftProfile;
  recognition: string;
  archetypes: { name: string; how: string }[];
};

// --- account linking ----------------------------------------------------------

export async function createLinkCode(userId: string): Promise<string> {
  const code = randomBytes(6).toString("base64url"); // ~8 urlsafe chars
  await withService((c) =>
    c.query(
      "insert into bot_link_codes (code, user_id, expires_at) values ($1, $2, now() + make_interval(mins => $3))",
      [code, userId, LINK_TTL_MIN],
    ),
  );
  return code;
}

export async function userIdForBotAccount(platform: string, platformUserId: string): Promise<string | null> {
  return withService(async (c) => {
    const { rows } = await c.query(
      "select user_id from bot_accounts where platform = $1 and platform_user_id = $2",
      [platform, platformUserId],
    );
    return (rows[0]?.user_id as string | undefined) ?? null;
  });
}

/** Redeem a link code → bind (platform, platformUserId) to the user. */
async function consumeLinkCode(code: string, platform: string, platformUserId: string): Promise<string | null> {
  return withService(async (c) => {
    const { rows } = await c.query(
      "select user_id from bot_link_codes where code = $1 and used_at is null and expires_at > now()",
      [code],
    );
    const userId = rows[0]?.user_id as string | undefined;
    if (!userId) return null;
    await c.query("update bot_link_codes set used_at = now() where code = $1", [code]);
    await c.query(
      `insert into bot_accounts (platform, platform_user_id, user_id) values ($1, $2, $3)
       on conflict (platform, platform_user_id) do update set user_id = excluded.user_id`,
      [platform, platformUserId, userId],
    );
    return userId;
  });
}

// --- conversation memory ------------------------------------------------------

async function recordMessage(platform: string, platformUserId: string, role: "user" | "assistant", content: string) {
  await withService((c) =>
    c.query("insert into bot_messages (platform, platform_user_id, role, content) values ($1,$2,$3,$4)", [
      platform, platformUserId, role, content,
    ]),
  );
}

async function recentHistory(platform: string, platformUserId: string): Promise<{ role: "user" | "assistant"; content: string }[]> {
  return withService(async (c) => {
    const { rows } = await c.query(
      "select role, content from bot_messages where platform=$1 and platform_user_id=$2 order by created_at desc limit $3",
      [platform, platformUserId, HISTORY_TURNS * 2],
    );
    return rows.reverse().map((r) => ({ role: r.role as "user" | "assistant", content: r.content as string }));
  });
}

// --- reading load -------------------------------------------------------------

async function loadReading(userId: string): Promise<Reading | null> {
  const row = await withService(async (c) => {
    const { rows } = await c.query(
      "select content_json from gift_profiles where user_id=$1 and status='ready' order by generated_at desc limit 1",
      [userId],
    );
    return rows[0] as { content_json: GiftProfile } | undefined;
  });
  if (!row) return null;
  const fw = loadFramework();
  const giftName = (id: string) => fw.gifts.find((g) => g.id === id)?.name || id;
  const p = row.content_json;
  const archetypes = (p.gift_constellation || []).slice(0, 3).map((g) => ({
    name: giftName(g.gift_id),
    how: g.how_they_carry || "",
  }));
  return { profile: p, recognition: (p.recognition || "").trim(), archetypes };
}

// --- reflection ---------------------------------------------------------------

const REFLECT_DIRECTIVE =
  "You are a reflective companion inside EcoDharma. Reflect this specific person back to themselves using THEIR reading below — never generic advice, never a verdict, never a diagnosis. Be warm, brief (2–4 short paragraphs max), and specific to their gifts. Ask at most one good question. Ground everything in who they are; the framework is invisible scaffolding.";

function readingContext(r: Reading): string {
  const arche = r.archetypes.map((a) => `${a.name} — ${clip(a.how, 160)}`).join("; ");
  const shadow = (r.profile.shadow || []).slice(0, 3).join("; ");
  return [
    "THEIR READING (reflect from this):",
    `Recognition: ${clip(r.recognition, 400)}`,
    `Live archetypes: ${arche}`,
    shadow ? `Edges to hold gently: ${shadow}` : "",
    `Portrait: ${clip(r.profile.portrait || "", 700)}`,
  ].filter(Boolean).join("\n");
}

/** A grounded deterministic reflection — the fixture/no-key path. */
function fixtureReflection(r: Reading, text: string): string {
  const a = r.archetypes[0];
  const others = r.archetypes.slice(1).map((x) => x.name);
  const echo = clip(text, 90);
  return [
    `I hear you — "${echo}". What you're naming lands close to your ${a?.name || "core gift"}: ${clip(a?.how || r.recognition, 160)}`,
    others.length ? `Your ${others.join(" and ")} may be in the room too; notice which one wants to lead here.` : "",
    "A question to sit with: where in this is the work that's genuinely yours to do — and where might you be carrying what isn't?",
  ].filter(Boolean).join("\n\n");
}

async function generateReflection(
  r: Reading,
  history: { role: "user" | "assistant"; content: string }[],
  text: string,
): Promise<string> {
  if (!(await claudeMode())) return fixtureReflection(r, text);
  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create(
      {
        model: BOT_MODEL,
        max_tokens: 700,
        system: [
          { type: "text", text: loadVoice(), cache_control: { type: "ephemeral" } },
          { type: "text", text: `${REFLECT_DIRECTIVE}\n\n${readingContext(r)}`, cache_control: { type: "ephemeral" } },
        ] as any,
        messages: [...history, { role: "user" as const, content: text }],
      },
      { signal: AbortSignal.timeout(BOT_TIMEOUT_MS) },
    );
    const out = msg.content.filter((b) => b.type === "text").map((b: any) => b.text).join("").trim();
    return out || fixtureReflection(r, text);
  } catch {
    return fixtureReflection(r, text);
  }
}

// --- messages -----------------------------------------------------------------

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://ecodharma.vercel.app";

function connectMsg(): string {
  return `Welcome to EcoDharma. To reflect with your own profile, connect your account: open ${SITE}/settings, tap "Connect Telegram", and send me the code it gives you.`;
}
function welcome(): string {
  return "You're connected. I'm a reflective companion grounded in your EcoDharma reading — tell me what's alive for you, or what you're wrestling with, and I'll reflect it back through your gifts.";
}
function helpMsg(r: Reading): string {
  const names = r.archetypes.map((a) => a.name).join(", ") || "your gifts";
  return `I reflect you back through your reading (${names}). Just write to me — a situation, a question, a decision — and I'll help you sense into the work that's yours. Nothing here is advice or a verdict.`;
}

function extractCode(text: string): string | null {
  const start = text.match(/^\/start\s+(\S+)/i);
  if (start) return start[1];
  const bare = text.match(/^([A-Za-z0-9_-]{6,14})$/);
  return bare ? bare[1] : null;
}

/** Reflect for an ALREADY-authenticated user (used by the hosted MCP, which does
 *  its own auth + premium gate). Stateless — no stored history. */
export async function reflectForUser(userId: string, text: string): Promise<string> {
  const reading = await loadReading(userId);
  if (!reading) return "No reading found yet — complete one at ecodharma first.";
  return generateReflection(reading, [], text);
}

/** A compact, safe summary of a user's reading (for the MCP `my_reading` tool). */
export async function readingSummaryForUser(
  userId: string,
): Promise<{ recognition: string; archetypes: { name: string; how: string }[]; portrait: string } | null> {
  const reading = await loadReading(userId);
  if (!reading) return null;
  return { recognition: reading.recognition, archetypes: reading.archetypes, portrait: clip(reading.profile.portrait || "", 1200) };
}

/** The orchestration: identity → premium gate → reflection. */
export async function handleBotMessage(input: {
  platform: string;
  platformUserId: string;
  text: string;
}): Promise<BotReply> {
  const text = (input.text || "").trim();
  const linked = await userIdForBotAccount(input.platform, input.platformUserId);

  if (!linked) {
    const code = extractCode(text);
    if (code) {
      const uid = await consumeLinkCode(code, input.platform, input.platformUserId);
      if (uid) return { kind: "linked", reply: welcome() };
      return { kind: "needs_link", reply: "That code is invalid or expired — generate a fresh one from your EcoDharma settings." };
    }
    return { kind: "needs_link", reply: connectMsg() };
  }

  if (!(await isPremium(linked))) {
    return {
      kind: "upsell",
      reply: `Continuous reflection is a premium companion. Upgrade at ${SITE}/settings to talk with your profile any time.`,
    };
  }

  const reading = await loadReading(linked);
  if (!reading) {
    return { kind: "no_reading", reply: `I can't find your reading yet — complete one at ${SITE}, then come back.` };
  }

  if (/^\/(start|help)\b/.test(text) || !text) {
    return { kind: "help", reply: helpMsg(reading) };
  }

  const history = await recentHistory(input.platform, input.platformUserId);
  const reply = await generateReflection(reading, history, text);
  await recordMessage(input.platform, input.platformUserId, "user", text);
  await recordMessage(input.platform, input.platformUserId, "assistant", reply);
  return { kind: "reflection", reply };
}
