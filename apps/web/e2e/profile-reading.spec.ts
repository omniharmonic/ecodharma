import { test, expect } from "@playwright/test";
import { uniqueEmail, signup, onboard } from "./helpers";

// The v3 headline: a comprehensive, chart-grounded reading with real chart
// visuals and an interpretive layer — not just a recognition + trim-tab.
test("v3 reading renders all four charts, interpretive threads, portrait + gift constellation", async ({ page }) => {
  await signup(page, uniqueEmail("read"));
  await onboard(page, { date: "1988-11-12", time: "14:30", place: "Berlin, Germany" });

  await expect(page.getByTestId("recognition")).toBeVisible();

  // The four computed charts are drawn (western + vedic wheels, bodygraph, gene keys).
  await expect(page.getByTestId("chart-visuals")).toBeVisible();
  for (const id of ["chart-natal-western", "chart-natal-vedic", "chart-bodygraph", "chart-genekeys"]) {
    await expect(page.getByTestId(id)).toBeVisible();
    await expect(page.getByTestId(id).locator("svg").first()).toBeVisible();
  }

  // The interpretive layer: numbered placement → great-turning bridges.
  expect(await page.getByTestId("chart-thread").count()).toBeGreaterThan(0);

  // The deep reading + the 2–3 gift constellation.
  await expect(page.getByTestId("profile-portrait")).toBeVisible();
  expect((await page.getByTestId("profile-portrait").innerText()).length).toBeGreaterThan(200);
  expect(await page.getByTestId("gift-carry").count()).toBeGreaterThan(0);

  // The flagship depth: three deep per-lens sections, each with explained placements.
  for (const lens of ["astrology", "human_design", "gene_keys"]) {
    const section = page.getByTestId(`lens-reading-${lens}`);
    await expect(section).toBeVisible();
    expect((await section.innerText()).length).toBeGreaterThan(200);
    expect(await section.getByTestId("lens-placement").count()).toBeGreaterThan(2);
  }
});

test("re-draft regenerates the profile in place (charts intact)", async ({ page }) => {
  await signup(page, uniqueEmail("redraft"));
  await onboard(page);
  await expect(page.getByTestId("recognition")).toBeVisible();

  await page.getByRole("button", { name: "re-draft profile" }).click();
  await expect(page.getByTestId("recognition")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("chart-visuals")).toBeVisible();
});
