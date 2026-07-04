import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { uniqueEmail, signupAndRead } from "./helpers";

// Regression for the production incident where a stored reading with required
// array fields returned as non-arrays crashed /profile ("W.map is not a
// function"). Write-time hardening can't reach rows already in the DB, so the
// page must (a) render anyway and (b) heal + persist the row in place.

const DB = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

test("a malformed stored reading still renders, and is healed in place", async ({ page }) => {
  const email = uniqueEmail("resilience");
  await signupAndRead(page, email);

  // Corrupt the stored reading the way a bad model payload once did in prod:
  // arrays as strings/objects/scalars, and the portrait gone entirely.
  const db = new Client({ connectionString: DB });
  await db.connect();
  try {
    const corruption = {
      portrait: "",
      chart_threads: "Sun in Scorpio means depth",
      gift_constellation: { gift_id: "the-weaver" },
      lens_readings: null,
      unique_gifts: {},
      domains: "food systems",
      pairings: 3,
      orientations: 7,
      shadow: false,
      trim_tabs: "do the thing",
      narrative: ["not", "a", "string"],
    };
    const { rowCount } = await db.query(
      `update gift_profiles gp set content_json = gp.content_json || $2::jsonb
         from auth.users u
        where u.id = gp.user_id and u.email = $1`,
      [email, JSON.stringify(corruption)],
    );
    expect(rowCount).toBe(1);

    // The page must render — recognition survives, every gap heals from the fixture.
    await page.goto("/profile");
    await expect(page.getByTestId("recognition")).toBeVisible();
    await expect(page.getByTestId("profile-portrait")).toBeVisible();
    await expect(page.getByTestId("lens-reading-astrology")).toBeVisible();
    await expect(page.getByTestId("lens-reading-human_design")).toBeVisible();
    await expect(page.getByTestId("lens-reading-gene_keys")).toBeVisible();
    await expect(page.getByTestId("gift-carry").first()).toBeVisible();
    await expect(page.getByTestId("gift-item").first()).toBeVisible();
    await expect(page.getByTestId("trim-tab").first()).toBeVisible();

    // And the row converged: the healed reading was persisted back to the DB.
    const { rows } = await db.query(
      `select gp.content_json as c
         from gift_profiles gp join auth.users u on u.id = gp.user_id
        where u.email = $1
        order by gp.generated_at desc limit 1`,
      [email],
    );
    const c = rows[0].c;
    expect(Array.isArray(c.chart_threads)).toBe(true);
    expect(Array.isArray(c.lens_readings)).toBe(true);
    expect(c.lens_readings.length).toBe(3);
    expect(Array.isArray(c.trim_tabs)).toBe(true);
    expect(c.trim_tabs.length).toBeGreaterThan(0);
    expect(typeof c.portrait).toBe("string");
    expect(c.portrait.length).toBeGreaterThan(100);
    expect(String(c.meta?.engine || "")).toContain("heal");

    // Reload: the healed row now serves clean — no further healing needed.
    await page.reload();
    await expect(page.getByTestId("recognition")).toBeVisible();
    await expect(page.getByTestId("profile-portrait")).toBeVisible();
  } finally {
    await db.end();
  }
});
