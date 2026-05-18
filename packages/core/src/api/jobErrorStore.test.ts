import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises"

import { beforeEach, describe, expect, test } from "vitest"

import {
  __resetJobErrorStoreForTests,
  addJobError,
  applyEvictionPolicy,
  deleteJobError,
  ERROR_STORE_CAP,
  getJobError,
  listJobErrors,
  loadJobErrorsFromDisk,
  type PersistedJobError,
  updateJobError,
} from "./jobErrorStore.js"

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

const storePath = "/test-app-data/job-errors.json"

beforeEach(async () => {
  await mkdir("/test-app-data", { recursive: true })
  __resetJobErrorStoreForTests(storePath)
})

describe("applyEvictionPolicy", () => {
  test("returns input unchanged when under cap", () => {
    const errors = [
      makeRecord({ id: "a" }),
      makeRecord({ id: "b" }),
    ]
    expect(applyEvictionPolicy(errors, 10)).toEqual(errors)
  })

  test("evicts oldest delivered records first when over cap", () => {
    const errors = [
      makeRecord({
        id: "old-delivered",
        occurredAt: "2026-01-01T00:00:00.000Z",
        webhookDelivery: {
          attempts: 1,
          state: "delivered",
        },
      }),
      makeRecord({
        id: "old-exhausted",
        occurredAt: "2026-01-02T00:00:00.000Z",
        webhookDelivery: {
          attempts: 8,
          state: "exhausted",
        },
      }),
      makeRecord({
        id: "new-pending",
        occurredAt: "2026-05-15T00:00:00.000Z",
        webhookDelivery: { attempts: 0, state: "pending" },
      }),
    ]
    const result = applyEvictionPolicy(errors, 2)
    expect(result.map(({ id }) => id)).toEqual([
      "old-exhausted",
      "new-pending",
    ])
  })

  test("evicts oldest exhausted records when no delivered remain", () => {
    const errors = [
      makeRecord({
        id: "old-exhausted-1",
        occurredAt: "2026-01-01T00:00:00.000Z",
        webhookDelivery: {
          attempts: 8,
          state: "exhausted",
        },
      }),
      makeRecord({
        id: "old-exhausted-2",
        occurredAt: "2026-01-02T00:00:00.000Z",
        webhookDelivery: {
          attempts: 8,
          state: "exhausted",
        },
      }),
      makeRecord({
        id: "new-pending",
        occurredAt: "2026-05-15T00:00:00.000Z",
        webhookDelivery: { attempts: 0, state: "pending" },
      }),
    ]
    const result = applyEvictionPolicy(errors, 2)
    expect(result.map(({ id }) => id)).toEqual([
      "old-exhausted-2",
      "new-pending",
    ])
  })

  test("never evicts pending records, even when over cap", () => {
    const errors = [
      makeRecord({
        id: "p1",
        occurredAt: "2026-01-01T00:00:00.000Z",
        webhookDelivery: { attempts: 0, state: "pending" },
      }),
      makeRecord({
        id: "p2",
        occurredAt: "2026-02-01T00:00:00.000Z",
        webhookDelivery: { attempts: 0, state: "pending" },
      }),
      makeRecord({
        id: "p3",
        occurredAt: "2026-03-01T00:00:00.000Z",
        webhookDelivery: { attempts: 0, state: "pending" },
      }),
    ]
    expect(applyEvictionPolicy(errors, 2)).toEqual(errors)
  })

  test("ERROR_STORE_CAP is 1000", () => {
    expect(ERROR_STORE_CAP).toBe(1000)
  })
})

describe("file persistence", () => {
  test("addJobError writes a v1 file containing the record", async () => {
    await addJobError(makeRecord({ id: "x" }))
    const raw = await readFile(storePath, "utf8")
    const parsed = JSON.parse(raw) as {
      version: number
      errors: PersistedJobError[]
    }
    expect(parsed.version).toBe(1)
    expect(parsed.errors).toHaveLength(1)
    expect(parsed.errors[0]?.id).toBe("x")
  })

  test("load reads back what add wrote", async () => {
    await addJobError(makeRecord({ id: "x" }))
    __resetJobErrorStoreForTests(storePath)
    await loadJobErrorsFromDisk()
    const found = getJobError("x")
    expect(found?.id).toBe("x")
  })

  test("listJobErrors returns newest-first and filters by state", async () => {
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
        webhookDelivery: {
          attempts: 1,
          state: "delivered",
        },
      }),
    )
    await addJobError(
      makeRecord({
        id: "c",
        occurredAt: "2026-03-01T00:00:00.000Z",
      }),
    )

    const all = listJobErrors({})
    expect(all.map(({ id }) => id)).toEqual(["c", "b", "a"])

    const onlyPending = listJobErrors({ state: "pending" })
    expect(onlyPending.map(({ id }) => id)).toEqual([
      "c",
      "a",
    ])
  })

  test("listJobErrors filters by jobId", async () => {
    await addJobError(makeRecord({ id: "a", jobId: "j1" }))
    await addJobError(makeRecord({ id: "b", jobId: "j2" }))
    const result = listJobErrors({ jobId: "j2" })
    expect(result.map(({ id }) => id)).toEqual(["b"])
  })

  test("updateJobError persists mutator result", async () => {
    await addJobError(makeRecord({ id: "x" }))
    await updateJobError("x", (rec) => ({
      ...rec,
      webhookDelivery: {
        ...rec.webhookDelivery,
        state: "delivered",
      },
    }))
    expect(getJobError("x")?.webhookDelivery.state).toBe(
      "delivered",
    )
    __resetJobErrorStoreForTests(storePath)
    await loadJobErrorsFromDisk()
    expect(getJobError("x")?.webhookDelivery.state).toBe(
      "delivered",
    )
  })

  test("deleteJobError removes a record", async () => {
    await addJobError(makeRecord({ id: "x" }))
    await deleteJobError("x")
    expect(getJobError("x")).toBeUndefined()
  })

  test("concurrent addJobError calls are serialized", async () => {
    const ids = Array.from(
      { length: 10 },
      (_, index) => `rec_${index}`,
    )
    await Promise.all(
      ids.map((id) => addJobError(makeRecord({ id }))),
    )
    expect(listJobErrors({})).toHaveLength(10)

    __resetJobErrorStoreForTests(storePath)
    await loadJobErrorsFromDisk()
    expect(listJobErrors({})).toHaveLength(10)
  })

  test("load tolerates missing file", async () => {
    await loadJobErrorsFromDisk()
    expect(listJobErrors({})).toEqual([])
  })

  test("load tolerates malformed file", async () => {
    await writeFile(storePath, "{not json", "utf8")
    await loadJobErrorsFromDisk()
    expect(listJobErrors({})).toEqual([])
  })
})
