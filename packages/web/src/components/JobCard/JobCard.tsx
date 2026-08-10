import { Accordion } from "@charcuterie/ui"
import { useAtomValue } from "jotai"

import { buildBuilderUrl } from "../../jobs/buildBuilderUrl"
import { commandLabel } from "../../jobs/commandLabels"
import { formatEta } from "../../jobs/formatBandwidth"
import type { Job } from "../../jobs/types"
import { jobsAtom } from "../../state/jobsAtom"
import { progressByJobIdAtom } from "../../state/progressByJobIdAtom"
import { CancelJobButton } from "../CancelJobButton/CancelJobButton"
import { CopyTextButton } from "../CopyTextButton/CopyTextButton"
import { JobLogsDisclosure } from "../JobLogsDisclosure/JobLogsDisclosure"
import { JobStepsDisclosure } from "../JobStepsDisclosure/JobStepsDisclosure"
import { ProgressBar } from "../ProgressBar/ProgressBar"
import { ResumeJobButton } from "../ResumeJobButton/ResumeJobButton"
import { StatusBadge } from "../StatusBadge/StatusBadge"

// ─── ETA for sequence jobs ────────────────────────────────────────────────────

const useAggregateEta = (job: Job) => {
  const progressByJobId = useAtomValue(progressByJobIdAtom)
  const jobs = useAtomValue(jobsAtom)
  if (job.status !== "running") return ""

  const children = Array.from(jobs.values()).filter(
    (child) => child.parentJobId === job.id,
  )
  const runningChildren = children.filter(
    (child) => child.status === "running",
  )

  const { totalRemaining, totalSpeed, hasAnyData } =
    runningChildren.reduce(
      (acc, child) => {
        const snap = progressByJobId.get(child.id)
        if (
          !snap ||
          typeof snap.bytesRemaining !== "number" ||
          snap.bytesRemaining <= 0 ||
          typeof snap.bytesPerSecond !== "number" ||
          snap.bytesPerSecond <= 0
        ) {
          return acc
        }
        return {
          totalRemaining:
            acc.totalRemaining + snap.bytesRemaining,
          totalSpeed: acc.totalSpeed + snap.bytesPerSecond,
          hasAnyData: true,
        }
      },
      {
        totalRemaining: 0,
        totalSpeed: 0,
        hasAnyData: false,
      },
    )

  if (hasAnyData) {
    return formatEta(
      totalRemaining,
      totalSpeed / Math.max(runningChildren.length, 1),
    )
  }

  const ownSnap = progressByJobId.get(job.id)
  return ownSnap
    ? formatEta(
        ownSnap.bytesRemaining,
        ownSnap.bytesPerSecond,
      )
    : ""
}

// ─── JobCard ─────────────────────────────────────────────────────────────────

interface JobCardProps {
  job: Job
}

export const JobCard = ({ job }: JobCardProps) => {
  const progressByJobId = useAtomValue(progressByJobIdAtom)
  const jobs = useAtomValue(jobsAtom)
  const snap = progressByJobId.get(job.id)
  const eta = useAggregateEta(job)

  const children = Array.from(jobs.values()).filter(
    (child) => child.parentJobId === job.id,
  )

  // `job.params: unknown` (server-canonical type) — narrow before reading.
  const paramsObject =
    job.params != null && typeof job.params === "object"
      ? (job.params as Record<string, unknown>)
      : null
  const sourcePath =
    paramsObject &&
    typeof paramsObject.sourcePath === "string"
      ? paramsObject.sourcePath
      : null
  const hasParams =
    paramsObject !== null &&
    Object.keys(paramsObject).length > 0

  return (
    <article className="bg-surface-raised border border-border-default rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold truncate">
          {commandLabel(job.commandName)}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {eta && (
            <span className="text-xs text-content-secondary bg-surface-sunken px-2 py-0.5 rounded">
              {eta}
            </span>
          )}
          <StatusBadge status={job.status} />
        </div>
      </div>

      {/* Meta */}
      <div className="text-xs text-content-muted space-y-0.5">
        <div>ID: {job.id}</div>
        {job.startedAt && (
          <div>
            Started:{" "}
            {new Date(job.startedAt).toLocaleString()}
          </div>
        )}
        {job.completedAt && (
          <div>
            Completed:{" "}
            {new Date(job.completedAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* Progress bar for running jobs */}
      {job.status === "running" && snap && (
        <ProgressBar snapshot={snap} />
      )}

      {/* Source path shortcut */}
      {sourcePath && (
        <div
          className="text-xs text-content-secondary truncate"
          title={sourcePath}
        >
          {sourcePath}
        </div>
      )}

      {/* Params disclosure */}
      {hasParams && (
        <Accordion
          items={[
            {
              content: (
                <div className="flex flex-col gap-1">
                  {/*
                    The copy button used to sit in the `<summary>`.
                    `Accordion`'s trigger is a `<button>`, and a `<button>`
                    inside a `<button>` is invalid markup — browsers repair
                    it by hoisting the inner one out of the trigger, which
                    is worse than moving it here on purpose.
                  */}
                  <div className="flex justify-end">
                    <CopyTextButton
                      getText={() =>
                        JSON.stringify(job.params, null, 2)
                      }
                    />
                  </div>

                  <pre className="overflow-x-auto rounded bg-surface-sunken p-2 text-content-secondary text-xs">
                    {JSON.stringify(job.params, null, 2)}
                  </pre>
                </div>
              ),
              key: "params",
              label: "Params",
            },
          ]}
        />
      )}

      {/* Error */}
      {job.error && (
        <p className="text-sm text-intent-danger-content break-words">
          {job.error}
        </p>
      )}

      {/* Results disclosure */}
      {job.results && job.results.length > 0 && (
        <Accordion
          items={[
            {
              content: (
                <div className="space-y-1">
                  {job.results.map((result) => (
                    <pre
                      className="overflow-x-auto rounded bg-surface-sunken p-2 text-content-secondary text-xs"
                      key={JSON.stringify(result).slice(
                        0,
                        64,
                      )}
                    >
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  ))}
                </div>
              ),
              key: "results",
              label: `Results (${job.results.length})`,
            },
          ]}
        />
      )}

      {/* Logs */}
      <JobLogsDisclosure
        jobId={job.id}
        jobStatus={job.status}
      />

      {/* Steps (children) */}
      {children.length > 0 && (
        <JobStepsDisclosure
          jobId={job.id}
          jobs={children}
          jobStatus={job.status}
        />
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 pt-1">
        <a
          href={buildBuilderUrl(job)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-intent-accent-content hover:underline"
        >
          ✎ Open in Sequence Builder
        </a>
        {job.status === "running" && (
          <CancelJobButton jobId={job.id} />
        )}
        {job.status === "paused" && (
          <ResumeJobButton job={job} />
        )}
        {job.status === "paused" && (
          <CancelJobButton jobId={job.id} />
        )}
      </div>
    </article>
  )
}
