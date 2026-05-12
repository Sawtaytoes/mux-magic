import { defineConfig, devices } from "@playwright/test"
import {
  apiBaseUrl,
  webBaseUrl,
} from "./e2e/playwright.setup.js"

// E2E tests against the React app. Post-react-migration, the React SPA is
// served by the dev web-server at WEB_PORT (default 5173). The api-server
// still runs at PORT (default 3000) for backend HTTP calls made from the
// browser. Playwright navigates to the SPA, so use.baseURL points at the
// web server; the webServer entries below still boot both because the SPA
// hits the API at runtime.
//
// Ports come from process.env (shell / CI workflow) first, falling back
// to .env if present, then to the same defaults as
// packages/server/src/tools/envVars.ts. Node's loadEnvFile won't
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
    baseURL: webBaseUrl,
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
      name: "API",
      command: "yarn prod:api-server",
      url: `${apiBaseUrl}/`,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 30 * 1000,
    },
    {
      name: "Web",
      command: "yarn prod:web-server",
      url: `${webBaseUrl}/`,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 30 * 1000,
    },
  ],
})
