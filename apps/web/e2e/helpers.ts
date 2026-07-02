import { expect, type Page } from "@playwright/test";

let counter = 0;
export function uniqueEmail(prefix = "kin"): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@ecodharma.test`;
}

export async function signup(page: Page, email: string, password = "regenerate123") {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding");
}

export async function login(page: Page, email: string, password = "regenerate123") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/profile");
}

export async function logout(page: Page) {
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/");
}

/** Complete onboarding (assumes we're already on /onboarding) → lands on /profile. */
export async function onboard(
  page: Page,
  opts: { date?: string; time?: string; place?: string; need?: string } = {},
) {
  const { date = "1990-06-15", time = "06:30", place = "Berlin, Germany" } = opts;
  await page.getByLabel("First name").fill("Ren");
  await page.getByLabel("Birth date").fill(date);
  await page.getByLabel("Birth time", { exact: true }).fill(time);
  await page.getByLabel("Birth place").fill(place);
  await page.getByLabel("What do you love? What makes you feel alive?").fill("Bringing people together around a shared dream.");
  await page.getByLabel("What are you genuinely good at?").fill("Listening deeply and seeing the pattern that connects.");
  await page.getByRole("button", { name: "Reveal my gift profile" }).click();
  await page.waitForURL("**/profile", { timeout: 45_000 });
}

/** Comp premium to an email via /curate (signed-in user is admin locally). */
export async function grantPremium(page: Page, email: string) {
  await page.goto("/curate");
  await page.getByTestId("comp-email").fill(email);
  await page.getByRole("button", { name: "Grant premium" }).click();
  await expect(page.getByText(/Premium granted/)).toBeVisible();
}

export async function signupAndRead(page: Page, email: string, need?: string) {
  await signup(page, email);
  await onboard(page, need ? { need } : {});
  await expect(page.getByTestId("recognition")).toBeVisible();
}
