import { randomUUID } from "node:crypto"
import { Subject, type Subscription } from "rxjs"

import {
  __resetAllProgressEmittersForTests,
  disposeProgressEmitter,
} from "../tools/progressEmitter.js"
import type {
  Job,
  ProgressEvent,
  PromptEvent,
  StepEvent,
} from "./types.js"

// Union of every non-string payload the per-job SSE subject can carry.
// String log lines ride the same channel for free (Subject is widened
// to `string | JobEvent` below).
export type JobEvent =
  | PromptEvent
  | ProgressEvent
  | StepEvent

// ---------------------------------------------------------------------------
// Module-level state — only mutated through the exported functions below.
// ---------------------------------------------------------------------------

const jobs = new Map<string, Job>()
const subjects = new Map<
  string,
  Subject<string | JobEvent>
>()
const latestProgressByJob = new Map<string, ProgressEvent>()
// Live RxJS Subscriptions keyed by jobId. Populated by jobRunner /
// sequenceRunner when a job starts running, removed on natural completion
// or by cancelJob below. Not exposed — Subscription objects aren't
// serializable so we keep them out of the Job type.
const jobSubscriptions = new Map<string, Subscription>()
const jobSubject = new Subject<Omit<Job, "logs">>()

export const jobEvents$ = jobSubject.asObservable()

// ---------------------------------------------------------------------------
// Job CRUD
// ---------------------------------------------------------------------------

export const createJob = ({
  commandName,
  params,
  outputFolderName = null,
  parentJobId = null,
  stepId = null,
}: {
  commandName: string
  params?: unknown
  outputFolderName?: string | null
  parentJobId?: string | null
  stepId?: string | null
}): Job => {
  const job: Job = {
    commandName,
    completedAt: null,
    error: null,
    id: randomUUID(),
    logs: [],
    outputFolderName,
    outputs: null,
    params,
    parentJobId,
    results: [],
    startedAt: null,
    status: "pending",
    stepId,
  }

  jobs.set(job.id, job)

  const { logs: _logs, ...rest } = job
  jobSubject.next(rest)

  return job
}

export const getJob = (id: string): Job | undefined =>
  jobs.get(id)

export const getAllJobs = (): Job[] =>
  Array.from(jobs.values())

export const getChildJobs = (parentJobId: string): Job[] =>
  Array.from(jobs.values()).filter(
    (job) => job.parentJobId === parentJobId,
  )

// Returns a new Job object (spread-based update, no direct property mutation).
export const updateJob = (
  id: string,
  changes: Partial<
    Omit<Job, "command" | "id" | "logs" | "params">
  >,
): Job | undefined => {
  const existing = jobs.get(id)

  if (!existing) return undefined

  const updated: Job = {
    ...existing,
    ...changes,
  }

  jobs.set(id, updated)

  const { logs: _logs, ...rest } = updated
  jobSubject.next(rest)

  return updated
}

// Appends a log line in place (append-only; avoids O(n) array spread per line).
export const appendJobLog = (
  id: string,
  line: string,
): void => {
  const job = jobs.get(id)

  if (!job) return

  job.logs.push(line)
  subjects.get(id)?.next(line)
}

// ---------------------------------------------------------------------------
// Per-job SSE subject
// ---------------------------------------------------------------------------

export const createSubject = (
  id: string,
): Subject<string | JobEvent> => {
  const subject = new Subject<string | JobEvent>()

  subjects.set(id, subject)

  return subject
}

export const getSubject = (
  id: string,
): Subject<string | JobEvent> | undefined =>
  subjects.get(id)

export const emitJobEvent = (
  id: string,
  event: JobEvent,
): void => {
  subjects.get(id)?.next(event)
  if (event.type === "progress") {
    latestProgressByJob.set(id, event)
  }
}

export const getLatestJobProgress = (
  id: string,
): ProgressEvent | null =>
  latestProgressByJob.get(id) ?? null

export const completeSubject = (id: string): void => {
  subjects.get(id)?.complete()
  subjects.delete(id)
  disposeProgressEmitter(id)
}

// ---------------------------------------------------------------------------
// Subscription registry — for cancellation.
// ---------------------------------------------------------------------------

// Called by jobRunner / sequenceRunner once a subscription is live. Skip
// when the subscription has already closed synchronously (e.g., the
// observable completed during subscribe()) — registering a closed sub
// would leak into the map with no way to remove it.
export const registerJobSubscription = (
  id: string,
  subscription: Subscription,
): void => {
  if (subscription.closed) return
  jobSubscriptions.set(id, subscription)
}

// Called by the runner's complete / error handlers (and cancelJob) to
// release the slot once the job is truly terminal.
export const unregisterJobSubscription = (
  id: string,
): void => {
  jobSubscriptions.delete(id)
}

// Per-job teardown shared between `cancelJob`'s cascade (umbrella → child)
// and the sequence runner's parallel-group fail-fast (sibling → sibling).
// Idempotent and safe to call on any status: a `running` job flips to
// `cancelled` with subscription teardown, a `pending` job flips to
// `skipped`, anything else (already terminal) is a no-op.
//
// Same status-before-unsubscribe ordering as `cancelJob` for the same
// reason — the runner's promise teardown captures the post-flip snapshot.
export const cancelOrSkipJob = (id: string): void => {
  const job = jobs.get(id)
  if (!job) return

  if (job.status === "running") {
    updateJob(id, {
      completedAt: new Date(),
      status: "cancelled",
    })
    const subscription = jobSubscriptions.get(id)
    if (subscription) {
      subscription.unsubscribe()
      jobSubscriptions.delete(id)
    }
    completeSubject(id)
    return
  }

  if (job.status === "pending") {
    updateJob(id, {
      completedAt: new Date(),
      status: "skipped",
    })
    completeSubject(id)
  }
}

// Cancellation entry point used by `DELETE /jobs/:id`. Returns true when
// a running job was cancelled, false when the job is missing or already
// in a terminal state (caller maps these to 404 / 204 respectively).
//
// Cascade: when an umbrella sequence job is cancelled, any of its child
// jobs that are still `running` get the same teardown (subscription
// unsubscribe + status flip), and any still `pending` jump to `skipped`
// — distinct status so the UI can show "this step never ran because the
// parent was interrupted" vs "this step was actively running and got
// killed".
export const cancelJob = (id: string): boolean => {
  const job = jobs.get(id)
  if (!job) return false
  if (job.status !== "running") return false

  // Order matters: write the cancelled status BEFORE unsubscribing.
  // jobRunner's runJob() registers a teardown on the subscription that
  // resolves its returned promise to a snapshot of the job at unsubscribe
  // time. If the status flip happened after unsubscribe, that snapshot
  // would still read "running" and the sequenceRunner await would see a
  // stale status when it resumes.
  updateJob(id, {
    completedAt: new Date(),
    status: "cancelled",
  })

  const subscription = jobSubscriptions.get(id)
  if (subscription) {
    subscription.unsubscribe()
    jobSubscriptions.delete(id)
  }

  completeSubject(id)

  Array.from(jobs.values())
    .filter((child) => child.parentJobId === id)
    .forEach((child) => {
      cancelOrSkipJob(child.id)
    })

  return true
}

// ---------------------------------------------------------------------------
// Test helper — clears all state between tests.
// ---------------------------------------------------------------------------

export const resetStore = (): void => {
  jobs.clear()
  subjects.clear()
  jobSubscriptions.clear()
  latestProgressByJob.clear()
  __resetAllProgressEmittersForTests()
}
