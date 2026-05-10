import { EMPTY, of, Subject, throwError } from "rxjs"
import { afterEach, describe, expect, test } from "vitest"

import {
  cancelJob,
  createJob,
  getJob,
  resetStore,
} from "./jobStore.js"
import { runJob } from "./jobRunner.js"
import { logAndRethrow } from "../tools/logAndRethrow.js"

// runJob is async in effect (RxJS subscriptions resolve on the microtask queue).
const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

afterEach(() => {
  resetStore()
})

describe(runJob.name, () => {
  test("transitions job to running immediately", () => {
    const job = createJob({ commandName: "hasBetterAudio" })
    // Use a Subject that never completes so we can inspect the "running" state.
    const pending = new Subject<never>()

    runJob(job.id, pending.asObservable())

    expect(getJob(job.id)?.status).toBe("running")
    expect(getJob(job.id)?.startedAt).toBeInstanceOf(Date)

    pending.complete()
  })

  test("transitions job to completed when observable completes", async () => {
    const job = createJob({ commandName: "hasBetterAudio" })

    runJob(job.id, of("result"))

    await flushMicrotasks()

    expect(getJob(job.id)?.status).toBe("completed")
    expect(getJob(job.id)?.completedAt).toBeInstanceOf(Date)
    expect(getJob(job.id)?.results).toEqual(["result"])
  })

  test("captures emitted values into job.results", async () => {
    const job = createJob({ commandName: "hasBetterAudio" })

    runJob(job.id, of("first", "second"))

    await flushMicrotasks()

    expect(getJob(job.id)?.results).toEqual(["first", "second"])
  })

  test("transitions job to failed when observable errors", async () => {
    const job = createJob({ commandName: "hasBetterAudio" })

    runJob(job.id, throwError(() => new Error("boom")))

    await flushMicrotasks()

    expect(getJob(job.id)?.status).toBe("failed")
    expect(getJob(job.id)?.error).toBe("Error: boom")
    expect(getJob(job.id)?.completedAt).toBeInstanceOf(Date)
  })

  test("does not overwrite failed status when catchError completes the stream", async () => {
    const job = createJob({ commandName: "hasBetterAudio" })

    // throwError → catchError marks the job "failed" and returns EMPTY
    // → complete fires. Verify complete does not reset status to "completed".
    runJob(job.id, throwError(() => new Error("inner")))

    await flushMicrotasks()

    expect(getJob(job.id)?.status).toBe("failed")
  })

  test("preserves cancelled status when the upstream observable later completes", async () => {
    const job = createJob({ commandName: "hasBetterAudio" })
    const upstream = new Subject<string>()

    runJob(job.id, upstream.asObservable())

    // Cancel mid-flight before any emission — this is the cancelJob path
    // the DELETE route will exercise.
    cancelJob(job.id)
    expect(getJob(job.id)?.status).toBe("cancelled")

    // The Subject is now closed (cancelJob unsubscribed it), but simulate
    // the worst case where the upstream finishes naturally a tick later.
    // The runner's complete/error guards must keep the status sticky.
    upstream.complete()
    await flushMicrotasks()

    expect(getJob(job.id)?.status).toBe("cancelled")
  })

  test("a logAndRethrow-piped error reaches the runner and marks the job failed", async () => {
    // Defends against accidentally re-introducing EMPTY as the catchError
    // return at the operator level. If logAndRethrow ever turns back into
    // a swallow, this test fails because complete fires instead of error
    // and the job ends up "completed" with the boom message logged but
    // never surfaced.
    const job = createJob({ commandName: "hasBetterAudio" })

    runJob(
      job.id,
      throwError(() => new Error("operator-level boom"))
      .pipe(logAndRethrow("testCommand")),
    )

    await flushMicrotasks()

    expect(getJob(job.id)?.status).toBe("failed")
    expect(getJob(job.id)?.error).toContain("operator-level boom")
  })

  test("preserves cancelled status when the upstream observable later errors", async () => {
    const job = createJob({ commandName: "hasBetterAudio" })
    const upstream = new Subject<string>()

    runJob(job.id, upstream.asObservable())

    cancelJob(job.id)
    expect(getJob(job.id)?.status).toBe("cancelled")

    upstream.error(new Error("late explosion"))
    await flushMicrotasks()

    expect(getJob(job.id)?.status).toBe("cancelled")
    // Error message should NOT have been written — cancellation wins.
    expect(getJob(job.id)?.error).toBeNull()
  })

  test("populates job.outputs when extractOutputs is provided and the job completes", async () => {
    const job = createJob({ commandName: "modifySubtitleMetadata" })

    // runJob's `next` handler does job.results.concat(value), which flattens
    // arrays by one level. So an observable that emits one rules-array ends
    // up with results = [rule, rule, …], not [[rule, rule]]. The extractor
    // therefore lifts the whole results array as the named output.
    runJob(
      job.id,
      of(
        { type: "setScriptInfo", key: "Title", value: "Example" },
        { type: "setScriptInfo", key: "ScriptType", value: "v4.00+" },
      ),
      {
        extractOutputs: (results) => ({ rules: results }),
      },
    )

    await flushMicrotasks()

    const completedJob = getJob(job.id)
    expect(completedJob?.status).toBe("completed")
    expect(completedJob?.outputs).toEqual({
      rules: [
        { type: "setScriptInfo", key: "Title", value: "Example" },
        { type: "setScriptInfo", key: "ScriptType", value: "v4.00+" },
      ],
    })
  })

  test("leaves job.outputs null when no extractOutputs is provided", async () => {
    const job = createJob({ commandName: "copyFiles" })

    runJob(job.id, of("/dst/foo"))

    await flushMicrotasks()

    expect(getJob(job.id)?.status).toBe("completed")
    expect(getJob(job.id)?.outputs).toBeNull()
  })

  test("does not run extractOutputs when the job ends in failure", async () => {
    const job = createJob({ commandName: "modifySubtitleMetadata" })

    let extractCalled = false
    runJob(
      job.id,
      throwError(() => new Error("boom")),
      {
        extractOutputs: (results) => {
          extractCalled = true
          return { rules: results }
        },
      },
    )

    await flushMicrotasks()

    expect(getJob(job.id)?.status).toBe("failed")
    expect(getJob(job.id)?.outputs).toBeNull()
    expect(extractCalled).toBe(false)
  })

  test("returned promise resolves with the final job snapshot on natural completion", async () => {
    const job = createJob({ commandName: "hasBetterAudio" })

    const final = await runJob(job.id, of("done"))

    expect(final?.status).toBe("completed")
    expect(final?.results).toEqual(["done"])
  })

  test("returned promise resolves on error with status=failed", async () => {
    const job = createJob({ commandName: "hasBetterAudio" })

    const final = await runJob(job.id, throwError(() => new Error("kaboom")))

    expect(final?.status).toBe("failed")
    expect(final?.error).toContain("kaboom")
  })

  test("returned promise resolves on external cancel — sequenceRunner relies on this so its loop doesn't hang", async () => {
    // Without the subscription.add(() => resolve(...)) teardown in
    // jobRunner, an external unsubscribe (cancelJob) tears the chain
    // down without firing complete or error, leaving the await in
    // sequenceRunner pending forever and pinning a child job's promise
    // chain in memory. This test guards against regressing that.
    const job = createJob({ commandName: "hasBetterAudio" })
    const upstream = new Subject<string>()

    const promise = runJob(job.id, upstream.asObservable())
    cancelJob(job.id)

    const final = await promise
    expect(final?.status).toBe("cancelled")
  })
})
