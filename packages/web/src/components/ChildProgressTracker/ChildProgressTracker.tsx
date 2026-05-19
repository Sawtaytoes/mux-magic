import { useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect, useState } from "react"
import { getLinkedValue } from "../../commands/links"
import { smartMatchModalAtom } from "../../components/SmartMatchModal/smartMatchModalAtom"
import {
  type LogStreamDonePayload,
  useLogStream,
} from "../../hooks/useLogStream"
import { commandsAtom } from "../../state/commandsAtom"
import { progressByJobIdAtom } from "../../state/progressByJobIdAtom"
import { stepsAtom } from "../../state/stepsAtom"
import { variablesAtom } from "../../state/variablesAtom"
import type { Commands } from "../../commands/types"
import type {
  SequenceItem,
  Step,
  Variable,
} from "../../types"
import { ProgressBar } from "../ProgressBar/ProgressBar"

// Minimum shape of the NSF summary record. The full server type lives
// at `packages/api/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.events.ts`
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

// Resolves the step's `sourcePath` value. The literal-string-in-params
// case is the simple path (typed directly into the field). When the user
// links the field to a top-level path variable (very common because
// `sourcePath` is the canonical primary-input field per worker 24),
// `params.sourcePath` is empty and the actual value lives in
// `step.links.sourcePath` pointing at a variable id — `getLinkedValue`
// dereferences that and returns the variable's value. Without this
// dereference the Smart Match button never appeared on sequences that
// linked sourcePath to a shared variable.
const resolveSourcePath = (
  step: Step | null,
  variables: Variable[],
  commands: Commands,
  findStep: (id: string) => Step | undefined,
): string | null => {
  if (!step) return null
  const linked = getLinkedValue(
    step,
    "sourcePath",
    variables,
    commands,
    findStep,
  )
  if (typeof linked === "string" && linked.length > 0) {
    return linked
  }
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
  const variables = useAtomValue(variablesAtom)
  const commands = useAtomValue(commandsAtom)
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
  const findStep = (id: string): Step | undefined =>
    findStepById(steps, id) ?? undefined
  const sourcePath = resolveSourcePath(
    step,
    variables,
    commands,
    findStep,
  )

  // Open Smart Match whenever leftover files exist — even with zero
  // DVDCompare candidates. Without candidates the modal still surfaces
  // the leftover filenames so the user can manually rename them; gating
  // on possibleNames.length > 0 previously hid the UI entirely when every
  // DVDCompare extra had a timecode, leaving leftover files invisible.
  const hasSmartMatchCandidates =
    nsfSummary !== null &&
    nsfSummary.unnamedFileCandidates !== undefined &&
    nsfSummary.unnamedFileCandidates.length > 0 &&
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
