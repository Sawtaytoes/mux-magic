import { describe, expect, test } from "vitest"

import {
  DEFAULT_HIDDEN_JOB_STATUSES,
  isJobStatus,
  JOB_STATUSES,
} from "./jobStatuses"
import type { JobStatus } from "./types"

// The guard that makes the web's copy of the status list safe: this
// stops compiling the moment the server's `JobStatus` union gains a
// member, which a `readonly JobStatus[]` never would.
const everyJobStatus: Record<JobStatus, true> = {
  cancelled: true,
  completed: true,
  exited: true,
  failed: true,
  paused: true,
  pending: true,
  running: true,
  skipped: true,
}

describe("JOB_STATUSES", () => {
  test("covers every member of the server's JobStatus union", () => {
    expect(JOB_STATUSES.concat().sort()).toEqual(
      Object.keys(everyJobStatus).sort(),
    )
  })

  test("has no duplicates", () => {
    expect(new Set(JOB_STATUSES).size).toBe(
      JOB_STATUSES.length,
    )
  })
})

describe("DEFAULT_HIDDEN_JOB_STATUSES", () => {
  test("hides exited and nothing else", () => {
    expect(DEFAULT_HIDDEN_JOB_STATUSES).toEqual(["exited"])
  })

  test("only names statuses the filter can offer", () => {
    expect(
      DEFAULT_HIDDEN_JOB_STATUSES.every((status) =>
        JOB_STATUSES.includes(status),
      ),
    ).toBe(true)
  })
})

describe("isJobStatus", () => {
  test("accepts a real status", () => {
    expect(isJobStatus("exited")).toBe(true)
  })

  test("rejects anything else", () => {
    expect(isJobStatus("finished")).toBe(false)
    expect(isJobStatus("")).toBe(false)
  })
})
