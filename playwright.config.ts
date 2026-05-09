import { readFileSync } from "node:fs"
import { defineConfig, devices } from "@playwright/test"

// E2E tests against the builder UI. The api-server boots an HTTP server
// on whichever PORT the project's .env declares, serves
// /api/builder/index.html from public/, and exposes /commands/* +
// /queries/*. Playwright drives it through Chromium.
//
// We sniff PORT out of .env at config-load time so this file tracks the
// user's local port choice without anyone having to keep two configs in
// sync. Defaults to 3000 if .env is absent or has no PORT line.
//
// To run interactively: `yarn e2e:ui`. CI / one-shot: `yarn e2e`.
const port = (() => {
  try {
    const env = readFileSync(".env", "utf8")
    const match = /^PORT\s*=\s*(\d+)\s*$/m.exec(env)
    if (match) return Number(match[1])
  } catch {}
  return 3000
})()

const baseURL = `http://localhost:${port}`

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
  // Boots the api-server before tests run; reuses an existing server in
  // dev so re-running locally is fast (no cold-start penalty).
  webServer: {
    command: "yarn start-server",
    url: `${baseURL}/builder/`,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 30 * 1000,
  },
})
