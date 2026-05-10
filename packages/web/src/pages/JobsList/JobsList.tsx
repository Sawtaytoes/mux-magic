import { useAtomValue } from "jotai"

import { JobCard } from "../../components/JobCard/JobCard"
import { jobsAtom } from "../../state/jobsAtom"

export const JobsList = () => {
  const jobs = useAtomValue(jobsAtom)
  // Top-level jobs have no parentJobId; prepend newest (Map preserves insertion order).
  const topLevel = Array.from(jobs.values())
    .filter((job) => !job.parentJobId)
    .reverse()

  if (topLevel.length === 0) {
    return (
      <p className="text-slate-500 text-sm text-center py-12">
        No jobs yet. Run a command in the{" "}
        <a
          href="/builder"
          className="text-blue-400 hover:text-blue-300"
        >
          Sequence Builder
        </a>{" "}
        to get started.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {topLevel.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  )
}
