import { handleBotMessage } from "@/lib/bot";

// Telegram webhook. Telegram POSTs an Update; we normalise it, run the shared
// bot core, and reply via the Bot API. Env-gated on TELEGRAM_BOT_TOKEN so the
// route is inert (and the app builds/deploys) until a bot is configured.
//
// A webhook secret (X-Telegram-Bot-Api-Secret-Token, set when registering the
// webhook) guards against spoofed calls.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
// Test seam: when set, skip the outbound Telegram call and return the reply in
// the response body so e2e can drive the full pipeline without a live bot.
const TEST = process.env.ECODHARMA_BOT_TEST === "1";

async function sendTelegram(chatId: number | string, text: string) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export async function POST(req: Request) {
  if (!TOKEN && !TEST) {
    // Not configured — acknowledge so Telegram doesn't retry, but do nothing.
    return Response.json({ ok: false, disabled: true });
  }
  if (SECRET && req.headers.get("x-telegram-bot-api-secret-token") !== SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return Response.json({ ok: false, error: "bad json" });
  }

  const msg = update?.message ?? update?.edited_message;
  const fromId = msg?.from?.id;
  const chatId = msg?.chat?.id;
  const text: string = msg?.text ?? "";
  if (fromId == null || chatId == null) {
    return Response.json({ ok: true, skipped: "no message" });
  }

  const result = await handleBotMessage({
    platform: "telegram",
    platformUserId: String(fromId),
    text,
  });

  if (TOKEN) await sendTelegram(chatId, result.reply);

  // In test mode, surface the computed reply so the pipeline is assertable.
  return Response.json(TEST ? { ok: true, kind: result.kind, reply: result.reply } : { ok: true });
}
