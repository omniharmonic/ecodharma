import { test, expect } from "@playwright/test";
import { uniqueEmail, signupAndRead, login } from "./helpers";

// The Work / aligned-projects marketplace is disabled for launch (routes redirect
// to /profile). Re-enable this journey when the feature is turned back on.
test.skip("Journey D — marketplace: project need matches a discoverable person's gifts", async ({ browser }) => {
  const stewardEmail = uniqueEmail("steward");
  const seekerEmail = uniqueEmail("seeker");

  const stewardCtx = await browser.newContext();
  const seekerCtx = await browser.newContext();
  const steward = await stewardCtx.newPage();
  const seeker = await seekerCtx.newPage();

  // Both take readings (so they have framework signatures).
  await signupAndRead(steward, stewardEmail, "bioregional finance and cooperative economics");
  await signupAndRead(seeker, seekerEmail, "ecological restoration and bioregional stewardship");

  // Seeker opts into marketplace discovery (their marketplace consent).
  await seeker.goto("/work");
  await seeker.getByLabel(/consent to being surfaced/).check();
  await seeker.getByRole("button", { name: /discoverable|Update/ }).click();
  await expect(seeker.getByText(/discoverable/i)).toBeVisible();

  // Steward names a project needing broad gifts/domains (so a match is likely).
  await steward.goto("/projects");
  await steward.getByLabel("Title").fill("Watershed regeneration council");
  await steward.getByLabel("What is it, and what does it need?").fill("Restoring the lower river commons.");
  // Select every gift + domain so the seeker's signature overlaps.
  for (const cb of await steward.locator('input[name="needed_gifts"]').all()) await cb.check();
  for (const cb of await steward.locator('input[name="needed_domains"]').all()) await cb.check();
  await steward.getByRole("button", { name: "Create project" }).click();
  await steward.waitForURL("**/projects/**");

  // The steward sees gift-aligned people (the discoverable seeker).
  await expect(steward.getByTestId("person-match").first()).toBeVisible();

  // And the seeker sees the project in their "find your work" feed.
  await seeker.goto("/work");
  await expect(seeker.getByTestId("work-match").first()).toBeVisible();

  await stewardCtx.close();
  await seekerCtx.close();
});
