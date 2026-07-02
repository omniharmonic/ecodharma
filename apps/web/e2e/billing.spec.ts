import { test, expect } from "@playwright/test";
import { uniqueEmail, signup, signupAndRead } from "./helpers";

test("premium: free by default; admin can comp premium; member then sees it", async ({ browser }) => {
  const adminEmail = uniqueEmail("admin");
  const memberEmail = uniqueEmail("member");

  const adminCtx = await browser.newContext();
  const memberCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  const member = await memberCtx.newPage();

  // Admin needs an account (ECODHARMA_ADMIN_EMAILS is unset in e2e → any user is a steward).
  await signup(admin, adminEmail);
  // Member signs up (must exist for the email lookup) and takes a reading.
  await signupAndRead(member, memberEmail);

  // Free by default — Stripe is off in e2e, so the upsell shows "opening soon".
  await member.goto("/settings");
  await expect(member.getByTestId("plan-badge")).toHaveAttribute("data-plan", "free");
  await expect(member.getByTestId("premium-soon")).toBeVisible();

  // Admin comps premium to the member by email.
  await admin.goto("/curate");
  await admin.getByTestId("comp-email").fill(memberEmail);
  await admin.getByRole("button", { name: "Grant premium" }).click();
  await expect(admin.getByText(new RegExp(`Premium granted to ${memberEmail}`))).toBeVisible();

  // Member now reads as premium.
  await member.reload();
  await expect(member.getByTestId("plan-badge")).toHaveAttribute("data-plan", "premium");
  await expect(member.getByTestId("premium-soon")).toHaveCount(0);

  // Revoke → back to free.
  await admin.getByRole("textbox", { name: "Revoke member email" }).fill(memberEmail);
  await admin.getByRole("button", { name: "Revoke premium" }).click();
  await expect(admin.getByText(new RegExp(`Premium revoked from ${memberEmail}`))).toBeVisible();
  await member.reload();
  await expect(member.getByTestId("plan-badge")).toHaveAttribute("data-plan", "free");

  await adminCtx.close();
  await memberCtx.close();
});
