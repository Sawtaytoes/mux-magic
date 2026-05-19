import type { ProgressSnapshot } from "../../jobs/types"
import {
  type NsfRenamePair,
  type NsfSummaryRecord,
} from "../NsfRunResults/findNsfResults"
import { NsfRunResults } from "../NsfRunResults/NsfRunResults"
import { ProgressBar } from "../ProgressBar/ProgressBar"
import { StepLogs } from "./StepLogs"

// Presentational core of StepRunProgress. Same render tree, no atoms
// or SSE subscriptions — so storybook can pass in fully-seeded
// `summary` / `renamePairs` and exercise every post-run state
// without a real job run.
type Props = {
  jobId: string
  stepId: string
  isRunning: boolean
  snap: ProgressSnapshot
  sourcePath: string | null
  renamePairs: NsfRenamePair[]
  summary: NsfSummaryRecord | null
}

export const StepRunProgressView = ({
  jobId,
  stepId,
  isRunning,
  snap,
  sourcePath,
  renamePairs,
  summary,
}: Props) => (
  <div className="px-3 py-2 border-b border-slate-700 bg-slate-900/60 flex flex-col gap-2">
    {isRunning && <ProgressBar snapshot={snap} />}
    <NsfRunResults
      jobId={jobId}
      stepId={stepId}
      sourcePath={sourcePath}
      renamePairs={renamePairs}
      summary={summary}
    />
    <StepLogs jobId={jobId} />
  </div>
)
