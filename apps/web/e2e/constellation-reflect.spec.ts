import { test, expect } from "@playwright/test";
import { uniqueEmail, signup, onboard, grantPremium } from "./helpers";

// The reflection companion (Telegram + MCP) can draw on WHO you're woven with, not
// just your own reading — so you can ask "how do I relate to Josie?" and it finds
// her through your constellation. This exercises the consent-gated data path via
// the deterministic MCP `my_constellations` tool (no Claude needed).
test("MCP my_constellations surfaces consented kin + relational read", async ({ browser }) => {
  const mayaEmail = uniqueEmail("maya");
  const josieEmail = uniqueEmail("josie");

  const mayaCtx = await browser.newContext();
  const josieCtx = await browser.newContext();
  const maya = await mayaCtx.newPage();
  const josie = await josieCtx.newPage();

  // Two people take their readings with distinct first names.
  await signup(maya, mayaEmail);
  await onboard(maya, { name: "Maya", place: "Berlin, Germany" });
  await signup(josie, josieEmail);
  await onboard(josie, { name: "Josie", place: "Tokyo, Japan", date: "1988-03-21", time: "09:15" });

  // Maya weaves a constellation and invites Josie.
  await maya.goto("/constellations");
  await maya.getByPlaceholder("e.g. Cascadia weavers").fill("Kin Test");
  await maya.getByRole("button", { name: "Create" }).click();
  await maya.waitForURL("**/constellations/**");
  await maya.getByPlaceholder("their@email.com").fill(josieEmail);
  await maya.getByRole("button", { name: "Send invitation" }).click();
  await expect(maya.getByText(/Invitation sent/)).toBeVisible();

  // Consent gate: before Josie consents, Maya cannot see her (kin list is empty).
  await grantPremium(maya, mayaEmail);
  await maya.goto("/settings");
  await maya.getByRole("button", { name: "Generate MCP token" }).click();
  const token = (await maya.getByTestId("mcp-token").textContent())?.trim();
  expect(token).toBeTruthy();

  const callKin = async () => {
    const res = await maya.request.post("/api/mcp", {
      headers: { authorization: `Bearer ${token}` },
      data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "my_constellations", arguments: {} } },
    });
    const body = await res.json();
    return String(body.result?.content?.[0]?.text || "");
  };

  const before = await callKin();
  expect(before).not.toContain("Josie"); // not yet consented

  // Josie actively consents to being woven with Maya.
  await josie.goto("/constellations");
  await expect(josie.getByTestId("pending-invite")).toBeVisible();
  await josie.getByRole("button", { name: "Consent & join" }).click();
  await expect(josie.getByTestId("joined-constellation")).toBeVisible();

  // Now Maya's kin list includes Josie, her gifts, and the relational read.
  const after = await callKin();
  expect(after).toContain("Josie");
  expect(after).toMatch(/gifts:/i);

  await mayaCtx.close();
  await josieCtx.close();
});
