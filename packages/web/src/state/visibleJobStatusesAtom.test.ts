import { createStore } from "jotai"
import { beforeEach, describe, expect, test } from "vitest"

import { JOB_STATUSES } from "../jobs/jobStatuses"
import {
  DEFAULT_VISIBLE_JOB_STATUSES,
  readStoredVisibleJobStatuses,
  VISIBLE_JOB_STATUSES_STORAGE_KEY,
  visibleJobStatusesAtom,
  writeStoredVisibleJobStatuses,
} from "./visibleJobStatusesAtom"

const makeStorage = (initial?: string) => {
  const values = new Map<string, string>(
    initial === undefined
      ? []
      : [[VISIBLE_JOB_STATUSES_STORAGE_KEY, initial]],
  )

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    values,
  }
}

describe("DEFAULT_VISIBLE_JOB_STATUSES", () => {
  test("is every status except exited", () => {
    expect(DEFAULT_VISIBLE_JOB_STATUSES).toEqual(
      JOB_STATUSES.filter((status) => status !== "exited"),
    )
  })
})

describe("readStoredVisibleJobStatuses", () => {
  test("falls back to the default when nothing is stored", () => {
    expect(
      readStoredVisibleJobStatuses(makeStorage()),
    ).toEqual(DEFAULT_VISIBLE_JOB_STATUSES)
  })

  test("reads a stored list", () => {
    expect(
      readStoredVisibleJobStatuses(
        makeStorage('["running","failed"]'),
      ),
    ).toEqual(["running", "failed"])
  })

  test("honours a stored empty list rather than resetting it", () => {
    expect(
      readStoredVisibleJobStatuses(makeStorage("[]")),
    ).toEqual([])
  })

  test("drops values that are no longer statuses", () => {
    expect(
      readStoredVisibleJobStatuses(
        makeStorage('["running","finished",7]'),
      ),
    ).toEqual(["running"])
  })

  test("falls back to the default on unparseable JSON", () => {
    expect(
      readStoredVisibleJobStatuses(makeStorage("not json")),
    ).toEqual(DEFAULT_VISIBLE_JOB_STATUSES)
  })

  test("falls back to the default when the stored value is not an array", () => {
    expect(
      readStoredVisibleJobStatuses(
        makeStorage('{"running":true}'),
      ),
    ).toEqual(DEFAULT_VISIBLE_JOB_STATUSES)
  })

  test("survives storage being unavailable", () => {
    expect(readStoredVisibleJobStatuses(undefined)).toEqual(
      DEFAULT_VISIBLE_JOB_STATUSES,
    )
  })
})

describe("writeStoredVisibleJobStatuses", () => {
  test("writes the list as JSON", () => {
    const storage = makeStorage()

    writeStoredVisibleJobStatuses({
      statuses: ["running", "failed"],
      storage,
    })

    expect(
      storage.values.get(VISIBLE_JOB_STATUSES_STORAGE_KEY),
    ).toBe('["running","failed"]')
  })

  test("a throwing storage costs the memory, not the call", () => {
    expect(() => {
      writeStoredVisibleJobStatuses({
        statuses: ["running"],
        storage: {
          setItem: () => {
            throw new Error("QuotaExceededError")
          },
        },
      })
    }).not.toThrow()
  })
})

describe("visibleJobStatusesAtom", () => {
  beforeEach(() => {
    globalThis.localStorage?.removeItem(
      VISIBLE_JOB_STATUSES_STORAGE_KEY,
    )
  })

  test("re-sorts a write into canonical order", () => {
    const store = createStore()

    store.set(visibleJobStatusesAtom, [
      "exited",
      "running",
      "failed",
    ])

    // Canonical order, not click order — the SSE URL is built from
    // this list, and a differently-ordered same set would rebuild
    // the URL and pointlessly reconnect the stream.
    expect(store.get(visibleJobStatusesAtom)).toEqual([
      "running",
      "failed",
      "exited",
    ])
  })

  test("drops anything that is not a status", () => {
    const store = createStore()

    store.set(visibleJobStatusesAtom, [
      "running",
      "finished" as never,
    ])

    expect(store.get(visibleJobStatusesAtom)).toEqual([
      "running",
    ])
  })
})
