import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { uniqueEmail, signupAndRead } from "./helpers";

// The Dharma Inquiry (after Schmachtenberger) → the Vow → the Journey.
const DB = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const ANSWERS: Record<string, string[]> = {
  values: ["Joanna Macy, her fierce tenderness", "Light on the creek at dusk", "That we've forgotten we belong to the land", "Someone who helped people find each other", "The land, my children, the commons", "The watershed and the people of it"],
  propensities: ["Listening until the pattern shows itself", "Long walks by the creek; music", "How groups make decisions", "Building the land trust with friends", "I over-give until I'm empty", "Being unheard as a child — it made me listen"],
  capacities: ["Fund bioregional commons", "Ecology", "facilitation, spanish, carpentry", "Start the land trust", "Teach for free"],
  karma: ["My grandmother, my first teacher", "A childhood outdoors", "Teach what I was given", "My brother — call him", "My grandmother's patience"],
  patterns: ["Checking my phone", "Money", "Needing to be right", "Grant writing", "Too little rest"],
  guidance: ["Sitting with my father as he died", "On the river at dawn", "The night my daughter was born", "We belong to each other"],
};
const DEEPER_KARMA = ["Taking the job my friend wanted", "My grandfather's courage", "The land my family farmed was taken"];

test("dharma inquiry: six chambers (after Schmachtenberger) → why-ladder + deeper → mirror + seeds → vow → journey", async ({ page }) => {
  const email = uniqueEmail("inquiry");
  await signupAndRead(page, email);
  await page.goto("/altar");
  await page.waitForURL("**/inquiry");
  await expect(page.getByTestId("inquiry-index")).toContainText("Schmachtenberger");
  await expect(page.getByTestId("inquiry-frame")).toContainText("every gift has a shadow");
  for (const c of ["values", "propensities", "capacities", "karma", "patterns", "guidance"]) await expect(page.getByTestId(`chamber-${c}`)).toBeVisible();

  for (const [chamber, answers] of Object.entries(ANSWERS)) {
    await page.goto(`/inquiry/${chamber}`);
    const flow = page.getByTestId("chamber-flow");
    await expect(flow).toBeVisible();
    for (let i = 0; i < answers.length; i++) {
      await flow.locator('textarea[id^="f-"]').fill(answers[i]);
      // Values: ask "why?" of what is sacred, twice, until something fundamental.
      if (chamber === "values" && i === 4) {
        await page.getByTestId("ask-why").click();
        await page.getByTestId("why-input").last().fill("because they hold the future");
        await page.getByTestId("ask-why").click();
        await page.getByTestId("why-input").last().fill("because life wants to continue through us");
      }
      if (i < answers.length - 1) await page.getByTestId("next-question").click();
    }
    if (chamber === "karma") {
      await page.getByTestId("go-deeper").click();
      for (let k = 0; k < DEEPER_KARMA.length; k++) {
        await flow.locator('textarea[id^="f-"]').fill(DEEPER_KARMA[k]);
        if (k < DEEPER_KARMA.length - 1) await page.getByTestId("next-question").click();
      }
    }
    await page.getByRole("button", { name: "close the chamber" }).click();
    await page.waitForURL(`**/inquiry/${chamber}?mirror=1`);
    await expect(page.getByTestId("mirror-text")).toBeVisible();
    await expect(page.getByTestId("mirror-text")).toContainText("“");
    if (chamber === "values") {
      await expect(page.getByTestId("mirror-text")).toContainText("life wants to continue through us");
      await expect(page.getByTestId("seed").first()).toContainText("Because life wants to continue through us");
    }
    await page.getByRole("button", { name: /Place these/ }).click();
    await page.waitForURL(chamber === "guidance" ? "**/inquiry/vow" : "**/inquiry/*");
  }

  // Sealed at rest; the ladder is kept with its answer.
  const db = new Client({ connectionString: DB });
  await db.connect();
  try {
    const { rows } = await db.query(
      "select count(*)::int n, bool_and(position('grandmother'::bytea in answer_enc) = 0) sealed from dharma_inquiry d join auth.users u on u.id=d.user_id where u.email=$1", [email]);
    expect(rows[0].n).toBe(34);
    expect(rows[0].sealed).toBe(true);
  } finally { await db.end(); }

  // The Vow: their own words come back; the facets are pre-drafted from them.
  await expect(page.getByTestId("vow")).toContainText("because life wants to continue through us");
  await expect(page.locator("#for_whom")).toHaveValue("The watershed and the people of it");
  await expect(page.locator("#toward_what")).toHaveValue("That we've forgotten we belong to the land");
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
