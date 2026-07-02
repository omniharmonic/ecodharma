import { defineConfig, devices } from "@playwright/test";

// E2E runs against its OWN Next server in fixture-interpreter mode (deterministic,
// fast, no token cost) on :3101 — independent of the dev server on :3100, which may
// use real Claude. Requires a prior `pnpm build`. Ephemeris (:8000) + pg (:54322)
// must be running.
const PORT = 3101;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm start -p ${PORT}`,
        url: `http://127.0.0.1:${PORT}`,
        reuseExistingServer: false,
        timeout: 60_000,
        env: { ECODHARMA_INTERPRETER: "fixture", ECODHARMA_BOT_TEST: "1" },
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
