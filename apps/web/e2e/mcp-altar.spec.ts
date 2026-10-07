import { test, expect } from "@playwright/test";
import { uniqueEmail, signup, signupAndRead } from "./helpers";

// MCP v2 — the Living Altar from Claude. The person holds the pen: Claude can
// read, journal in their words, and confirm strands with their say-so, but core
// altar changes are only PROPOSED and must be accepted in the app.
test("Claude over MCP: altar → ritual → log → confirm → propose → story", async ({ browser }) => {
  const adminCtx = await browser.newContext();
  const memberCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  const member = await memberCtx.newPage();
  const email = uniqueEmail("mcpaltar");
  await signup(admin, uniqueEmail("mcpadmin"));
  await signupAndRead(member, email);
  await admin.goto("/curate");
  await admin.getByTestId("comp-email").fill(email);
  await admin.getByRole("button", { name: "Grant premium" }).click();
  await expect(admin.getByText(/Premium granted/)).toBeVisible();

  // Kindle.
  await member.goto("/altar/kindle");
  await member.getByLabel("Your prayer, in your own words").fill("May my life weave the commons back into wholeness.");
  await member.locator('textarea[name="custom_work"]').fill("Building EcoDharma");
  await member.locator('textarea[name="custom_root"]').fill("I must hustle to be worthy");
  await member.getByRole("button", { name: "Light the altar" }).click();
  await member.waitForURL("**/altar?kindled=1");

  await member.goto("/settings");
  await member.getByRole("button", { name: "Generate MCP token" }).click();
  const token = (await member.getByTestId("mcp-token").textContent())?.trim();
  const rpc = async (id: number, method: string, params?: any) => {
    const r = await member.request.post("/api/mcp", { headers: { authorization: `Bearer ${token}` }, data: { jsonrpc: "2.0", id, method, ...(params ? { params } : {}) } });
    return r.json();
  };
  const call = async (name: string, args: any = {}) => (await rpc(9, "tools/call", { name, arguments: args })).result.content[0].text as string;

  const init = await rpc(1, "initialize");
  expect(init.result.serverInfo.version).toBe("2.0.0");
  expect(init.result.instructions).toMatch(/holds the pen/);
  const names = (await rpc(2, "tools/list")).result.tools.map((t: any) => t.name);
  for (const n of ["get_altar", "get_ritual", "log_reflection", "confirm_strands", "list_reflections", "open_inquiry", "update_inquiry", "propose_element_change", "get_becoming", "assemble_story", "constellation_pulse", "my_reading", "reflect"]) {
    expect(names).toContain(n);
  }

  const altar = await call("get_altar");
  expect(altar).toContain("weave the commons");
  const workId = Number(/\[(\d+)\] Building EcoDharma/.exec(altar)![1]);
  const rootId = Number(/\[(\d+)\] I must hustle/.exec(altar)![1]);

  const ritual = await call("get_ritual");
  expect(ritual).toMatch(/DUE: .*|Nothing is due/);

  const logged = await call("log_reflection", {
    body: "Building EcoDharma lit me up this week. But I must hustle to be worthy feels exhausting and I wonder if it's true.",
    cadence: "weekly", evidence: ["calendar: 14h on EcoDharma"], alignment: { aliveness: 4, fidelity: 5 },
  });
  expect(logged).toMatch(/Saved reflection \d+ \(sealed\)/);
  const strandIds = [...logged.matchAll(/strand (\d+):/g)].map((m) => Number(m[1]));
  expect(strandIds.length).toBeGreaterThan(0);
  expect(logged).toContain("Building EcoDharma");
  expect(await call("confirm_strands", { confirm: strandIds })).toContain("woven");

  const listed = await call("list_reflections", { element_id: workId });
  expect(listed).toContain("lit me up");
  expect(listed).toContain("confirmed");

  expect(await call("open_inquiry", { question: "What would it mean to be worthy without hustle?", root_id: rootId })).toMatch(/Inquiry opened \[\d+\]/);
  expect(await call("get_altar")).toContain("(questioning)");

  // Proposals never apply directly.
  const prop = await call("propose_element_change", { element_id: rootId, kind: "root", status: "composting", rationale: "You named it as exhausting three times." });
  expect(prop).toMatch(/waiting on their altar page/);
  expect(await call("get_altar")).toContain("I must hustle to be worthy (questioning)");
  await member.goto("/altar");
  await expect(member.getByTestId("proposals")).toContainText("composting");
  await member.getByTestId("proposals").getByRole("button", { name: "Accept" }).click();
  await expect(member.getByTestId("proposals")).toHaveCount(0); // accepted → no longer pending
  expect(await call("get_altar")).toContain("I must hustle to be worthy (composting)");

  const becoming = await call("get_becoming");
  expect(becoming).toMatch(/LOOPS:/);
  expect(becoming).toContain("Building EcoDharma");
  const story = await call("assemble_story");
  expect(story).toMatch(/# Your story/);
  expect(story).toContain("lit me up");
  expect(await call("constellation_pulse")).toMatch(/not in a Dharma Constellation yet|✶/);

  await adminCtx.close();
  await memberCtx.close();
});
