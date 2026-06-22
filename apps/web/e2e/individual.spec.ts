import { test, expect } from "@playwright/test";
import { uniqueEmail, signup, onboard } from "./helpers";

test("Journey A — the kinship journey: signup → reading → gift profile", async ({ page }) => {
  const email = uniqueEmail("solo");
  await signup(page, email);

  // Onboarding renders.
  await expect(page.getByRole("heading", { name: "Your reading" })).toBeVisible();
  await onboard(page);

  // Profile leads with recognition + a lead move; framework recedes to support.
  await expect(page.getByTestId("recognition")).toBeVisible();
  await expect(page.getByTestId("trim-tab").first()).toBeVisible();
  await expect(page.getByTestId("gift-item").first()).toBeVisible();
  await expect(page.getByTestId("profile-version")).toContainText("framework v");

  // Domains live behind a disclosure (progressive disclosure of the framework).
  await page.getByText("Where this fits the bigger work").click();
  await expect(page.getByTestId("domain-item").first()).toBeVisible();

  const gifts = await page.getByTestId("gift-item").count();
  const trims = await page.getByTestId("trim-tab").count();
  expect(gifts).toBeGreaterThan(0);
  expect(trims).toBeGreaterThan(0);

  // Save offerings (seeds the marketplace).
  await page.getByLabel("Skills", { exact: true }).fill("facilitation, systems design");
  await page.getByRole("button", { name: "Save offerings" }).click();
  await expect(page.getByText("Offerings saved.")).toBeVisible();
});

test("two different births yield different narratives (chart-grounded, not a mock)", async ({ page }) => {
  const a = uniqueEmail("a");
  await signup(page, a);
  await onboard(page, { date: "1990-06-15", time: "06:30", place: "Berlin, Germany" });
  const recA = await page.getByTestId("recognition").innerText();

  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/");

  const b = uniqueEmail("b");
  await signup(page, b);
  await onboard(page, { date: "1975-12-02", time: "22:15", place: "Tokyo, Japan" });
  const recB = await page.getByTestId("recognition").innerText();

  expect(recA).not.toEqual(recB);
});
