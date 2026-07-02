import { test, expect, devices } from "@playwright/test";
import { uniqueEmail, signup, onboard } from "./helpers";

test("command palette navigates (⌘K → type → enter)", async ({ page }) => {
  await signup(page, uniqueEmail("nav"));
  await onboard(page);
  await expect(page.getByTestId("recognition")).toBeVisible();

  await page.keyboard.press("Control+k");
  const input = page.getByPlaceholder("type a command…");
  await expect(input).toBeVisible();
  await input.fill("constellations");
  await input.press("Enter");
  await page.waitForURL("**/constellations");
  await expect(page.getByRole("heading", { name: "Constellations" })).toBeVisible();
});

test("single-key nav jumps to a section", async ({ page }) => {
  await signup(page, uniqueEmail("key"));
  await onboard(page);
  await expect(page.getByTestId("recognition")).toBeVisible();

  await page.getByTestId("recognition").click(); // focus the page, not a field
  await page.keyboard.press("c"); // → constellations
  await page.waitForURL("**/constellations");
  await expect(page.getByRole("heading", { name: "Constellations" })).toBeVisible();
});

test("mobile: the floating command-menu button opens the palette", async ({ browser }) => {
  // On phones the primary nav links collapse into this single command menu.
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  try {
    await page.goto("/");
    const menu = page.getByRole("button", { name: "Open command menu" });
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(page.getByPlaceholder("type a command…")).toBeVisible();
    // the palette lists the full navigation
    await expect(page.getByRole("button", { name: /Constellations/ })).toBeVisible();
  } finally {
    await ctx.close();
  }
});
