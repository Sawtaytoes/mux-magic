import { useAtomValue, useSetAtom } from "jotai"
import { apiBase } from "../apiBase"
import { JOB_STATUSES } from "../jobs/jobStatuses"
import type { Job } from "../jobs/types"
import { jobsAtom } from "../state/jobsAtom"
import { jobsConnectionAtom } from "../state/jobsConnectionAtom"
import { progressByJobIdAtom } from "../state/progressByJobIdAtom"
import { visibleJobStatusesAtom } from "../state/visibleJobStatusesAtom"
import { useTolerantEventSource } from "./useTolerantEventSource"

/**
 * The stream URL for a given filter.
 *
 * Hidden statuses are left OFF the connect replay, which is the
 * whole point: a workspace accumulates thousands of `exited` jobs
 * and every page load was parsing all of them to render the dozen
 * that mattered.
 *
 * Passing every status omits the param instead of listing all
 * eight — a shorter URL, and it keeps the "no filter" case on the
 * exact code path an old client or a `curl` takes.
 */
export const buildJobsStreamUrl = (
  statuses: readonly string[],
): string => {
  if (statuses.length === 0) {
    return `${apiBase}/jobs/stream?status=`
  }

  if (statuses.length === JOB_STATUSES.length) {
    return `${apiBase}/jobs/stream`
  }

  return `${apiBase}/jobs/stream?status=${statuses.map(encodeURIComponent).join(",")}`
}

// Connects to /jobs/stream and keeps jobsAtom in sync.
// Terminal jobs have their cached progress cleared to prevent unbounded growth.
export const useSseStream = () => {
  const setJobs = useSetAtom(jobsAtom)
  const setConnection = useSetAtom(jobsConnectionAtom)
  const setProgress = useSetAtom(progressByJobIdAtom)
  const visibleStatuses = useAtomValue(
    visibleJobStatusesAtom,
  )

  // Changing the filter changes the URL, which is what makes
  // useTolerantEventSource tear the stream down and reconnect —
  // and reconnecting is how newly-unhidden jobs get replayed. The
  // atom keeps the list in canonical order so re-ticking the same
  // set produces the same string and reconnects nothing.
  useTolerantEventSource<Job>({
    url: buildJobsStreamUrl(visibleStatuses),
    onConnected: () => setConnection("connected"),
    onPossiblyDisconnected: () => setConnection("unstable"),
    onMessage: (job) => {
      setJobs((prev) => new Map(prev).set(job.id, job))

      if (
        job.status !== "running" &&
        job.status !== "pending"
      ) {
        setProgress((prev) => {
          const next = new Map(prev)
          next.delete(job.id)
          return next
        })
      }
    },
  })
}
