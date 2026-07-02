import { test, expect } from "@playwright/test";
import { uniqueEmail, signup } from "./helpers";

// Birth time is sensitive; an unknown time must still produce a (solar) reading
// rather than dead-ending — the charts just flag what becomes uncertain.
test("unknown birth time still yields a complete reading", async ({ page }) => {
  await signup(page, uniqueEmail("notime"));

  await page.getByLabel("First name").fill("Ren");
  await page.getByLabel("Birth date").fill("1990-06-15");
  await page.getByRole("checkbox").check(); // "I don't know my birth time" — disables the time field
  await page.getByLabel("Birth place").fill("Berlin, Germany");
  await page.getByLabel("What do you love? What makes you feel alive?").fill("Bringing people together.");
  await page.getByLabel("What are you genuinely good at?").fill("Seeing the pattern that connects.");
  await page.getByRole("button", { name: "Reveal my gift profile" }).click();

  await page.waitForURL("**/profile", { timeout: 45_000 });
  await expect(page.getByTestId("recognition")).toBeVisible();
  await expect(page.getByTestId("chart-visuals")).toBeVisible();
});

// Required fields are enforced before any compute happens.
test("onboarding requires the ikigai fields", async ({ page }) => {
  await signup(page, uniqueEmail("req"));
  await page.getByLabel("Birth date").fill("1990-06-15");
  await page.getByLabel("Birth place").fill("Berlin, Germany");
  // intentionally leave the four ikigai textareas empty
  await page.getByRole("button", { name: "Reveal my gift profile" }).click();
  // browser blocks submit on the first required field — we stay on /onboarding
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByRole("heading", { name: "Your reading" })).toBeVisible();
});
