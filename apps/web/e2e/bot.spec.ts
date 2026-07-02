import { test, expect } from "@playwright/test";
import { uniqueEmail, signup, signupAndRead } from "./helpers";

// The Telegram webhook runs in test mode (ECODHARMA_BOT_TEST=1) — it returns the
// computed reply instead of calling Telegram, so the whole pipeline is assertable.
function tgUpdate(fromId: number, text: string) {
  return {
    update_id: fromId,
    message: {
      message_id: 1,
      from: { id: fromId, is_bot: false, first_name: "Tester" },
      chat: { id: fromId, type: "private" },
      date: 0,
      text,
    },
  };
}

test("telegram bot: connect → premium reflection → upsell when not premium", async ({ browser }) => {
  const adminEmail = uniqueEmail("botadmin");
  const memberEmail = uniqueEmail("botmember");
  const tgId = Date.now() % 1_000_000_000;

  const adminCtx = await browser.newContext();
  const memberCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  const member = await memberCtx.newPage();

  await signup(admin, adminEmail);
  await signupAndRead(member, memberEmail);

  // 1) An unknown Telegram account is asked to connect.
  let res = await member.request.post("/api/bot/telegram", { data: tgUpdate(tgId, "hi there") });
  let body = await res.json();
  expect(body.kind).toBe("needs_link");

  // 2) Comp premium to the member, then generate a link code from settings.
  await admin.goto("/curate");
  await admin.getByTestId("comp-email").fill(memberEmail);
  await admin.getByRole("button", { name: "Grant premium" }).click();
  await expect(admin.getByText(new RegExp(`Premium granted to ${memberEmail}`))).toBeVisible();

  await member.goto("/settings");
  await member.getByRole("button", { name: "Connect Telegram" }).click();
  const code = (await member.getByTestId("bot-code").textContent())?.trim();
  expect(code).toBeTruthy();

  // 3) Redeem the code from Telegram → account linked.
  res = await member.request.post("/api/bot/telegram", { data: tgUpdate(tgId, `/start ${code}`) });
  body = await res.json();
  expect(body.kind).toBe("linked");

  // 4) A real message → a grounded reflection (fixture engine in e2e).
  res = await member.request.post("/api/bot/telegram", { data: tgUpdate(tgId, "I feel stuck about my work.") });
  body = await res.json();
  expect(body.kind).toBe("reflection");
  expect(body.reply).toContain("I hear you");
  expect(body.reply).toMatch(/work that's genuinely yours/i);

  // 5) Revoke premium → the same account now hits the upsell gate.
  await admin.getByRole("textbox", { name: "Revoke member email" }).fill(memberEmail);
  await admin.getByRole("button", { name: "Revoke premium" }).click();
  await expect(admin.getByText(new RegExp(`Premium revoked from ${memberEmail}`))).toBeVisible();

  res = await member.request.post("/api/bot/telegram", { data: tgUpdate(tgId, "another thought") });
  body = await res.json();
  expect(body.kind).toBe("upsell");

  await adminCtx.close();
  await memberCtx.close();
});
