import { createHmac, timingSafeEqual } from "node:crypto";
import { handleBotMessage } from "@/lib/bot";

// Slack Events API webhook — the same reflection core as Telegram, a different
// transport. Env-gated on SLACK_BOT_TOKEN; signature-verified when
// SLACK_SIGNING_SECRET is set. A DM reflects 1:1; an @-mention in a channel
// invites perspective-taking (grounded in the mentioner's own reading).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = process.env.SLACK_BOT_TOKEN;
const SIGNING = process.env.SLACK_SIGNING_SECRET;
const TEST = process.env.ECODHARMA_BOT_TEST === "1";

function verifySlack(raw: string, ts: string | null, sig: string | null): boolean {
  if (!SIGNING) return true; // not configured → skip (dev/test)
  if (!ts || !sig) return false;
  // Reject stale timestamps (>5 min) to blunt replay.
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const base = `v0:${ts}:${raw}`;
  const mine = `v0=${createHmac("sha256", SIGNING).update(base).digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(mine), Buffer.from(sig));
  } catch {
    return false;
  }
}

async function postSlack(channel: string, text: string) {
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ channel, text }),
  });
}

function stripMention(text: string): string {
  return (text || "").replace(/<@[^>]+>/g, "").trim();
}

export async function POST(req: Request) {
  const raw = await req.text();
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ ok: false, error: "bad json" });
  }

  // Slack's one-time endpoint verification.
  if (payload.type === "url_verification") {
    return Response.json({ challenge: payload.challenge });
  }

  if (!TOKEN && !TEST) return Response.json({ ok: false, disabled: true });
  if (!verifySlack(raw, req.headers.get("x-slack-request-timestamp"), req.headers.get("x-slack-signature"))) {
    return new Response("bad signature", { status: 403 });
  }

  const event = payload.event;
  // Ignore non-messages, edits, and the bot's own posts (avoid loops).
  if (!event || event.bot_id || event.subtype) return Response.json({ ok: true });
  if (event.type !== "message" && event.type !== "app_mention") return Response.json({ ok: true });
  const platformUserId = event.user;
  if (!platformUserId) return Response.json({ ok: true });

  const result = await handleBotMessage({
    platform: "slack",
    platformUserId: String(platformUserId),
    text: stripMention(event.text || ""),
  });

  if (TOKEN && event.channel) await postSlack(event.channel, result.reply);
  return Response.json(TEST ? { ok: true, kind: result.kind, reply: result.reply } : { ok: true });
}
