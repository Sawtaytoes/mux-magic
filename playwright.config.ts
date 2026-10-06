import {
  createPlaywrightConfig,
  createViewportProjects,
} from "@charcuterie/playwright-config"
import { baseUrl } from "./e2e/playwright.setup.js"

// Every spec runs in the fleet's four windows — `chromium-narrow` (a
// 384x824 phone), `chromium-tall`, `chromium-wide` and `chromium-ultrawide`.
//
// A test whose claim is true in only one kind of window carries a tag, and
// the tag decides which windows collect it: `@narrow-view` runs only in the
// narrow window and `@wide-view` in the other three. Filtering by tag here,
// rather than calling `test.skip()` inside the test, keeps the report at
// zero skipped (docs/decisions/2026-09-16-a-skipped-test-is-a-defect-and-
// the-suites-report-zero.md) — a test a window cannot hold is not collected
// there at all, and every window still gets the claim that IS true in it.
const narrowViewTag = /@narrow-view/
const wideViewTag = /@wide-view/

const projects = createViewportProjects().map((project) =>
  project.metadata?.viewport === "narrow"
    ? { ...project, grepInvert: wideViewTag }
    : { ...project, grepInvert: narrowViewTag },
)

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
// To run interactively: `pnpm e2e:ui`. CI / one-shot: `pnpm e2e`.
//
// The four window projects, the CI-aware retries/workers and
// trace-on-first-retry come from `@charcuterie/playwright-config`; what stays
// here is mux-magic's own — where the specs live, the server they drive, and
// the tag routing above.
export default createPlaywrightConfig({
  projects,
  testDir: "./e2e",
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: baseUrl,
  },
  webServer: {
    command: "pnpm prod:server",
    url: `${baseUrl}/`,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 60 * 1000,
  },
})
