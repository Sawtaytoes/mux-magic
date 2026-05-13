import { useAtomValue } from "jotai"

import { commandLabel } from "../../jobs/commandLabels"
import type { Job } from "../../jobs/types"
import { progressByJobIdAtom } from "../../state/progressByJobIdAtom"
import { CancelJobButton } from "../CancelJobButton/CancelJobButton"
import { JobLogsDisclosure } from "../JobLogsDisclosure/JobLogsDisclosure"
import { ProgressBar } from "../ProgressBar/ProgressBar"
import { StatusBadge } from "../StatusBadge/StatusBadge"

export const JobStepRow = ({
  child,
  index,
}: {
  child: Job
  index: number
}) => {
  const progressByJobId = useAtomValue(progressByJobIdAtom)
  const snap = progressByJobId.get(child.id)

  return (
    <div className="border-l-2 border-slate-700 pl-3 py-1 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs text-slate-500 shrink-0">
            {index + 1}.
          </span>
          <strong className="text-sm truncate min-w-0">
            {commandLabel(child.commandName)}
          </strong>
          {child.stepId && (
            <span
              className="text-xs text-slate-500 truncate min-w-0"
              title={child.stepId}
            >
              {child.stepId}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={child.status} />
          {child.status === "running" && (
            <CancelJobButton jobId={child.id} />
          )}
        </div>
      </div>
      {child.error && (
        <p className="text-xs text-red-400 break-words">
          {child.error}
        </p>
      )}
      {child.status === "running" && snap && (
        <ProgressBar snapshot={snap} />
      )}
      {child.status !== "skipped" &&
        child.status !== "pending" && (
          <JobLogsDisclosure
            jobId={child.id}
            jobStatus={child.status}
          />
        )}
    </div>
  )
}
