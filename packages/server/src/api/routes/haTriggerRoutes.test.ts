import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest"

import { resetStore } from "../jobStore.js"
import { haTriggerRoutes } from "./haTriggerRoutes.js"

afterEach(() => {
  resetStore()
  delete process.env.HA_TRIGGER_TOKEN
})

const VALID_SEQUENCE_BODY = {
  steps: [
    {
      command: "copyFiles",
      id: "step1",
      kind: "step",
      params: { sourcePath: "/tmp/src" },
    },
  ],
}

// ─── Auth-off path (HA_TRIGGER_TOKEN unset) ───────────────────────────────────

describe("POST /jobs/named/sync-mux-magic — auth disabled", () => {
  beforeEach(() => {
    delete process.env.HA_TRIGGER_TOKEN
  })

  test("accepts requests without X-HA-Token header and returns 202", async () => {
    const response = await haTriggerRoutes.request(
      "/jobs/named/sync-mux-magic",
      {
        body: JSON.stringify(VALID_SEQUENCE_BODY),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    )

    expect(response.status).toBe(202)
    const body = (await response.json()) as {
      jobId: string
      logsUrl: string
    }
    expect(body.jobId).toBeDefined()
    expect(body.logsUrl).toMatch(/^\/jobs\/.+\/logs$/)
  })
})

// ─── Auth-on path (HA_TRIGGER_TOKEN set) ─────────────────────────────────────

describe("POST /jobs/named/sync-mux-magic — auth enabled", () => {
  beforeEach(() => {
    process.env.HA_TRIGGER_TOKEN = "secret-token-abc"
  })

  test("returns 202 when X-HA-Token matches the configured token", async () => {
    const response = await haTriggerRoutes.request(
      "/jobs/named/sync-mux-magic",
      {
        body: JSON.stringify(VALID_SEQUENCE_BODY),
        headers: {
          "Content-Type": "application/json",
          "X-HA-Token": "secret-token-abc",
        },
        method: "POST",
      },
    )

    expect(response.status).toBe(202)
  })

  test("returns 401 when X-HA-Token is wrong", async () => {
    const response = await haTriggerRoutes.request(
      "/jobs/named/sync-mux-magic",
      {
        body: JSON.stringify(VALID_SEQUENCE_BODY),
        headers: {
          "Content-Type": "application/json",
          "X-HA-Token": "wrong-token",
        },
        method: "POST",
      },
    )

    expect(response.status).toBe(401)
    const body = (await response.json()) as {
      error: string
    }
    expect(body.error).toMatch(/unauthorized/i)
  })

  test("returns 401 when X-HA-Token header is absent", async () => {
    const response = await haTriggerRoutes.request(
      "/jobs/named/sync-mux-magic",
      {
        body: JSON.stringify(VALID_SEQUENCE_BODY),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    )

    expect(response.status).toBe(401)
  })
})
