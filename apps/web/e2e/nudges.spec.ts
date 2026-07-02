import { test, expect } from "@playwright/test";
import { uniqueEmail, signup, signupAndRead } from "./helpers";

// The cron runs in test mode (returns per-user detail) and, with no RESEND key,
// records nudges without sending email.
test("weekly nudges: premium members are nudged; opting out excludes them", async ({ browser }) => {
  const adminEmail = uniqueEmail("nudgeadmin");
  const memberEmail = uniqueEmail("nudgemember");

  const adminCtx = await browser.newContext();
  const memberCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  const member = await memberCtx.newPage();

  await signup(admin, adminEmail);
  await signupAndRead(member, memberEmail);

  // Comp premium.
  await admin.goto("/curate");
  await admin.getByTestId("comp-email").fill(memberEmail);
  await admin.getByRole("button", { name: "Grant premium" }).click();
  await expect(admin.getByText(new RegExp(`Premium granted to ${memberEmail}`))).toBeVisible();

  // Run the weekly job → the member is processed + a nudge is recorded.
  let res = await member.request.get("/api/cron/nudges");
  let body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.processed).toContain(memberEmail);

  // The nudge is visible back in settings.
  await member.goto("/settings");
  await expect(member.getByTestId("latest-nudge")).toBeVisible();
  await expect(member.getByTestId("nudge-status")).toHaveAttribute("data-on", "yes");

  // Opt out → excluded from the next run.
  await member.getByRole("button", { name: "Pause weekly nudges" }).click();
  await expect(member.getByTestId("nudge-status")).toHaveAttribute("data-on", "no");

  res = await member.request.get("/api/cron/nudges");
  body = await res.json();
  expect(body.processed).not.toContain(memberEmail);

  await adminCtx.close();
  await memberCtx.close();
});
