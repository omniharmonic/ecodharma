import { test, expect } from "@playwright/test";
import { signup, uniqueEmail } from "./helpers";

// Tiered access: a steward mints an unlock code; a friend redeems it and is
// upgraded from the free (fixture) tier to the Claude tier. In e2e the admin
// allowlist is unset, so any signed-in user may mint (prototype behaviour).
test("mint an unlock code, then redeem it to upgrade tier", async ({ page }) => {
  await signup(page, uniqueEmail("steward"));

  // Mint a code on the curation surface.
  await page.goto("/curate");
  await page.getByLabel("Code note").fill("for a friend");
  await page.getByRole("button", { name: "Mint a code" }).click();

  // The minted code is echoed back; pull it out of the status line.
  const minted = page.getByText("Code minted:");
  await expect(minted).toBeVisible();
  const code = (await minted.innerText()).replace("Code minted:", "").trim();
  expect(code).toMatch(/^[a-z]+-[a-z]+-\d{4}$/);
  await expect(page.getByTestId("unlock-code-row").filter({ hasText: code })).toHaveCount(1);

  // Before redeeming, settings shows the free tier.
  await page.goto("/settings");
  await expect(page.getByTestId("tier-badge")).toHaveAttribute("data-tier", "free");

  // Redeem the code → the (revalidated) settings page now shows the Claude tier.
  await page.getByTestId("redeem-code-input").fill(code);
  await page.getByRole("button", { name: "Redeem code" }).click();
  await expect(page.getByTestId("tier-badge")).toHaveAttribute("data-tier", "claude");
});

test("a bogus code is rejected and leaves the tier free", async ({ page }) => {
  await signup(page, uniqueEmail("kin"));
  await page.goto("/settings");
  await page.getByTestId("redeem-code-input").fill("not-a-real-code");
  await page.getByRole("button", { name: "Redeem code" }).click();
  await expect(page.getByText("That code isn't valid.")).toBeVisible();
  await expect(page.getByTestId("tier-badge")).toHaveAttribute("data-tier", "free");
});
