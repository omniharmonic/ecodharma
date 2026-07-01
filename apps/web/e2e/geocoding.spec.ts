import { test, expect, type Page } from "@playwright/test";
import { uniqueEmail, signup } from "./helpers";

async function fillIkigai(page: Page) {
  await page.getByLabel("What do you love? What makes you feel alive?").fill("Tending damaged land back to life.");
  await page.getByLabel("What are you genuinely good at?").fill("Patient observation and steady repair.");
  await page.getByLabel("What does the world (your place, now) most need?").fill("watersheds tended for the long term");
  await page.getByLabel("What could sustain you materially?").fill("ecological restoration and stewardship");
}

// The gazetteer is not a hard-coded handful of cities: any birthplace resolves.
test("a birthplace NOT in the curated list resolves to a real chart", async ({ page }) => {
  await signup(page, uniqueEmail("geo"));
  await page.getByLabel("Birth date").fill("1991-04-04");
  await page.getByLabel("Birth time", { exact: true }).fill("08:00");
  await page.getByLabel("Birth place").fill("berlin"); // lowercase — NOT the curated key "Berlin, Germany"
  await fillIkigai(page);
  await page.getByRole("button", { name: "Reveal my gift profile" }).click();
  await page.waitForURL("**/profile", { timeout: 45_000 });
  await expect(page.getByTestId("recognition")).toBeVisible();
  await expect(page.getByTestId("chart-visuals")).toBeVisible();
});

// An unresolvable place is surfaced honestly; explicit coordinates then succeed.
test("an unresolvable place is surfaced, and coordinates are a working fallback", async ({ page }) => {
  await signup(page, uniqueEmail("geo2"));
  await page.getByLabel("Birth date").fill("1991-04-04");
  await page.getByLabel("Birth time", { exact: true }).fill("08:00");
  await page.getByLabel("Birth place").fill("zzqxnowhereplace12345");
  await fillIkigai(page);
  await page.getByRole("button", { name: "Reveal my gift profile" }).click();
  await expect(page.getByText(/couldn.t place that town/i)).toBeVisible();

  // Provide exact coordinates via the advanced disclosure (overrides the place).
  await page.getByText("Enter exact coordinates").click();
  await page.getByPlaceholder("latitude").fill("64.13");
  await page.getByPlaceholder("longitude").fill("-21.9");
  await page.getByPlaceholder("IANA tz e.g. Europe/Berlin").fill("Atlantic/Reykjavik");
  await page.getByRole("button", { name: "Reveal my gift profile" }).click();
  await page.waitForURL("**/profile", { timeout: 45_000 });
  await expect(page.getByTestId("recognition")).toBeVisible();
});
