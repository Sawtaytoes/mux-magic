import { useAtomValue } from "jotai"
import { useCallback, useEffect, useState } from "react"
import { getLinkedValue } from "../../commands/links"
import type { Commands } from "../../commands/types"
import {
  type LogStreamDonePayload,
  useLogStream,
} from "../../hooks/useLogStream"
import { commandsAtom } from "../../state/commandsAtom"
import { progressByJobIdAtom } from "../../state/progressByJobIdAtom"
import { stepsAtom } from "../../state/stepsAtom"
import { variablesAtom } from "../../state/variablesAtom"
import type {
  SequenceItem,
  Step,
  Variable,
} from "../../types"
import {
  findNsfEditionPlan,
  findNsfRenamePairs,
  findNsfSummary,
  mergeAppliedRenamesIntoNsfResults,
  type NsfEditionPlanRecord,
  type NsfRenamePair,
  type NsfSummaryRecord,
} from "../NsfRunResults/findNsfResults"
import { NsfRunResults } from "../NsfRunResults/NsfRunResults"
import { ProgressBar } from "../ProgressBar/ProgressBar"
import { appliedSmartMatchRenamesByJobIdAtom } from "../SmartMatchModal/appliedSmartMatchRenamesAtom"

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
// dereferences that and returns the variable's value.
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
  const appliedRenamesByJobId = useAtomValue(
    appliedSmartMatchRenamesByJobIdAtom,
  )

  const [summary, setSummary] =
    useState<NsfSummaryRecord | null>(null)
  const [renamePairs, setRenamePairs] = useState<
    NsfRenamePair[]
  >([])
  const [editionPlan, setEditionPlan] =
    useState<NsfEditionPlanRecord | null>(null)
  // Reset captured results on jobId change — see StepRunProgress for
  // the same pattern.
  const [lastSeenJobId, setLastSeenJobId] = useState<
    string | null
  >(null)
  if (lastSeenJobId !== jobId) {
    setLastSeenJobId(jobId)
    setSummary(null)
    setRenamePairs([])
    setEditionPlan(null)
  }

  const handleDone = useCallback(
    (payload: LogStreamDonePayload) => {
      setSummary(findNsfSummary(payload.results))
      setRenamePairs(findNsfRenamePairs(payload.results))
      setEditionPlan(findNsfEditionPlan(payload.results))
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

  // See StepRunProgress for the rationale on merging SmartMatch
  // applied renames into the displayed view.
  const appliedRenames =
    appliedRenamesByJobId.get(jobId) ?? []
  const merged = mergeAppliedRenamesIntoNsfResults({
    summary,
    renamePairs,
    appliedRenames,
  })

  return (
    <div
      id="api-run-progress-host"
      className="px-4 py-2 border-b border-slate-700 bg-slate-900 shrink-0 flex flex-col gap-2"
    >
      <p
        id="api-run-progress-step-label"
        className="text-xs text-slate-400"
      >
        Step {stepId}
      </p>
      <ProgressBar snapshot={snap} />
      <NsfRunResults
        jobId={jobId}
        stepId={stepId}
        sourcePath={sourcePath}
        renamePairs={merged.renamePairs}
        summary={merged.summary}
        editionPlan={editionPlan}
      />
    </div>
  )
}
