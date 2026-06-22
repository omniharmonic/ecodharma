import { test, expect } from "@playwright/test";
import { uniqueEmail, signup } from "./helpers";

test("login rejects a wrong password", async ({ page }) => {
  const email = uniqueEmail("auth");
  await signup(page, email); // creates account → lands on /onboarding (logged in)
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/");

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("definitely-wrong-pw");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
});

test("signup rejects a duplicate email", async ({ page }) => {
  const email = uniqueEmail("dup");
  await signup(page, email);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/");

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("regenerate123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("An account with that email already exists.")).toBeVisible();
});

test("signup enforces the minimum password length", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(uniqueEmail("short"));
  await page.getByLabel("Password").fill("short"); // < 8 → browser blocks submit
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/signup/);
  await expect(page.getByRole("heading", { name: "Begin your reading" })).toBeVisible();
});
