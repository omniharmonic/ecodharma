import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { uniqueEmail, signup, onboard } from "./helpers";

test("data-ownership: export, revoke-all, and delete account", async ({ page }) => {
  const email = uniqueEmail("priv");
  await signup(page, email);
  await onboard(page);

  await page.goto("/settings");
  await expect(page.getByTestId("data-summary")).toContainText("charts");
  await expect(page.getByText(email)).toBeVisible();

  // Export downloads a complete JSON copy that includes this account's data.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("export-link").click(),
  ]);
  const path = await download.path();
  const json = JSON.parse(readFileSync(path, "utf8"));
  expect(json.account.email).toBe(email);
  expect(json.charts.length).toBeGreaterThan(0);
  expect(json.gift_profiles.length).toBeGreaterThan(0);

  // Revoke-all stays on the page and confirms.
  await page.getByRole("button", { name: "Revoke all consents" }).click();
  await expect(page.getByText(/Revoked \d+ active consent/)).toBeVisible();

  // Delete requires the confirmation word, then logs out.
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.waitForURL(/deleted=1/);
  await expect(page.getByRole("link", { name: "Begin", exact: true })).toBeVisible(); // logged out

  // The account is truly gone — login fails.
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("regenerate123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/Invalid email or password/)).toBeVisible();
});
