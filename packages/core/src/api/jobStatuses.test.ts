import { describe, expect, test } from "vitest"

import { isJobStatus, JOB_STATUSES } from "./jobStatuses.js"
import type { JobStatus } from "./types.js"

// A `Record<JobStatus, true>` fails to compile the moment a member
// is added to the union and not listed here, which is the check a
// `readonly JobStatus[]` cannot make. The test then asserts
// JOB_STATUSES covers the same set, so the ordered list can't drift
// from the union either.
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
  test("covers every member of the JobStatus union", () => {
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

describe("isJobStatus", () => {
  test("accepts a real status", () => {
    expect(isJobStatus("exited")).toBe(true)
  })

  test("rejects anything else", () => {
    expect(isJobStatus("finished")).toBe(false)
    expect(isJobStatus("")).toBe(false)
  })
})
