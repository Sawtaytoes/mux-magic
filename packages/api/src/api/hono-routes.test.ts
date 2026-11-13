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

describe("origin policy", () => {
  const originalAllowedOrigins =
    process.env.CORS_ALLOWED_ORIGINS
  const originalPublicUrl = process.env.PUBLIC_URL
  const originalAllowedHosts = process.env.ALLOWED_HOSTS
  const originalNodeEnv = process.env.NODE_ENV

  const restoreEnv = (
    name: string,
    value: string | undefined,
  ) => {
    if (value === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = value
    }
  }

  afterEach(() => {
    restoreEnv(
      "CORS_ALLOWED_ORIGINS",
      originalAllowedOrigins,
    )
    restoreEnv("PUBLIC_URL", originalPublicUrl)
    restoreEnv("ALLOWED_HOSTS", originalAllowedHosts)
    restoreEnv("NODE_ENV", originalNodeEnv)
  })

  test("does not echo a foreign origin in CORS headers", async () => {
    const response = await app.request(
      "http://mux.example/version",
      { headers: { Origin: "https://evil.example" } },
    )

    expect(response.status).toBe(200)
    expect(
      response.headers.get("access-control-allow-origin"),
    ).toBe(null)
  })

  test("allows the app's own host, even when a proxy ends TLS", async () => {
    const response = await app.request(
      "http://mux.example/version",
      {
        headers: {
          Host: "mux.example",
          Origin: "https://mux.example",
        },
      },
    )

    expect(
      response.headers.get("access-control-allow-origin"),
    ).toBe("https://mux.example")
  })

  test("allows an origin listed in CORS_ALLOWED_ORIGINS", async () => {
    process.env.CORS_ALLOWED_ORIGINS =
      "https://dashboard.example, https://other.example"

    const response = await app.request(
      "http://mux.example/version",
      { headers: { Origin: "https://other.example" } },
    )

    expect(
      response.headers.get("access-control-allow-origin"),
    ).toBe("https://other.example")
  })

  test("refuses a cross-origin write before it reaches the route", async () => {
    const response = await app.request(
      "http://mux.example/templates",
      {
        method: "POST",
        headers: {
          Host: "mux.example",
          Origin: "https://evil.example",
          "Content-Type": "text/plain",
        },
        body: JSON.stringify({
          name: "Demo",
          yaml: "steps: []",
        }),
      },
    )

    expect(response.status).toBe(403)
    const body = (await response.json()) as {
      error: string
    }
    expect(body.error).toContain("https://evil.example")
  })

  test("refuses a write from an opaque null origin", async () => {
    const response = await app.request(
      "http://mux.example/templates",
      {
        method: "POST",
        headers: { Origin: "null" },
        body: "{}",
      },
    )

    expect(response.status).toBe(403)
  })

  test("lets a write with no Origin header through (curl, Home Assistant)", async () => {
    const response = await app.request(
      "/templates/missing",
      {
        method: "DELETE",
      },
    )

    expect(response.status).not.toBe(403)
  })

  test("lets a same-origin write through", async () => {
    const response = await app.request(
      "http://mux.example/templates/missing",
      {
        method: "DELETE",
        headers: {
          Host: "mux.example",
          Origin: "http://mux.example",
        },
      },
    )

    expect(response.status).not.toBe(403)
  })

  test("refuses a text/plain write with no Origin (a JSON body is required)", async () => {
    const response = await app.request("/templates", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        name: "Demo",
        yaml: "steps: []",
      }),
    })

    expect(response.status).toBe(415)
  })

  test("refuses a bodiless POST with no Content-Type, Origin, or Sec-Fetch-Site", async () => {
    const response = await app.request(
      "/jobs/missing/cancel",
      { method: "POST" },
    )

    expect(response.status).toBe(415)
  })

  test("lets a bodiless POST through when it sends a JSON Content-Type", async () => {
    const response = await app.request(
      "/jobs/missing/cancel",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    )

    expect(response.status).not.toBe(415)
    expect(response.status).not.toBe(403)
  })

  test("refuses every request on a Host outside ALLOWED_HOSTS, reads included", async () => {
    process.env.ALLOWED_HOSTS = "mux.example"

    const response = await app.request(
      "http://rebound.example/version",
      { headers: { Host: "rebound.example" } },
    )

    expect(response.status).toBe(421)
    const body = (await response.json()) as {
      error: string
    }
    expect(body.error).toContain("ALLOWED_HOSTS")
  })

  test("refuses a DNS-rebinding write, even though its Origin matches its Host", async () => {
    process.env.ALLOWED_HOSTS = "mux.example"

    const response = await app.request(
      "http://rebound.example/templates/missing",
      {
        method: "DELETE",
        headers: {
          Host: "rebound.example",
          Origin: "http://rebound.example",
        },
      },
    )

    expect(response.status).toBe(421)
  })

  test("lets a same-origin write through on a listed Host", async () => {
    process.env.ALLOWED_HOSTS = "mux.example"
    process.env.NODE_ENV = "production"

    const response = await app.request(
      "http://mux.example/templates/missing",
      {
        method: "DELETE",
        headers: {
          Host: "mux.example",
          Origin: "https://mux.example",
          "Sec-Fetch-Site": "same-origin",
        },
      },
    )

    expect(response.status).toBe(404)
  })

  test("in production, an empty ALLOWED_HOSTS refuses a write from a non-loopback Host", async () => {
    delete process.env.ALLOWED_HOSTS
    process.env.NODE_ENV = "production"

    const response = await app.request(
      "http://mux.example/templates/missing",
      {
        method: "DELETE",
        headers: { Host: "mux.example" },
      },
    )

    expect(response.status).toBe(421)
    const body = (await response.json()) as {
      error: string
    }
    expect(body.error).toContain("ALLOWED_HOSTS")
  })

  test("in production, an empty ALLOWED_HOSTS still serves reads and loopback writes", async () => {
    delete process.env.ALLOWED_HOSTS
    process.env.NODE_ENV = "production"

    const read = await app.request(
      "http://mux.example/version",
      { headers: { Host: "mux.example" } },
    )
    const loopbackWrite = await app.request(
      "http://localhost:3000/templates/missing",
      {
        method: "DELETE",
        headers: { Host: "localhost:3000" },
      },
    )

    expect(read.status).toBe(200)
    expect(loopbackWrite.status).toBe(404)
  })
})
