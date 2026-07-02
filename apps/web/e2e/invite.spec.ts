import { test, expect } from "@playwright/test";
import { uniqueEmail, signupAndRead } from "./helpers";

test("constellation join links: redeem once, then the capped link is used up", async ({ browser }) => {
  const ownerCtx = await browser.newContext();
  const kinCtx = await browser.newContext();
  const latecomerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  const kin = await kinCtx.newPage();
  const latecomer = await latecomerCtx.newPage();

  await signupAndRead(owner, uniqueEmail("linkowner"));
  await signupAndRead(kin, uniqueEmail("linkkin"));
  await signupAndRead(latecomer, uniqueEmail("linklate"));

  // Owner composes a constellation and mints a single-use join link.
  await owner.goto("/constellations");
  await owner.getByPlaceholder("e.g. Cascadia weavers").fill("Link Weave");
  await owner.getByRole("button", { name: "Create" }).click();
  await owner.waitForURL("**/constellations/**");

  await owner.getByLabel("Max uses (blank = unlimited)").fill("1");
  await owner.getByRole("button", { name: "Create join link" }).click();
  const inviteUrl = await owner.getByTestId("invite-link").inputValue();
  expect(inviteUrl).toMatch(/\/invite\/[A-Za-z0-9_-]+$/);
  const path = new URL(inviteUrl).pathname;

  // Kin redeems the link → becomes a pending member → consents.
  await kin.goto(path);
  await kin.waitForURL("**/constellations**");
  await expect(kin.getByTestId("pending-invite")).toBeVisible();
  await kin.getByRole("button", { name: "Consent & join" }).click();
  await expect(kin.getByTestId("joined-constellation")).toBeVisible();

  // The single use is now spent — a latecomer is turned away.
  await latecomer.goto(path);
  await expect(latecomer.getByText(/used up/i)).toBeVisible();

  await ownerCtx.close();
  await kinCtx.close();
  await latecomerCtx.close();
});
