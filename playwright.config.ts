import { defineConfig, devices } from "@playwright/test"
import { baseUrl } from "./e2e/playwright.setup.js"

// Worker 29 collapsed the two-process layout into a single front-door
// on PORT (default 3000) that hosts /api/*, /storybook/*, and / (SPA).
// E2E navigates to the SPA on `baseUrl`; the same origin serves the
// API, so the SPA's relative `/api` fetches resolve naturally.
//
// PORT comes from process.env (shell / CI workflow) first, falling back
// to .env if present, then to the same default as
// packages/core/src/tools/envVars.ts. Node's loadEnvFile won't
// overwrite a process.env value that's already set, so shell wins.
//
// To run interactively: `yarn e2e:ui`. CI / one-shot: `yarn e2e`.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: baseUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "yarn prod:server",
    url: `${baseUrl}/`,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 60 * 1000,
  },
})
