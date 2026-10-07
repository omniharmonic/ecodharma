import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { uniqueEmail, signupAndRead } from "./helpers";

// The Living Altar, end to end: kindle → dashboard (all four views) → reflect →
// strands proposed from the person's own words → confirm → journal + encryption
// at rest → tend (revise = new ring, root status) → a guided seasonal ritual.
const DB = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

test("kindle the altar, reflect, weave strands, and see it alive", async ({ page }) => {
  const email = uniqueEmail("altar");
  await signupAndRead(page, email);

  // From the reading to the practice.
  await expect(page.getByTestId("altar-cta")).toBeVisible();
  await page.goto("/altar");
  await page.waitForURL("**/inquiry");
  await page.getByTestId("quick-kindle").click();
  await page.waitForURL("**/altar/kindle");
  await expect(page.getByTestId("prayer-prompts")).toBeVisible();

  await page.getByLabel("Your prayer, in your own words").fill("May my life weave the commons back into wholeness.");
  await page.getByLabel("For whom").fill("my bioregion and my kin");
  await page.locator('textarea[name="custom_work"]').fill("Building EcoDharma\nStewarding the Foodshed");
  await page.locator('textarea[name="custom_root"]').fill("I must be financially self-sustaining to serve well");
  await page.locator('textarea[name="custom_practice"]').fill("Morning sit");
  // tick the first suggested measure if one is offered
  const measure = page.locator('input[name="suggestion"][value^="measure|"]').first();
  if (await measure.count()) await measure.check();
  await page.getByRole("button", { name: "Light the altar" }).click();

  await page.waitForURL("**/altar?kindled=1");
  await expect(page.getByTestId("kindled")).toBeVisible();
  await expect(page.getByTestId("prayer-text")).toContainText("weave the commons");
  // The world is the sky; the lenses open over it.
  await expect(page.getByTestId("dreamscape").or(page.getByTestId("dreamscape-still")).first()).toBeAttached();
  await expect(page.getByTestId("lens-dock")).toBeVisible();
  await page.getByTestId("view-orrery").click();
  await expect(page.getByTestId("orrery")).toBeVisible();
  await expect(page.getByTestId("orrery-work")).toHaveCount(2);
  await expect(page.getByTestId("orrery-root")).toHaveCount(1);
  await page.getByTestId("lens-overlay").getByRole("button", { name: /Depths/ }).click();
  await expect(page.getByTestId("soil-view")).toBeVisible();
  await page.getByTestId("lens-overlay").getByRole("button", { name: /Becoming/ }).click();
  await expect(page.getByTestId("becoming-view")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("lens-overlay")).toHaveCount(0);

  // Reflect.
  await page.getByTestId("reflect-now").click();
  await page.waitForURL("**/journal");
  const words = "This week Building EcoDharma felt like my prayer in motion and I lit up. " +
    "But the fundraising grind is draining me and I wonder whether being financially self-sustaining is the point. " +
    "I skipped my morning sit.";
  await page.getByTestId("journal-body").fill(words);
  await page.getByRole("button", { name: "Offer this reflection" }).click();
  await page.waitForURL(/\/journal\?r=\d+/);

  // Strands were proposed from the person's own words.
  const review = page.getByTestId("strand-review");
  await expect(review).toBeVisible();
  await expect(page.getByTestId("proposed-strand")).not.toHaveCount(0);
  await expect(review).toContainText("Building EcoDharma");
  await expect(review).toContainText("strains");
  await page.getByRole("button", { name: "Weave into the altar" }).click();
  await expect(page.getByText("Woven into your altar.")).toBeVisible();

  // Encrypted at rest: the plaintext is NOT in the database.
  const db = new Client({ connectionString: DB });
  await db.connect();
  try {
    const { rows } = await db.query(
      `select r.body_enc, (select count(*)::int from strands s where s.reflection_id = r.id and s.status='confirmed') as confirmed
         from reflections r join auth.users u on u.id = r.user_id where u.email = $1`, [email]);
    expect(rows.length).toBe(1);
    expect(Buffer.from(rows[0].body_enc).toString("utf8")).not.toContain("fundraising");
    expect(rows[0].confirmed).toBeGreaterThan(0);
  } finally {
    await db.end();
  }

  // The dashboard shows it.
  await page.goto("/altar");
  await expect(page.getByTestId("journal-strip")).toContainText("fundraising");

  // Tend: revise the prayer (new ring) and question a root.
  await page.goto("/altar/edit");
  const prayerCard = page.getByTestId("element-prayer");
  await prayerCard.locator("summary").click();
  await prayerCard.locator('input[name="title"]').fill("May my life weave the commons — and my family — back into wholeness.");
  await prayerCard.getByRole("button", { name: "Add a new ring" }).click();
  await expect(prayerCard.getByText(/A new ring is added/)).toBeVisible();
  const root = page.getByTestId("element-root");
  await root.locator("summary").click();
  await root.locator("select[name=status]").selectOption("questioning");
  await root.getByRole("button", { name: "Set state" }).click();
  await expect(root.getByText("Status changed.")).toBeVisible();

  await page.goto("/altar");
  await expect(page.getByTestId("prayer-panel")).toContainText("ring 2");
  await expect(page.getByTestId("prayer-panel")).toContainText("and my family");

  // A guided seasonal ritual (triple loop) with re-vowing.
  await page.goto("/ritual/seasonal");
  await expect(page.getByTestId("ritual-title")).toBeVisible();
  await page.locator("textarea[name^=a_]").first().fill("The fundraising treadmill is ready to be composted.");
  await page.getByTestId("new-prayer").fill("May my life weave the commons back into wholeness, unhurried.");
  await page.getByRole("button", { name: "Offer this reflection" }).click();
  await page.waitForURL(/\/journal\?r=\d+/);
  await page.goto("/altar");
  await expect(page.getByTestId("prayer-panel")).toContainText("unhurried");
  await expect(page.getByTestId("prayer-panel")).toContainText("ring 3");
});

test("the rituals cron invites once, at the person's own hour, grounded in their altar", async ({ page }) => {
  const email = uniqueEmail("ritual");
  await signupAndRead(page, email);
  await page.goto("/altar/kindle");
  await page.getByLabel("Your prayer, in your own words").fill("May my life tend the watershed and the people of it.");
  await page.locator('textarea[name="custom_work"]').fill("Restoring Boulder Creek");
  await page.getByRole("button", { name: "Light the altar" }).click();
  await page.waitForURL("**/altar?kindled=1");

  // Sunday 18:00 in the person's zone (Berlin from onboarding) has passed by Mon 2026-10-05 12:00Z.
  let res = await page.request.get("/api/cron/rituals?at=2026-10-05T12:00:00Z");
  let body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.invited).toContain(email);
  // Idempotent: the same moment never invites twice.
  res = await page.request.get("/api/cron/rituals?at=2026-10-05T13:00:00Z");
  body = await res.json();
  expect(body.invited).not.toContain(email);

  const db = new Client({ connectionString: DB });
  await db.connect();
  try {
    const { rows } = await db.query(
      `select i.body, i.engine, i.contract->>'ok' as ok, i.refs from invitations i join auth.users u on u.id=i.user_id where u.email=$1 order by i.id`, [email]);
    expect(rows.length).toBeGreaterThan(0);
    const inv = rows[rows.length - 1];
    expect(inv.ok).toBe("true");
    expect(inv.body).not.toMatch(/I need|could you share|the person's/i);
    expect((inv.refs as string[]).length).toBeGreaterThanOrEqual(2);
  } finally {
    await db.end();
  }
});
