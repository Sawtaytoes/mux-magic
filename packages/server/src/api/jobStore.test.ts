import { firstValueFrom, Subject } from "rxjs"
import { afterEach, describe, expect, test, vi } from "vitest"

import {
  appendJobLog,
  cancelJob,
  completeSubject,
  createJob,
  createSubject,
  getAllJobs,
  getJob,
  getSubject,
  registerJobSubscription,
  resetStore,
  unregisterJobSubscription,
  updateJob,
} from "./jobStore.js"

afterEach(() => {
  resetStore()
})

describe(createJob.name, () => {
  test("returns a job with pending status and empty logs", () => {
    const job = (
      createJob({
        commandName: "hasBetterAudio",
        params: {
          sourcePath: "/media",
        }
      })
    )

    expect(job.status).toBe("pending")
    expect(job.commandName).toBe("hasBetterAudio")
    expect(job.logs).toEqual([])
    expect(job.startedAt).toBeNull()
    expect(job.completedAt).toBeNull()
    expect(job.error).toBeNull()
  })

  test("assigns a unique id", () => {
    const jobA = createJob({ commandName: "hasBetterAudio" })
    const jobB = createJob({ commandName: "hasBetterAudio" })

    expect(jobA.id).not.toBe(jobB.id)
  })

  test("stores job so getJob can retrieve it", () => {
    const job = createJob({ commandName: "hasBetterAudio" })

    expect(getJob(job.id)).toEqual(job)
  })
})

describe(getJob.name, () => {
  test("returns undefined for unknown id", () => {
    expect(getJob("does-not-exist")).toBeUndefined()
  })
})

describe(getAllJobs.name, () => {
  test("returns empty array when no jobs exist", () => {
    expect(getAllJobs()).toEqual([])
  })

  test("returns all created jobs", () => {
    const jobA = createJob({ commandName: "hasBetterAudio" })
    const jobB = createJob({ commandName: "reorderTracks" })

    expect(getAllJobs()).toHaveLength(2)
    expect(getAllJobs().map((jobs) => jobs.id)).toContain(jobA.id)
    expect(getAllJobs().map((jobs) => jobs.id)).toContain(jobB.id)
  })
})

describe(updateJob.name, () => {
  test("returns a new object with the applied changes", () => {
    const original = createJob({ commandName: "hasBetterAudio" })
    const updated = updateJob(original.id, { status: "running" })

    expect(updated).not.toBe(original)
    expect(updated?.status).toBe("running")
    expect(updated?.commandName).toBe(original.commandName)
  })

  test("does not mutate the previous object", () => {
    const job = createJob({ commandName: "hasBetterAudio" })
    const snapshot = { ...job }

    updateJob(job.id, { status: "running" })

    expect(job.status).toBe(snapshot.status)
  })

  test("returns undefined for unknown id", () => {
    expect(updateJob("does-not-exist", { status: "running" })).toBeUndefined()
  })
})

describe(appendJobLog.name, () => {
  test("appends line to job logs", () => {
    const job = createJob({ commandName: "hasBetterAudio" })

    appendJobLog(job.id, "line one")
    appendJobLog(job.id, "line two")

    expect(getJob(job.id)?.logs).toEqual(["line one", "line two"])
  })

  test("emits to subject if one exists", async () => {
    const job = createJob({ commandName: "hasBetterAudio" })
    const subject = createSubject(job.id)
    const received: string[] = []

    subject.subscribe((event) => { if (typeof event === "string") received.push(event) })

    appendJobLog(job.id, "hello")

    expect(received).toEqual(["hello"])
  })

  test("is a no-op for unknown id", () => {
    expect(() => appendJobLog("does-not-exist", "line")).not.toThrow()
  })
})

describe(createSubject.name, () => {
  test("returns a Subject that getSubject finds", () => {
    const job = createJob({ commandName: "hasBetterAudio" })
    const subject = createSubject(job.id)

    expect(getSubject(job.id)).toBe(subject)
  })
})

describe(completeSubject.name, () => {
  test("completes the subject and removes it from the store", async () => {
    const job = createJob({ commandName: "hasBetterAudio" })
    const subject = createSubject(job.id)

    let completed = false
    subject.subscribe({ complete: () => { completed = true } })

    completeSubject(job.id)

    expect(completed).toBe(true)
    expect(getSubject(job.id)).toBeUndefined()
  })
})

describe(cancelJob.name, () => {
  test("returns false for unknown id", () => {
    expect(cancelJob("does-not-exist")).toBe(false)
  })

  test("returns false for a job that is not running", () => {
    const job = createJob({ commandName: "hasBetterAudio" })
    // status is "pending"; cancel is a no-op until the runner flips it to running.
    expect(cancelJob(job.id)).toBe(false)
    expect(getJob(job.id)?.status).toBe("pending")
  })

  test("returns false for a job already in a terminal state", () => {
    const job = createJob({ commandName: "hasBetterAudio" })
    updateJob(job.id, { status: "completed" })

    expect(cancelJob(job.id)).toBe(false)
    expect(getJob(job.id)?.status).toBe("completed")
  })

  test("transitions a running job to cancelled, sets completedAt, and completes the subject", () => {
    const job = createJob({ commandName: "hasBetterAudio" })
    updateJob(job.id, { status: "running", startedAt: new Date() })
    const subject = createSubject(job.id)
    let subjectCompleted = false
    subject.subscribe({ complete: () => { subjectCompleted = true } })

    expect(cancelJob(job.id)).toBe(true)

    expect(getJob(job.id)?.status).toBe("cancelled")
    expect(getJob(job.id)?.completedAt).toBeInstanceOf(Date)
    expect(subjectCompleted).toBe(true)
    expect(getSubject(job.id)).toBeUndefined()
  })

  test("unsubscribes the registered subscription so the upstream observable tears down", () => {
    const job = createJob({ commandName: "hasBetterAudio" })
    updateJob(job.id, { status: "running", startedAt: new Date() })

    // Stand-in for any long-running pipeline. The subject never emits
    // complete, so without unsubscribe its observers stay attached.
    const upstream = new Subject<string>()
    const sub = upstream.subscribe()
    registerJobSubscription(job.id, sub)

    expect(sub.closed).toBe(false)

    cancelJob(job.id)

    expect(sub.closed).toBe(true)
  })
})

describe(`${cancelJob.name} — parent / child cascade`, () => {
  test("cancelling a parent unsubscribes a running child and flips it to cancelled", () => {
    const parent = createJob({ commandName: "sequence" })
    updateJob(parent.id, { status: "running", startedAt: new Date() })

    const child = createJob({ commandName: "makeDirectory", parentJobId: parent.id })
    updateJob(child.id, { status: "running", startedAt: new Date() })
    const childSub = new Subject<string>().subscribe()
    registerJobSubscription(child.id, childSub)

    expect(cancelJob(parent.id)).toBe(true)

    expect(getJob(parent.id)?.status).toBe("cancelled")
    expect(getJob(child.id)?.status).toBe("cancelled")
    expect(childSub.closed).toBe(true)
  })

  test("cancelling a parent flips still-pending children to skipped", () => {
    const parent = createJob({ commandName: "sequence" })
    updateJob(parent.id, { status: "running", startedAt: new Date() })

    const c1 = createJob({ commandName: "makeDirectory", parentJobId: parent.id })
    const c2 = createJob({ commandName: "makeDirectory", parentJobId: parent.id })
    // Leave both as pending — they were pre-created by sequenceRunner but
    // never reached because the cancel landed before the loop got there.

    cancelJob(parent.id)

    expect(getJob(c1.id)?.status).toBe("skipped")
    expect(getJob(c2.id)?.status).toBe("skipped")
    expect(getJob(c1.id)?.completedAt).toBeInstanceOf(Date)
  })

  test("cancelling a parent leaves already-terminal children alone", () => {
    const parent = createJob({ commandName: "sequence" })
    updateJob(parent.id, { status: "running", startedAt: new Date() })

    const completedChild = createJob({ commandName: "makeDirectory", parentJobId: parent.id })
    updateJob(completedChild.id, { status: "completed", completedAt: new Date() })
    const failedChild = createJob({ commandName: "makeDirectory", parentJobId: parent.id })
    updateJob(failedChild.id, { status: "failed", completedAt: new Date(), error: "boom" })

    cancelJob(parent.id)

    expect(getJob(completedChild.id)?.status).toBe("completed")
    expect(getJob(failedChild.id)?.status).toBe("failed")
  })
})

describe(registerJobSubscription.name, () => {
  test("does not register a subscription that is already closed", () => {
    // If the observable completes synchronously inside subscribe(), the
    // returned Subscription is born closed — registering it would leak
    // into the map with no chance of cleanup since complete already fired.
    const job = createJob({ commandName: "hasBetterAudio" })
    updateJob(job.id, { status: "running" })

    const closedSub = new Subject<string>().subscribe()
    closedSub.unsubscribe()
    expect(closedSub.closed).toBe(true)

    registerJobSubscription(job.id, closedSub)

    // cancelJob would normally find a sub to unsubscribe; with nothing
    // registered the call still flips the status (we still want the
    // user-facing semantics) but the unsubscribe path is a no-op.
    expect(cancelJob(job.id)).toBe(true)
    expect(getJob(job.id)?.status).toBe("cancelled")
  })
})

describe(unregisterJobSubscription.name, () => {
  test("releases the slot so a later cancelJob does not see a stale sub", () => {
    const job = createJob({ commandName: "hasBetterAudio" })
    updateJob(job.id, { status: "running" })
    const sub = new Subject<string>().subscribe()
    registerJobSubscription(job.id, sub)

    unregisterJobSubscription(job.id)
    const spy = vi.spyOn(sub, "unsubscribe")

    cancelJob(job.id)

    // No sub in the map → cancelJob doesn't try to unsubscribe it.
    expect(spy).not.toHaveBeenCalled()
  })
})
