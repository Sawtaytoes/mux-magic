import { useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect, useState } from "react"
import { smartMatchModalAtom } from "../../components/SmartMatchModal/smartMatchModalAtom"
import {
  type LogStreamDonePayload,
  useLogStream,
} from "../../hooks/useLogStream"
import { progressByJobIdAtom } from "../../state/progressByJobIdAtom"
import { stepsAtom } from "../../state/stepsAtom"
import type { SequenceItem, Step } from "../../types"
import { ProgressBar } from "../ProgressBar/ProgressBar"

// Minimum shape of the NSF summary record. The full server type lives
// at `packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.events.ts`
// — we only narrow the fields we actually read so unrelated server
// changes don't ripple here.
type NsfSummaryRecord = {
  unrenamedFilenames: string[]
  possibleNames: Array<{
    name: string
    timecode?: string
  }>
  unnamedFileCandidates?: Array<{
    filename: string
    durationSeconds: number | null
    candidates: string[]
  }>
}

const isNsfSummary = (
  entry: unknown,
): entry is NsfSummaryRecord => {
  if (typeof entry !== "object" || entry === null)
    return false
  const candidate = entry as Record<string, unknown>
  return (
    Array.isArray(candidate.unrenamedFilenames) &&
    Array.isArray(candidate.possibleNames)
  )
}

const findNsfSummary = (
  results: unknown[] | undefined,
): NsfSummaryRecord | null => {
  if (!results) return null
  const match = results.find(isNsfSummary)
  return match ?? null
}

const findStepById = (
  items: SequenceItem[],
  stepId: string,
): Step | null => {
  const result = items
    .flatMap((item) =>
      "kind" in item && item.kind === "group"
        ? item.steps
        : [item as Step],
    )
    .find((step) => step.id === stepId)
  return result ?? null
}

const resolveSourcePath = (
  step: Step | null,
): string | null => {
  if (!step) return null
  const raw = step.params.sourcePath
  if (typeof raw === "string" && raw.length > 0) {
    return raw
  }
  return null
}

interface ChildProgressTrackerProps {
  stepId: string
  jobId: string
}

export const ChildProgressTracker = ({
  stepId,
  jobId,
}: ChildProgressTrackerProps) => {
  const progressByJobId = useAtomValue(progressByJobIdAtom)
  const steps = useAtomValue(stepsAtom)
  const setSmartMatch = useSetAtom(smartMatchModalAtom)

  const [nsfSummary, setNsfSummary] =
    useState<NsfSummaryRecord | null>(null)

  const handleDone = useCallback(
    (payload: LogStreamDonePayload) => {
      const summary = findNsfSummary(payload.results)
      setNsfSummary(summary)
    },
    [],
  )

  const { connect } = useLogStream(jobId, handleDone)

  useEffect(() => {
    connect()
  }, [connect])

  const snap = progressByJobId.get(jobId) ?? {}

  const step = findStepById(steps, stepId)
  const sourcePath = resolveSourcePath(step)

  const hasSmartMatchCandidates =
    nsfSummary !== null &&
    nsfSummary.unnamedFileCandidates !== undefined &&
    nsfSummary.unnamedFileCandidates.length > 0 &&
    nsfSummary.possibleNames.length > 0 &&
    sourcePath !== null

  const openSmartMatch = () => {
    if (!nsfSummary?.unnamedFileCandidates || !sourcePath) {
      return
    }
    setSmartMatch({
      jobId,
      stepId,
      sourcePath,
      unrenamedFiles: nsfSummary.unnamedFileCandidates.map(
        (entry) => ({
          filename: entry.filename,
          durationSeconds: entry.durationSeconds,
        }),
      ),
      candidates: nsfSummary.possibleNames,
    })
  }

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
      {hasSmartMatchCandidates && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            id="smart-match-trigger"
            onClick={openSmartMatch}
            className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded font-medium"
            title="Review and rename leftover files that didn't match by timecode"
          >
            Smart Match…
          </button>
        </div>
      )}
    </div>
  )
}
