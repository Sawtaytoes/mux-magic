import { afterEach, describe, expect, test } from "vitest"

import { app } from "./hono-routes.js"
import { __setTemplateStoreForTests } from "./routes/templateRoutes.js"
import type { TemplateStore } from "./templateStore.js"

afterEach(() => __setTemplateStoreForTests(null))

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

  test("surfaces an unhandled handler throw as a structured JSON 500 (not a bare 'Internal Server Error')", async () => {
    // Simulate the Docker failure mode: the template store's write throws
    // an EACCES because APP_DATA_DIR isn't writable. Without the onError
    // net the client only saw "Internal Server Error"; now the real cause
    // (path + errno) rides back in `details`.
    const failingStore: TemplateStore = {
      listTemplates: async () => [],
      getTemplate: async () => null,
      createTemplate: async () => {
        throw new Error(
          "EACCES: permission denied, open '/app/.config/templates.json.tmp'",
        )
      },
      updateTemplate: async () => null,
      deleteTemplate: async () => false,
    }
    __setTemplateStoreForTests(failingStore)

    const response = await app.request("/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Demo",
        yaml: "steps: []",
      }),
    })

    expect(response.status).toBe(500)
    const body = (await response.json()) as {
      error: string
      details: string
    }
    expect(body.error).toBe("internal server error")
    expect(body.details).toContain("EACCES")
    expect(body.details).toContain("/app/.config")
  })
})
