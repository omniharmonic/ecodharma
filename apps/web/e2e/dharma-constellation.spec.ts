import { test, expect, type Page } from "@playwright/test";
import { uniqueEmail, signupAndRead } from "./helpers";

// Phase 4 — Dharma Constellations: roles, a shared prayer, reflections OFFERED
// (excerpt copies, revocable), witness notes, kin in the Sky, and the consent
// gate holding at every step (revoking consent hides everything).

async function kindle(page: Page, prayer: string, work: string) {
  await page.goto("/altar/kindle");
  await page.getByLabel("Your prayer, in your own words").fill(prayer);
  await page.locator('textarea[name="custom_work"]').fill(work);
  await page.getByRole("button", { name: "Light the altar" }).click();
  await page.waitForURL("**/altar?kindled=1");
}

test("dharma constellation: shared prayer, offering, witness, revocation", async ({ browser }) => {
  const aCtx = await browser.newContext();
  const bCtx = await browser.newContext();
  const a = await aCtx.newPage();
  const b = await bCtx.newPage();
  const bEmail = uniqueEmail("dharmab");
  await signupAndRead(a, uniqueEmail("dharmaa"));
  await signupAndRead(b, bEmail);
  await kindle(a, "May my life weave the commons back into wholeness.", "Building EcoDharma");
  await kindle(b, "May my life tend the watershed and its people.", "Restoring Boulder Creek");

  // A weaves a constellation and invites B; B consents.
  await a.goto("/constellations");
  await a.getByPlaceholder("e.g. Cascadia weavers").fill("Front Range Pod");
  await a.getByRole("button", { name: "Create" }).click();
  await a.waitForURL("**/constellations/**");
  const url = a.url();
  await a.getByPlaceholder("their@email.com").fill(bEmail);
  await a.getByRole("button", { name: "Send invitation" }).click();
  await expect(a.getByText(/Invitation sent/)).toBeVisible();
  await b.goto("/constellations");
  await b.getByRole("button", { name: "Consent & join" }).click();
  await expect(b.getByTestId("joined-constellation")).toBeVisible();

  // Shared prayer (A writes it; B sees it).
  await a.goto(url);
  const section = a.getByTestId("dharma-section");
  await expect(section).toBeVisible();
  await section.locator('textarea[name="title"]').fill("May we keep the Front Range alive, together.");
  await section.getByRole("button", { name: "Write the shared prayer" }).click();
  await expect(a.getByTestId("shared-prayer")).toContainText("keep the Front Range alive");
  // A becomes an accountability partner.
  await section.getByTestId("my-role").selectOption("accountability");
  await section.getByRole("button", { name: "Set my role" }).click();
  await expect(section.getByText("Your role is set.")).toBeVisible();

  await b.goto(url);
  await expect(b.getByTestId("shared-prayer")).toContainText("keep the Front Range alive");

  // B reflects privately, then OFFERS an excerpt to the pod.
  await b.goto("/journal");
  await b.getByTestId("journal-body").fill("Restoring Boulder Creek humbled me. PRIVATE-DETAIL: my finances are scary.");
  await b.getByRole("button", { name: "Offer this reflection" }).click();
  await b.waitForURL(/journal\?r=/);
  const offer = b.getByTestId("offer").first();
  await offer.locator("summary").click();
  await offer.locator('textarea[name="excerpt"]').fill("Restoring Boulder Creek humbled me.");
  await offer.getByRole("button", { name: "Offer these words" }).click();
  await expect(offer.getByText(/Offered/)).toBeVisible();

  // A sees ONLY the offered words — never the private reflection — and witnesses.
  await a.goto(url);
  const offering = a.getByTestId("offering").first();
  await expect(offering).toContainText("humbled me");
  await expect(a.locator("body")).not.toContainText("PRIVATE-DETAIL");
  await offering.locator('input[name="body"]').fill("I see your patience becoming the creek's.");
  await offering.getByRole("button", { name: "Witness" }).click();
  await expect(a.getByText("Your witness is sent.")).toBeVisible();
  await b.goto(url);
  await expect(b.getByTestId("witness-note").first()).toContainText("patience");

  // Kin appear in the Sky snapshot (consented co-member).
  await a.goto("/altar");
  await expect(a.getByTestId("prayer-panel")).toBeVisible();

  // REVOCATION: B revokes consent → A no longer sees B's offering.
  await b.goto("/constellations");
  await b.getByRole("button", { name: "Revoke consent" }).click();
  await expect(b.getByText(/Consent revoked/)).toBeVisible();
  await a.goto(url);
  await expect(a.getByTestId("offering")).toHaveCount(0);

  await aCtx.close();
  await bCtx.close();
});

test("story + threads: patterns noticed across reflections are offered back", async ({ page }) => {
  await signupAndRead(page, uniqueEmail("threads"));
  await kindle(page, "May my life weave the commons back into wholeness.", "Teaching circles\nFundraising");
  for (const t of [
    "Teaching circles lit me up, I felt alive and grateful. Fundraising was draining and heavy.",
    "Teaching circles again — joy and flow. Fundraising felt forced and exhausting.",
    "Teaching circles: alive, clear, beautiful. Fundraising left me depleted and anxious.",
  ]) {
    await page.goto("/journal");
    await page.getByTestId("journal-body").fill(t);
    await page.getByRole("button", { name: "Offer this reflection" }).click();
    await page.waitForURL(/journal\?r=/);
    await page.getByRole("button", { name: "Weave into the altar" }).click();
    await expect(page.getByText("Woven into your altar.")).toBeVisible();
  }
  await page.goto("/altar");
  const threads = page.getByTestId("threads");
  await expect(threads).toBeVisible();
  await expect(threads).toContainText("Teaching circles reliably brings you alive");
  await expect(threads).toContainText("Fundraising keeps contracting you");
  await threads.locator("li", { hasText: "reliably brings you alive" }).getByRole("button", { name: "yes, a thread" }).click();
  await expect(page.getByTestId("threads")).not.toContainText("reliably brings you alive");

  await page.getByTestId("story-link").click();
  await expect(page.getByTestId("story")).toContainText("Most alive");
  await expect(page.getByTestId("story")).toContainText("Teaching circles");
  await expect(page.getByTestId("story")).toContainText("Where it hurt");
});
