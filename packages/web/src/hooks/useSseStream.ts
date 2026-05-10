import { useSetAtom } from "jotai"
import { jobsAtom } from "../state/jobsAtom"
import { jobsConnectionAtom } from "../state/jobsConnectionAtom"
import { progressByJobIdAtom } from "../state/progressByJobIdAtom"
import type { Job } from "../types"
import { useTolerantEventSource } from "./useTolerantEventSource"

// Connects to /jobs/stream and keeps jobsAtom in sync.
// Terminal jobs have their cached progress cleared to prevent unbounded growth.
export const useSseStream = (): void => {
  const setJobs = useSetAtom(jobsAtom)
  const setConnection = useSetAtom(jobsConnectionAtom)
  const setProgress = useSetAtom(progressByJobIdAtom)

  useTolerantEventSource<Job>({
    url: "/jobs/stream",
    onConnected: () => setConnection("connected"),
    onPossiblyDisconnected: () => setConnection("unstable"),
    onMessage: (job) => {
      setJobs((prev) => new Map(prev).set(job.id, job))

      if (job.status !== "running" && job.status !== "pending") {
        setProgress((prev) => {
          const next = new Map(prev)
          next.delete(job.id)
          return next
        })
      }
    },
  })
}
