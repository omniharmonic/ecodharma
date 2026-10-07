import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { uniqueEmail, signupAndRead } from "./helpers";

// The Dharma Inquiry (after Schmachtenberger) → the Vow → the Journey.
const DB = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const ANSWERS: Record<string, string[]> = {
  values: ["Joanna Macy, her fierce tenderness", "Light on the creek at dusk", "That we've forgotten we belong to the land", "Rivers running clean again", "Someone who helped people find each other", "The land, my children, the commons"],
  propensities: ["Listening until the pattern shows itself", "Mycelium and governance", "Long walks by the creek; music", "How groups make decisions"],
  capacities: ["Ecology", "facilitation, spanish, carpentry", "Start the land trust", "Fund bioregional commons"],
  karma: ["My grandmother, my first teacher", "A childhood outdoors", "Teach what I was given"],
  issues: ["Being unheard as a child — it made me listen", "Holding space for others to be heard", "I still go quiet when I disagree"],
  opportunities: ["Money", "I say I value rest and I don't rest", "The job I took for security"],
  devotion: ["The living world", "Life itself — devotion is returning", "The watershed and the people of it"],
};

test("dharma inquiry: seven chambers → mirror + seeds → vow → journey", async ({ page }) => {
  const email = uniqueEmail("inquiry");
  await signupAndRead(page, email);
  await page.goto("/altar");
  await page.waitForURL("**/inquiry");
  await expect(page.getByTestId("inquiry-index")).toContainText("Schmachtenberger");

  for (const [chamber, answers] of Object.entries(ANSWERS)) {
    await page.goto(`/inquiry/${chamber}`);
    const flow = page.getByTestId("chamber-flow");
    await expect(flow).toBeVisible();
    for (let i = 0; i < answers.length; i++) {
      await flow.locator("textarea").fill(answers[i]);
      if (i < answers.length - 1) await page.getByTestId("next-question").click();
    }
    await page.getByRole("button", { name: "close the chamber" }).click();
    await page.waitForURL(`**/inquiry/${chamber}?mirror=1`);
    await expect(page.getByTestId("mirror-text")).toBeVisible();
    await expect(page.getByTestId("mirror-text")).toContainText("“");
    await page.getByRole("button", { name: /Place these/ }).click();
    await page.waitForURL(chamber === "devotion" ? "**/inquiry/vow" : "**/inquiry/*");
  }

  // Sealed at rest.
  const db = new Client({ connectionString: DB });
  await db.connect();
  try {
    const { rows } = await db.query(
      "select count(*)::int n, bool_and(position('grandmother'::bytea in answer_enc) = 0) sealed from dharma_inquiry d join auth.users u on u.id=d.user_id where u.email=$1", [email]);
    expect(rows[0].n).toBe(26);
    expect(rows[0].sealed).toBe(true);
  } finally { await db.end(); }

  // The Vow: their own words come back; the facets are pre-drafted from them.
  await expect(page.getByTestId("vow")).toContainText("The watershed and the people of it");
  await expect(page.locator("#toward_what")).toHaveValue("Rivers running clean again");
  await page.getByTestId("prayer-input").fill("May my life return us to belonging with the land, one listening at a time.");
  await page.getByRole("button", { name: /Vow it/ }).click();
  await page.waitForURL("**/journey?vowed=1");
  await expect(page.getByTestId("vowed")).toBeVisible();
  await expect(page.getByTestId("stage-inquiry")).toHaveAttribute("data-done", "yes");
  await expect(page.getByTestId("stage-vow")).toHaveAttribute("data-done", "yes");
  // Seeds placed by mode.
  await expect(page.getByTestId("modes")).toContainText("Long walks by the creek");
  await expect(page.getByTestId("modes")).toContainText("Facilitation");

  // Stage III — roots.
  await page.goto("/journey/roots");
  await page.locator('textarea[name="new_roots"]').fill("Small coherent groups change systems");
  await page.locator("select[name=question_root]").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Complete this stage" }).click();
  await page.waitForURL("**/journey");
  await expect(page.getByTestId("stage-roots")).toHaveAttribute("data-done", "yes");

  // Stage IV — paths: release one.
  await page.goto("/journey/paths");
  await page.locator("select[name=release]").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Complete this stage" }).click();
  await page.waitForURL("**/journey");

  // Stage V — practice; VI — becoming.
  await page.goto("/journey/practice");
  await page.getByTestId("practice-input").fill("A wordless creek walk before any screen");
  await page.getByRole("button", { name: "Complete this stage" }).click();
  await page.waitForURL("**/journey");
  await page.goto("/journey/becoming");
  await expect(page.getByTestId("capacity-input")).not.toHaveValue("");
  await page.locator("input[name=sign]").fill("I can hold a room of forty without my voice shaking");
  await page.getByRole("button", { name: "Complete this stage" }).click();
  await page.waitForURL("**/journey");
  for (const s of ["paths", "practice", "becoming"]) await expect(page.getByTestId(`stage-${s}`)).toHaveAttribute("data-done", "yes");
  await expect(page.getByTestId("stage-witness")).toHaveAttribute("data-done", "no");

  // The altar is lit and the world reflects it.
  await page.goto("/altar");
  await expect(page.getByTestId("prayer-text")).toContainText("belonging with the land");
});
