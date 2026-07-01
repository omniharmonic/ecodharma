import { test, expect } from "@playwright/test";

// The sample constellation is public (no auth) so a newcomer can see the
// constellation experience before inviting real kin.
test("sample constellation is public and renders a full woven read", async ({ page }) => {
  await page.goto("/constellations/sample");

  await expect(page.getByText("Sample constellation")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cascadia Weavers" })).toBeVisible();

  // member roster + the geodesic map + the woven read
  expect(await page.getByTestId("sample-member-row").count()).toBeGreaterThan(2);
  await expect(page.getByTestId("constellation-read")).toBeVisible();
  await expect(page.getByText("Weaving guidance")).toBeVisible();

  // the switcher loads another sample
  await page.getByRole("link", { name: "Story & Soil" }).click();
  await page.waitForURL(/c=story-and-soil/);
  await expect(page.getByRole("heading", { name: "Story & Soil" })).toBeVisible();
});

test("sample shows the Human Design relational substrate (team view)", async ({ page }) => {
  // The two-person sample exposes the dyadic connection chart beneath the gifts.
  await page.goto("/constellations/sample?c=noor-and-kaya");
  await expect(page.getByTestId("relational-substrate")).toBeVisible();
  await expect(page.getByText("Beneath the read")).toBeVisible();
  await expect(page.getByText("Composite type:")).toBeVisible();
  await expect(page.getByTestId("penta-filled")).toBeVisible();
});
