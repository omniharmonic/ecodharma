import { test, expect } from "@playwright/test";
import { uniqueEmail, signup, onboard } from "./helpers";

test("trim-tab commons: resonance feedback + curation surface", async ({ page }) => {
  await signup(page, uniqueEmail("tt"));
  await onboard(page, { need: "ecological restoration and bioregional stewardship" });

  // Profile has trim-tabs with resonance controls.
  const firstTab = page.getByTestId("trim-tab").first();
  await expect(firstTab).toBeVisible();
  await firstTab.getByRole("button", { name: "[ yes ]" }).click();
  await expect(firstTab.getByText(/Resonance noted/)).toBeVisible();

  // Curation surface renders the growing library stats.
  await page.goto("/curate");
  await expect(page.getByRole("heading", { name: "Trim-tab commons" })).toBeVisible();
  await expect(page.getByTestId("library-stat").first()).toBeVisible();

  // If runtime generated any candidates, promotion removes it from the candidate list
  // (it becomes curated canon).
  const candidates = page.getByTestId("candidate");
  const before = await candidates.count();
  if (before > 0) {
    await candidates.first().getByRole("button", { name: "Promote to canon" }).click();
    await expect(candidates).toHaveCount(before - 1);
  }
});
