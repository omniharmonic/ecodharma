import { test, expect } from "@playwright/test";
import { signup, uniqueEmail } from "./helpers";

// Admin controls: flip the global reading engine, and gate signup behind a shared
// access password. e2e forces ECODHARMA_INTERPRETER=fixture, so the engine toggle
// persists in config but the interpreter stays deterministic; the password gate is
// enforced whenever a password is set, regardless of engine (so it's testable here).
//
// IMPORTANT: this test sets a shared password and MUST clear it before finishing —
// every other spec's signup would otherwise require it (shared DB, serial run).
test("admin toggles the engine and gates signup with a shared password", async ({ page, context }) => {
  await signup(page, uniqueEmail("admin")); // e2e: admin allowlist unset → everyone is admin

  await page.goto("/curate");
  await expect(page.getByTestId("reading-engine")).toBeVisible();
  const modePill = page.getByTestId("engine-mode");
  const startMode = await modePill.getAttribute("data-mode");

  // Flip the engine and confirm it persisted.
  await page.getByRole("button", { name: /Switch to (hardcoded|Claude)/ }).click();
  await expect(modePill).not.toHaveAttribute("data-mode", startMode || "claude");
  // Flip back.
  await page.getByRole("button", { name: /Switch to (hardcoded|Claude)/ }).click();
  await expect(modePill).toHaveAttribute("data-mode", startMode || "claude");

  // Set a shared access password.
  await page.getByTestId("set-password-input").fill("open-sesame");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByTestId("password-state")).toHaveAttribute("data-has", "yes");

  try {
    // A fresh visitor now needs the password to sign up.
    await context.clearCookies();
    await page.goto("/signup");
    await expect(page.getByTestId("access-password-input")).toBeVisible();

    await page.getByLabel("Email").fill(uniqueEmail("friend"));
    await page.getByLabel("Password", { exact: true }).fill("regenerate123");
    await page.getByTestId("access-password-input").fill("wrong-one");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/access password isn.t right/i)).toBeVisible();

    // The correct password lets them in.
    await page.getByTestId("access-password-input").fill("open-sesame");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/onboarding");
  } finally {
    // Cleanup: the friend is also an admin in e2e — clear the password so the rest
    // of the suite's signups stay open.
    await page.goto("/curate");
    await page.getByTestId("set-password-input").fill("");
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.getByTestId("password-state")).toHaveAttribute("data-has", "no");
  }
});
