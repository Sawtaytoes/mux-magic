import {
  createJob,
  resetStore,
  updateJob,
} from "@mux-magic/core/src/api/jobStore.js"
import type { ProviderCacheFallback } from "@mux-magic/core/src/provider-cache/providerCacheFallbacks.js"
import { afterEach, describe, expect, test } from "vitest"

import { logsRoutes } from "./logRoutes.js"

const FALLBACK: ProviderCacheFallback = {
  ageMilliseconds: 3 * 24 * 60 * 60 * 1000,
  cachedAt: "2026-09-26T12:00:00.000Z",
  cause: "fetch failed",
  isProviderSkipped: false,
  provider: "dvdCompare",
  request:
    "https://www.dvdcompare.net/comparisons/film.php?fid=74759",
}

const readSseEvents = (body: string) =>
  body
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map(
      (line) =>
        JSON.parse(
          line.slice("data:".length).trim(),
        ) as Record<string, unknown>,
    )

describe("GET /jobs/:id/logs", () => {
  afterEach(() => {
    resetStore()
  })

  test("replays each recorded cache fallback before the done frame, and the done frame carries them too", async () => {
    const job = createJob({
      commandName: "nameSpecialFeaturesDvdCompareTmdb",
    })
    updateJob(job.id, {
      completedAt: new Date("2026-09-29T12:00:00.000Z"),
      providerCacheFallbacks: [FALLBACK],
      status: "completed",
    })

    const response = await logsRoutes.request(
      `/jobs/${job.id}/logs`,
    )
    const events = readSseEvents(await response.text())

    expect(events).toEqual([
      {
        fallback: FALLBACK,
        index: 0,
        type: "provider-cache-fallback",
      },
      expect.objectContaining({
        isDone: true,
        providerCacheFallbacks: [FALLBACK],
        status: "completed",
      }),
    ])
  })

  test("sends no fallback event for a job that used no cached answer", async () => {
    const job = createJob({ commandName: "copyFiles" })
    updateJob(job.id, { status: "completed" })

    const response = await logsRoutes.request(
      `/jobs/${job.id}/logs`,
    )
    const events = readSseEvents(await response.text())

    expect(
      events.filter(
        ({ type }) => type === "provider-cache-fallback",
      ),
    ).toEqual([])
    expect(events.at(-1)).toMatchObject({
      isDone: true,
      providerCacheFallbacks: [],
    })
  })
})
