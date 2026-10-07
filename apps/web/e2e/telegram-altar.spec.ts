import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { uniqueEmail, signup, signupAndRead } from "./helpers";

// Phase 2 on Telegram: the ritual invitation arrives, replying IS reflecting,
// and the altar commands work in chat.
const DB = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const tg = (fromId: number, text: string, replyTo?: string) => ({
  update_id: Date.now(),
  message: {
    message_id: Math.floor(Math.random() * 1e6), from: { id: fromId, is_bot: false, first_name: "T" }, chat: { id: fromId, type: "private" }, date: 0, text,
    ...(replyTo ? { reply_to_message: { message_id: replyTo } } : {}),
  },
});

test("telegram: invitation → reply-to-reflect → /prayer /ritual /inquiry /reflect /pulse", async ({ browser }) => {
  const admin = await (await browser.newContext()).newPage();
  const member = await (await browser.newContext()).newPage();
  const email = uniqueEmail("tgaltar");
  const tgId = (Date.now() % 1_000_000_000) + 7;
  await signup(admin, uniqueEmail("tgadmin"));
  await signupAndRead(member, email);
  await admin.goto("/curate");
  await admin.getByTestId("comp-email").fill(email);
  await admin.getByRole("button", { name: "Grant premium" }).click();
  await expect(admin.getByText(/Premium granted/)).toBeVisible();

  await member.goto("/settings");
  await member.getByRole("button", { name: "Connect Telegram" }).click();
  const code = (await member.getByTestId("bot-code").textContent())?.trim();
  let body = await (await member.request.post("/api/bot/telegram", { data: tg(tgId, `/start ${code}`) })).json();
  expect(body.kind).toBe("linked");

  // Kindle with Telegram as the channel.
  await member.goto("/altar/kindle");
  await member.getByLabel("Your prayer, in your own words").fill("May my life tend the commons with joy.");
  await member.locator('textarea[name="custom_work"]').fill("Building EcoDharma");
  await member.locator('input[name="channels"][value="telegram"]').check();
  await member.locator('input[name="channels"][value="email"]').uncheck();
  await member.getByRole("button", { name: "Light the altar" }).click();
  await member.waitForURL("**/altar?kindled=1");

  // The cron sends the weekly invitation on Telegram.
  body = await (await member.request.get("/api/cron/rituals?at=2026-10-05T12:00:00Z")).json();
  expect(body.invited).toContain(email);
  const db = new Client({ connectionString: DB });
  await db.connect();
  let msgId: string;
  try {
    const { rows } = await db.query(
      "select i.platform_message_id from invitations i join auth.users u on u.id=i.user_id where u.email=$1 and i.channel='telegram' order by i.id desc limit 1", [email]);
    msgId = rows[0].platform_message_id;
    expect(msgId).toBeTruthy();
  } finally { await db.end(); }

  // Reply to it → a sealed journal entry tied to the ritual.
  body = await (await member.request.post("/api/bot/telegram", { data: tg(tgId, "Building EcoDharma lit me up this week, I felt alive.", msgId) })).json();
  expect(body.kind).toBe("altar");
  expect(body.reply).toContain("sealed in your journal");
  expect(body.reply).toContain("Building EcoDharma");

  const db2 = new Client({ connectionString: DB });
  await db2.connect();
  try {
    const { rows } = await db2.query(
      `select r.source, r.cadence, r.ritual_id, i.reply_reflection_id from reflections r join auth.users u on u.id=r.user_id
         left join invitations i on i.reply_reflection_id = r.id where u.email=$1`, [email]);
    expect(rows[0].source).toBe("telegram");
    // Oct 5 2026: the Q4 quarterly (loop II) carries the moment; the weekly folds into it.
    expect(rows[0].cadence).toBe("quarterly");
    expect(rows[0].ritual_id).toBeTruthy();
    expect(rows[0].reply_reflection_id).toBeTruthy();
  } finally { await db2.end(); }

  body = await (await member.request.post("/api/bot/telegram", { data: tg(tgId, "/prayer") })).json();
  expect(body.reply).toContain("tend the commons with joy");
  body = await (await member.request.post("/api/bot/telegram", { data: tg(tgId, "/inquiry What would rest without guilt feel like?") })).json();
  expect(body.reply).toContain("Inquiry opened");
  body = await (await member.request.post("/api/bot/telegram", { data: tg(tgId, "/reflect The land walk cleared my head.") })).json();
  expect(body.reply).toContain("sealed");
  body = await (await member.request.post("/api/bot/telegram", { data: tg(tgId, "/ritual") })).json();
  expect(body.reply).toMatch(/⟲|Nothing is due/);
  body = await (await member.request.post("/api/bot/telegram", { data: tg(tgId, "/pulse") })).json();
  expect(body.reply).toMatch(/Dharma Constellation/);
  body = await (await member.request.post("/api/bot/telegram", { data: tg(tgId, "/help") })).json();
  expect(body.reply).toContain("/reflect");
  // Plain words still get the reflective companion.
  body = await (await member.request.post("/api/bot/telegram", { data: tg(tgId, "I feel stuck about my work.") })).json();
  expect(body.kind).toBe("reflection");
});
