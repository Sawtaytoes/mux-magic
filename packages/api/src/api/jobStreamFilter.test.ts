import type {
  Job,
  JobStatus,
} from "@mux-magic/core/src/api/types.js"
import { describe, expect, test } from "vitest"

import {
  getIsJobInFilter,
  parseStatusFilter,
} from "./jobStreamFilter.js"

const makeJob = ({
  id,
  parentJobId = null,
  status,
}: {
  id: string
  parentJobId?: string | null
  status: JobStatus
}): Job => ({
  commandName: "renameFiles",
  completedAt: null,
  error: null,
  id,
  logs: [],
  outputFolderName: null,
  outputs: null,
  params: {},
  parentJobId,
  pauseReason: null,
  results: [],
  startedAt: null,
  status,
  stepId: null,
  threadCountClaim: null,
})

const statusSet = (...statuses: JobStatus[]) =>
  new Set<JobStatus>(statuses)

const noJobs = () => undefined

describe("parseStatusFilter", () => {
  test("returns null when the param is absent", () => {
    expect(parseStatusFilter(undefined)).toBeNull()
  })

  test("returns null when the param list is empty", () => {
    expect(parseStatusFilter([])).toBeNull()
  })

  test("splits a comma-separated value", () => {
    expect(parseStatusFilter(["running,failed"])).toEqual(
      new Set(["running", "failed"]),
    )
  })

  test("accepts the param repeated", () => {
    expect(
      parseStatusFilter(["running", "failed"]),
    ).toEqual(new Set(["running", "failed"]))
  })

  test("trims surrounding whitespace", () => {
    expect(
      parseStatusFilter([" running , failed "]),
    ).toEqual(new Set(["running", "failed"]))
  })

  test("drops unrecognised statuses instead of erroring", () => {
    expect(parseStatusFilter(["running,finished"])).toEqual(
      new Set(["running"]),
    )
  })

  test("a present param naming nothing valid asks for nothing", () => {
    expect(parseStatusFilter(["finished"])).toEqual(
      new Set(),
    )
  })
})

describe("getIsJobInFilter", () => {
  test("a null filter passes everything", () => {
    expect(
      getIsJobInFilter({
        getJobById: noJobs,
        job: makeJob({ id: "a", status: "exited" }),
        statuses: null,
      }),
    ).toBe(true)
  })

  test("a top-level job is judged by its own status", () => {
    expect(
      getIsJobInFilter({
        getJobById: noJobs,
        job: makeJob({ id: "a", status: "exited" }),
        statuses: statusSet("running"),
      }),
    ).toBe(false)

    expect(
      getIsJobInFilter({
        getJobById: noJobs,
        job: makeJob({ id: "a", status: "running" }),
        statuses: statusSet("running"),
      }),
    ).toBe(true)
  })

  test("an exited step of a visible sequence is kept", () => {
    const parent = makeJob({
      id: "umbrella",
      status: "running",
    })

    expect(
      getIsJobInFilter({
        getJobById: () => parent,
        job: makeJob({
          id: "step2",
          parentJobId: "umbrella",
          status: "exited",
        }),
        statuses: statusSet("running"),
      }),
    ).toBe(true)
  })

  test("a step of a hidden sequence is dropped even when its own status is visible", () => {
    const parent = makeJob({
      id: "umbrella",
      status: "exited",
    })

    expect(
      getIsJobInFilter({
        getJobById: () => parent,
        job: makeJob({
          id: "step1",
          parentJobId: "umbrella",
          status: "completed",
        }),
        statuses: statusSet("completed"),
      }),
    ).toBe(false)
  })

  test("an orphan child falls back to its own status", () => {
    expect(
      getIsJobInFilter({
        getJobById: noJobs,
        job: makeJob({
          id: "step1",
          parentJobId: "gone",
          status: "completed",
        }),
        statuses: statusSet("completed"),
      }),
    ).toBe(true)
  })
})
