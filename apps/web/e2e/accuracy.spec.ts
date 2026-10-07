import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { uniqueEmail, signup, onboard, signupAndRead } from "./helpers";

// Phase 0 accuracy repair, end to end.
const DB = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

test("a midnight birth is computed at midnight (not noon) and the resolved time is shown", async ({ page }) => {
  const email = uniqueEmail("midnight");
  await signup(page, email);
  await onboard(page, { time: "00:14", place: "Berlin, Germany" });
  const notes = page.getByTestId("time-notes");
  await expect(notes).toBeVisible();
  // 00:14 CEST (UTC+2 in June) → 22:14 UTC the previous day.
  await expect(notes).toContainText("1990-06-14 22:14");
  await expect(notes).not.toContainText("noon assumed");
});

test("Gene Keys shows all thirteen spheres including Core and Pearl", async ({ page }) => {
  await signupAndRead(page, uniqueEmail("gk"));
  const viz = page.getByTestId("chart-genekeys");
  await expect(viz.locator("svg[aria-label*='Core']")).toHaveCount(1);
  await expect(viz.locator("svg[aria-label*='Pearl ']")).toHaveCount(1);
});

test("a chart correction is disclosed honestly and earns a free re-draft", async ({ page }) => {
  const email = uniqueEmail("correction");
  await signupAndRead(page, email);
  const db = new Client({ connectionString: DB });
  await db.connect();
  try {
    const note = {
      at: new Date().toISOString(),
      changes: [
        { lens: "human_design", field: "authority", from: "Self-Projected", to: "Mental" },
        { lens: "gene_keys", field: "iq", from: "23.2", to: "40.5" },
      ],
      redrafted: false,
    };
    await db.query(
      `update profiles p set settings = jsonb_set(coalesce(p.settings,'{}'::jsonb), '{chart_correction}', $2::jsonb, true)
         from auth.users u where u.id = p.id and u.email = $1`,
      [email, JSON.stringify(note)],
    );
  } finally {
    await db.end();
  }
  await page.goto("/profile");
  const banner = page.getByTestId("chart-correction");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Self-Projected → Mental");
  // Free (non-premium) re-draft clears the banner.
  await banner.getByRole("button", { name: "re-draft from the corrected chart" }).click();
  // On success the page revalidates and the banner (with its form) is gone.
  await expect(page.getByTestId("chart-correction")).toHaveCount(0, { timeout: 45_000 });
  await page.goto("/profile");
  await expect(page.getByTestId("chart-correction")).toHaveCount(0);
  await expect(page.getByTestId("recognition")).toBeVisible();
});
