import { mkdir } from "node:fs/promises"

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import {
  __resetDeliveryDepsForTests,
  __setDeliveryDepsForTests,
  cancelAllScheduledDeliveriesForTests,
} from "../jobErrorDeliveryQueue.js"
import {
  __resetJobErrorStoreForTests,
  addJobError,
  getJobError,
  type PersistedJobError,
} from "../jobErrorStore.js"
import { errorRoutes } from "./errorRoutes.js"

const storePath = "/test-error-routes/job-errors.json"

const makeRecord = (
  overrides: Partial<PersistedJobError> = {},
): PersistedJobError => ({
  id: "rec_1",
  jobId: "job_1",
  level: "error",
  msg: "boom",
  occurredAt: "2026-05-15T11:59:59.000Z",
  webhookDelivery: {
    attempts: 0,
    state: "pending",
  },
  ...overrides,
})

beforeEach(async () => {
  await mkdir("/test-error-routes", { recursive: true })
  __resetJobErrorStoreForTests(storePath)
  __setDeliveryDepsForTests({
    fetch: vi.fn() as unknown as typeof globalThis.fetch,
    getWebhookUrl: () => undefined,
  })
})

afterEach(() => {
  cancelAllScheduledDeliveriesForTests()
  __resetDeliveryDepsForTests()
})

describe("GET /errors", () => {
  test("returns the persisted list newest first", async () => {
    await addJobError(
      makeRecord({
        id: "a",
        occurredAt: "2026-01-01T00:00:00.000Z",
      }),
    )
    await addJobError(
      makeRecord({
        id: "b",
        occurredAt: "2026-02-01T00:00:00.000Z",
      }),
    )

    const response = await errorRoutes.request("/errors")

    expect(response.status).toBe(200)
    const body = (await response.json()) as Array<{
      id: string
    }>
    expect(body.map(({ id }) => id)).toEqual(["b", "a"])
  })

  test("filters by ?state=pending", async () => {
    await addJobError(makeRecord({ id: "a" }))
    await addJobError(
      makeRecord({
        id: "b",
        webhookDelivery: {
          attempts: 1,
          state: "delivered",
        },
      }),
    )

    const response = await errorRoutes.request(
      "/errors?state=pending",
    )

    const body = (await response.json()) as Array<{
      id: string
    }>
    expect(body.map(({ id }) => id)).toEqual(["a"])
  })

  test("filters by ?jobId=…", async () => {
    await addJobError(makeRecord({ id: "a", jobId: "j1" }))
    await addJobError(makeRecord({ id: "b", jobId: "j2" }))

    const response = await errorRoutes.request(
      "/errors?jobId=j2",
    )

    const body = (await response.json()) as Array<{
      id: string
    }>
    expect(body.map(({ id }) => id)).toEqual(["b"])
  })
})

describe("GET /errors/:id", () => {
  test("returns 200 with the record", async () => {
    await addJobError(makeRecord({ id: "x" }))
    const response = await errorRoutes.request("/errors/x")
    expect(response.status).toBe(200)
    const body = (await response.json()) as { id: string }
    expect(body.id).toBe("x")
  })

  test("returns 404 for unknown id", async () => {
    const response = await errorRoutes.request(
      "/errors/missing",
    )
    expect(response.status).toBe(404)
  })
})

describe("POST /errors/:id/redeliver", () => {
  test("flips an exhausted record back to pending and re-queues", async () => {
    await addJobError(
      makeRecord({
        webhookDelivery: {
          attempts: 8,
          lastError: "HTTP 500",
          state: "exhausted",
        },
      }),
    )

    const response = await errorRoutes.request(
      "/errors/rec_1/redeliver",
      { method: "POST" },
    )

    expect(response.status).toBe(200)
    const body =
      (await response.json()) as PersistedJobError
    expect(body.webhookDelivery.state).toBe("pending")
    expect(body.webhookDelivery.attempts).toBe(0)
    expect(
      getJobError("rec_1")?.webhookDelivery.state,
    ).toBe("pending")
  })

  test("returns 404 for unknown id", async () => {
    const response = await errorRoutes.request(
      "/errors/missing/redeliver",
      { method: "POST" },
    )
    expect(response.status).toBe(404)
  })
})

describe("DELETE /errors/:id", () => {
  test("204 on success, record gone", async () => {
    await addJobError(makeRecord({ id: "x" }))

    const response = await errorRoutes.request(
      "/errors/x",
      { method: "DELETE" },
    )

    expect(response.status).toBe(204)
    expect(getJobError("x")).toBeUndefined()
  })

  test("404 for unknown id", async () => {
    const response = await errorRoutes.request(
      "/errors/missing",
      { method: "DELETE" },
    )
    expect(response.status).toBe(404)
  })
})
