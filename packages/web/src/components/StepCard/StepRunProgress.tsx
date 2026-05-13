import { useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect } from "react"
import {
  type LogStreamDonePayload,
  useLogStream,
} from "../../hooks/useLogStream"
import { progressByJobIdAtom } from "../../state/progressByJobIdAtom"
import { runningAtom } from "../../state/runAtoms"
import { setStepRunStatusAtom } from "../../state/stepAtoms"
import { ProgressBar } from "../ProgressBar/ProgressBar"

export const StepRunProgress = ({
  stepId,
  jobId,
}: {
  stepId: string
  jobId: string
}) => {
  const progressByJobId = useAtomValue(progressByJobIdAtom)
  const setStepRunStatus = useSetAtom(setStepRunStatusAtom)
  const setRunning = useSetAtom(runningAtom)

  const handleDone = useCallback(
    (payload: LogStreamDonePayload) => {
      const finalStatus = payload.status ?? "completed"
      const hasResults = Array.isArray(payload.results)
        ? payload.results.length > 0
        : null
      setStepRunStatus({
        stepId,
        status: finalStatus,
        jobId: null,
        error: payload.error ?? null,
        hasResults,
      })
      setRunning(false)
    },
    [stepId, setStepRunStatus, setRunning],
  )

  const { connect } = useLogStream(jobId, handleDone)

  useEffect(() => {
    connect()
  }, [connect])

  const snap = progressByJobId.get(jobId) ?? {}

  return (
    <div className="px-3 py-2 border-b border-slate-700 bg-slate-900/60">
      <ProgressBar snapshot={snap} />
    </div>
  )
}
