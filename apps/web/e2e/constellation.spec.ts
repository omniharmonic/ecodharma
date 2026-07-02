import { test, expect } from "@playwright/test";
import { uniqueEmail, signupAndRead, login, logout } from "./helpers";

test("Journey B — consent-gated constellation: invite → consent → woven read", async ({ browser }) => {
  const ownerEmail = uniqueEmail("owner");
  const kinEmail = uniqueEmail("kin");

  // Two people each take their reading (separate browser contexts).
  const ownerCtx = await browser.newContext();
  const kinCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  const kin = await kinCtx.newPage();

  await signupAndRead(owner, ownerEmail, "bioregional finance and cooperative economics");
  await signupAndRead(kin, kinEmail, "somatic healing and collective trauma work");

  // Owner composes a constellation.
  await owner.goto("/constellations");
  await owner.getByPlaceholder("e.g. Cascadia weavers").fill("Test Weave");
  await owner.getByRole("button", { name: "Create" }).click();
  await owner.waitForURL("**/constellations/**");
  const url = owner.url();

  // Owner can rename the constellation after creating it.
  await owner.getByPlaceholder("Constellation name").fill("Renamed Weave");
  await owner.getByRole("button", { name: "Save name" }).click();
  await expect(owner.getByRole("heading", { name: "Renamed Weave" })).toBeVisible();

  // Owner invites the kin.
  await owner.getByPlaceholder("their@email.com").fill(kinEmail);
  await owner.getByRole("button", { name: "Send invitation" }).click();
  await expect(owner.getByText(/Invitation sent/)).toBeVisible();

  // CONSENT GATE: before the kin consents, the read cannot include them.
  await owner.getByRole("button", { name: "Generate constellation read" }).click();
  await expect(owner.getByText(/Need at least two consented members/)).toBeVisible();
  await expect(owner.getByTestId("constellation-read")).toHaveCount(0);

  // Kin sees the pending invitation and actively consents.
  await kin.goto("/constellations");
  await expect(kin.getByTestId("pending-invite")).toBeVisible();
  await kin.getByRole("button", { name: "Consent & join" }).click();
  // After consenting, the invite moves from "pending" to "joined".
  await expect(kin.getByTestId("joined-constellation")).toBeVisible();
  await expect(kin.getByTestId("pending-invite")).toHaveCount(0);

  // A joined (non-owner) member can OPEN the constellation and see it.
  await kin.getByTestId("joined-constellation").getByRole("link").click();
  await kin.waitForURL("**/constellations/**");
  await expect(kin.getByRole("heading", { name: "Renamed Weave" })).toBeVisible();
  await expect(kin.getByTestId("member-row").first()).toBeVisible();
  // Members are not owners: no invite/generate/rename controls for them.
  await expect(kin.getByRole("button", { name: "Save name" })).toHaveCount(0);

  // Now the owner can weave the read.
  await owner.goto(url);
  await owner.getByRole("button", { name: "Generate constellation read" }).click();
  await expect(owner.getByTestId("constellation-read")).toBeVisible({ timeout: 45_000 });
  await expect(owner.getByText("The constellation read")).toBeVisible();
  await expect(owner.getByText("Weaving guidance")).toBeVisible();

  // The Human Design relational substrate is computed from both members'
  // consented HD signatures and rendered beneath the gift read.
  await expect(owner.getByTestId("relational-substrate")).toBeVisible();
  await expect(owner.getByTestId("penta-filled")).toBeVisible();

  // REVOCATION: kin revokes; a fresh read should again refuse.
  await kin.goto("/constellations");
  await kin.getByRole("button", { name: "Revoke consent" }).click();
  await expect(kin.getByText(/Consent revoked/)).toBeVisible();

  await owner.goto(url);
  await owner.getByRole("button", { name: "Generate constellation read" }).click();
  await expect(owner.getByText(/Need at least two consented members/)).toBeVisible();

  await ownerCtx.close();
  await kinCtx.close();
});
