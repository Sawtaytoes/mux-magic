import {
  isJobStatus,
  JOB_STATUSES,
} from "@mux-magic/core/src/api/jobStatuses.js"
import type {
  Job,
  JobStatus,
} from "@mux-magic/core/src/api/types.js"

/**
 * Which statuses a `/jobs/stream` connection asked to be replayed.
 *
 * Absent means every status, so an old client — or `curl` — keeps
 * the behaviour the endpoint has always had. A present-but-empty
 * list means the caller asked for nothing and gets nothing; that is
 * a real answer rather than a reason to fall back to everything.
 * Unrecognised names are dropped instead of erroring, so adding a
 * status server-side never 400s a client that has not shipped yet.
 */
export const parseStatusFilter = (
  rawValues: readonly string[] | undefined,
): ReadonlySet<JobStatus> | null => {
  if (rawValues === undefined || rawValues.length === 0) {
    return null
  }

  return new Set(
    rawValues
      .flatMap((rawValue) => rawValue.split(","))
      .map((rawValue) => rawValue.trim())
      .filter(isJobStatus),
  )
}

/**
 * Whether a job belongs in a filtered replay.
 *
 * A **child** job is judged by its PARENT's status, not its own.
 * Sequence steps are never rendered on their own — they live inside
 * the umbrella's steps disclosure — so filtering them individually
 * would punch holes in a visible sequence's step list, which reads
 * as data loss rather than as a filter. An orphan child (parent
 * pruned out from under it) falls back to its own status so it
 * cannot become permanently unreachable.
 */
export const getIsJobInFilter = ({
  getJobById,
  job,
  statuses,
}: {
  getJobById: (id: string) => Job | undefined
  job: Pick<Job, "parentJobId" | "status">
  statuses: ReadonlySet<JobStatus> | null
}): boolean => {
  if (statuses === null) {
    return true
  }

  if (job.parentJobId === null) {
    return statuses.has(job.status)
  }

  const parent = getJobById(job.parentJobId)

  return statuses.has(
    parent === undefined ? job.status : parent.status,
  )
}

export const JOB_STATUS_FILTER_DESCRIPTION =
  `Statuses to replay on connect, comma-separated or repeated (e.g. \`?status=running,failed\`). ` +
  `Omit it for every status. Sequence-step child jobs are judged by their parent's status, so a visible sequence keeps its whole step list. ` +
  `This filters the CONNECT REPLAY only — live updates are always streamed, or a job whose status changes into a hidden one would be stuck on screen at its last visible status forever. ` +
  `Known values: ${JOB_STATUSES.join(", ")}.`
