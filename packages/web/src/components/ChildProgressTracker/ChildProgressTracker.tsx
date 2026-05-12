import { useAtomValue } from "jotai"
import { useEffect } from "react"
import { useLogStream } from "../../hooks/useLogStream"
import { progressByJobIdAtom } from "../../state/progressByJobIdAtom"
import { ProgressBar } from "../ProgressBar/ProgressBar"

interface ChildProgressTrackerProps {
  stepId: string
  jobId: string
}

export const ChildProgressTracker = ({
  stepId,
  jobId,
}: ChildProgressTrackerProps) => {
  const progressByJobId = useAtomValue(progressByJobIdAtom)
  const { connect } = useLogStream(jobId)

  useEffect(() => {
    connect()
  }, [connect])

  const snap = progressByJobId.get(jobId) ?? {}

  return (
    <div
      id="api-run-progress-host"
      className="px-4 py-2 border-b border-slate-700 bg-slate-900 shrink-0"
    >
      <p
        id="api-run-progress-step-label"
        className="text-xs text-slate-400 mb-1"
      >
        Step {stepId}
      </p>
      <ProgressBar snapshot={snap} />
    </div>
  )
}
