import { useAtomValue } from "jotai"

import { JobCard } from "../../components/JobCard/JobCard"
import { jobsAtom } from "../../state/jobsAtom"

export const JobsList = () => {
  const jobs = useAtomValue(jobsAtom)
  // Top-level jobs have no parentJobId; prepend newest (Map preserves insertion order).
  const topLevel = Array.from(jobs.values())
    .filter((job) => !job.parentJobId)
    .reverse()

  const pausedJobs = topLevel.filter(
    (job) => job.status === "paused",
  )
  const otherJobs = topLevel.filter(
    (job) => job.status !== "paused",
  )

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
    <div className="space-y-6">
      {pausedJobs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
            ⏸ Paused Jobs ({pausedJobs.length})
            <span className="font-normal text-amber-500/70 text-xs">
              — awaiting input
            </span>
          </h2>
          <div className="space-y-3">
            {pausedJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </section>
      )}
      {otherJobs.length > 0 && (
        <div className="space-y-3">
          {otherJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  )
}
