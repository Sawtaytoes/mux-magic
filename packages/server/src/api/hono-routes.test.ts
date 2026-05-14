import { describe, expect, test } from "vitest"

import { app } from "./hono-routes.js"

// Boot smoke: imports the full Hono route registry (which transitively
// imports every app-command via the API routes). After worker 20
// extracted the CLI layer into @mux-magic/cli, server must no longer
// depend on yargs or anything else CLI-only. If a server module ever
// re-introduces a CLI-only import, this test fails at the import phase
// — before any expectations run. The `/version` endpoint is the cheap
// liveness probe (dev-fallback ensures it answers without prebuild).
describe("Hono app", () => {
  test("boots and answers GET /version with 200", async () => {
    const response = await app.request("/version")

    expect(response.status).toBe(200)
  })
})
