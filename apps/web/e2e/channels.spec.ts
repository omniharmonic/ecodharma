import { test, expect } from "@playwright/test";
import { uniqueEmail, signup, signupAndRead } from "./helpers";

test("slack transport shares the bot core (challenge + connect prompt)", async ({ page }) => {
  // Slack's one-time endpoint verification is echoed back.
  const challenge = `c_${Date.now()}`;
  let res = await page.request.post("/api/bot/slack", { data: { type: "url_verification", challenge } });
  expect((await res.json()).challenge).toBe(challenge);

  // A DM from an unknown Slack user gets the same "connect your account" reply.
  res = await page.request.post("/api/bot/slack", {
    data: {
      type: "event_callback",
      event: { type: "message", user: `U${Date.now()}`, text: "hi there", channel: "D1" },
    },
  });
  expect((await res.json()).kind).toBe("needs_link");
});

test("hosted MCP: premium member reflects with their reading over JSON-RPC", async ({ browser }) => {
  const adminEmail = uniqueEmail("mcpadmin");
  const memberEmail = uniqueEmail("mcpmember");

  const adminCtx = await browser.newContext();
  const memberCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  const member = await memberCtx.newPage();

  await signup(admin, adminEmail);
  await signupAndRead(member, memberEmail);

  await admin.goto("/curate");
  await admin.getByTestId("comp-email").fill(memberEmail);
  await admin.getByRole("button", { name: "Grant premium" }).click();
  await expect(admin.getByText(new RegExp(`Premium granted to ${memberEmail}`))).toBeVisible();

  // Member mints an MCP token.
  await member.goto("/settings");
  await member.getByRole("button", { name: "Generate MCP token" }).click();
  const token = (await member.getByTestId("mcp-token").textContent())?.trim();
  expect(token).toBeTruthy();

  const rpc = (id: number, method: string, params?: any) =>
    member.request.post("/api/mcp", {
      headers: { authorization: `Bearer ${token}` },
      data: { jsonrpc: "2.0", id, method, ...(params ? { params } : {}) },
    });

  // initialize → server identifies itself.
  let res = await rpc(1, "initialize");
  let body = await res.json();
  expect(body.result.serverInfo.name).toBe("ecodharma");

  // tools/list → the reflection tools are present.
  res = await rpc(2, "tools/list");
  body = await res.json();
  const names = body.result.tools.map((t: any) => t.name);
  expect(names).toContain("reflect");
  expect(names).toContain("my_reading");

  // tools/call my_reading → returns their actual reading text.
  res = await rpc(3, "tools/call", { name: "my_reading", arguments: {} });
  body = await res.json();
  expect(body.result.content[0].text.length).toBeGreaterThan(40);

  // tools/call reflect → a grounded reflection.
  res = await rpc(4, "tools/call", { name: "reflect", arguments: { message: "I feel scattered lately." } });
  body = await res.json();
  expect(body.result.content[0].text).toMatch(/I hear you/);

  // No token → unauthorized.
  const anon = await member.request.post("/api/mcp", { data: { jsonrpc: "2.0", id: 9, method: "initialize" } });
  expect(anon.status()).toBe(401);

  await adminCtx.close();
  await memberCtx.close();
});
