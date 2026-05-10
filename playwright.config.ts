import { defineConfig, devices } from "@playwright/test"

// E2E tests against the builder UI. The api-server boots an HTTP server
// on whichever PORT the project's .env declares, serves
// /api/builder/index.html from public/, and exposes /commands/* +
// /queries/*. Playwright drives it through Chromium.
//
// Ports come from process.env (shell / CI workflow) first, falling back
// to .env if present, then to the same defaults as
// packages/server/src/tools/envVars.ts. Node's loadEnvFile won't
// overwrite a process.env value that's already set, so shell wins.
//
// To run interactively: `yarn e2e:ui`. CI / one-shot: `yarn e2e`.
try {
  process.loadEnvFile()
} catch {}

const port = Number(process.env.PORT ?? 3000)
const webPort = Number(process.env.WEB_PORT ?? 4173)

const baseURL = `http://localhost:${port}`
const webBaseURL = `http://localhost:${webPort}`

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Boots both servers before tests run; reuses existing servers in dev
  // so re-running locally is fast (no cold-start penalty).
  webServer: [
    {
      command: "yarn prod:api-server",
      url: `${baseURL}/builder/`,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 30 * 1000,
    },
    {
      command: "yarn prod:web-server",
      url: `${webBaseURL}/`,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 30 * 1000,
    },
  ],
})
