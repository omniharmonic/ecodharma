import { test, expect } from "@playwright/test";
import { uniqueEmail, signupAndRead } from "./helpers";

test("social share cards: mint a public link, unfurl it, then disable it", async ({ page, browser }) => {
  await signupAndRead(page, uniqueEmail("share"));

  // Mint the share link from the profile.
  await page.getByRole("button", { name: "Create a share card" }).click();

  // The preview image + copyable link appear.
  const linkField = page.getByLabel("Public share link");
  await expect(linkField).toBeVisible();
  const shareUrl = await linkField.inputValue();
  expect(shareUrl).toMatch(/\/r\/[A-Za-z0-9_-]+$/);
  const token = shareUrl.split("/r/")[1];
  await expect(page.getByAltText("Your shareable reading card")).toBeVisible();

  // The OG image renders as a PNG.
  const og = await page.request.get(`/api/og/${token}?size=og`);
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toContain("image/png");
  const square = await page.request.get(`/api/og/${token}?size=square`);
  expect(square.status()).toBe(200);

  // A logged-out visitor sees the public card + a signup CTA (only whitelisted data).
  const anonCtx = await browser.newContext();
  const anon = await anonCtx.newPage();
  await anon.goto(`/r/${token}`);
  await expect(anon.getByText("EcoDharma · shared reading")).toBeVisible();
  await expect(anon.locator(".border-accent\\/50").first()).toBeVisible(); // an archetype tag
  await expect(anon.getByRole("link", { name: /Discover your own gifts/ })).toBeVisible();
  await anonCtx.close();

  // Disable → both the page and the image 404.
  await page.getByRole("button", { name: "Disable link" }).click();
  await expect(page.getByRole("button", { name: "Create a share card" })).toBeVisible();

  const anon2Ctx = await browser.newContext();
  const anon2 = await anon2Ctx.newPage();
  const gone = await anon2.goto(`/r/${token}`);
  expect(gone?.status()).toBe(404);
  const ogGone = await anon2.request.get(`/api/og/${token}?size=og`);
  expect(ogGone.status()).toBe(404);
  await anon2Ctx.close();
});
