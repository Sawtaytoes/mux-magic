import { describe, expect, test } from "vitest"

import { JOB_STATUSES } from "../jobs/jobStatuses"
import { buildJobsStreamUrl } from "./useSseStream"

describe("buildJobsStreamUrl", () => {
  test("omits the param when every status is showing", () => {
    // Not `?status=running,pending,…` — the short URL keeps the
    // "no filter" case on the same server code path an old client
    // or a curl takes.
    expect(buildJobsStreamUrl(JOB_STATUSES)).toBe(
      "/api/jobs/stream",
    )
  })

  test("lists the statuses when some are hidden", () => {
    expect(buildJobsStreamUrl(["running", "failed"])).toBe(
      "/api/jobs/stream?status=running,failed",
    )
  })

  test("sends an empty param when nothing is showing", () => {
    // Distinct from omitting it: an empty `status` asks for
    // nothing, where no param at all asks for everything.
    expect(buildJobsStreamUrl([])).toBe(
      "/api/jobs/stream?status=",
    )
  })
})
