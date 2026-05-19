import { useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect, useState } from "react"
import { getLinkedValue } from "../../commands/links"
import {
  type LogStreamDonePayload,
  useLogStream,
} from "../../hooks/useLogStream"
import { commandsAtom } from "../../state/commandsAtom"
import { progressByJobIdAtom } from "../../state/progressByJobIdAtom"
import { runningAtom } from "../../state/runAtoms"
import { setStepRunStatusAtom } from "../../state/stepAtoms"
import { stepsAtom } from "../../state/stepsAtom"
import { variablesAtom } from "../../state/variablesAtom"
import type { SequenceItem, Step } from "../../types"
import {
  findNsfRenamePairs,
  findNsfSummary,
  type NsfRenamePair,
  type NsfSummaryRecord,
} from "../NsfRunResults/findNsfResults"
import { NsfRunResults } from "../NsfRunResults/NsfRunResults"
import { ProgressBar } from "../ProgressBar/ProgressBar"
import { StepLogs } from "./StepLogs"

// Per-step run display rendered directly on StepCard. Active while the
// step is running (progress bar) AND after it finishes (NSF rename
// report / Fix Unnamed button, when applicable). Was previously
// progress-bar-only and unmounted on done — that path lost the NSF
// summary because handleDone fires AFTER step.jobId is already cleared.
// Now mounted whenever step.jobId is set so the post-run results stay
// visible until the user re-runs the step.

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

// Walks `step.links.sourcePath` to its variable value when the field is
// linked, else falls back to `step.params.sourcePath`. Mirrors the
// resolution in `buildParams.ts` — keeping the same precedence rules so
// the SmartMatch modal (which needs an absolute source folder) sees the
// same path the runner sees.
const resolveSourcePath = (
  step: Step | null,
  variables: Parameters<typeof getLinkedValue>[2],
  commands: Parameters<typeof getLinkedValue>[3],
  findStep: Parameters<typeof getLinkedValue>[4],
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

export const StepRunProgress = ({
  stepId,
  jobId,
  status,
}: {
  stepId: string
  jobId: string
  status: string | null
}) => {
  const progressByJobId = useAtomValue(progressByJobIdAtom)
  const steps = useAtomValue(stepsAtom)
  const variables = useAtomValue(variablesAtom)
  const commands = useAtomValue(commandsAtom)
  const setStepRunStatus = useSetAtom(setStepRunStatusAtom)
  const setRunning = useSetAtom(runningAtom)

  const [summary, setSummary] =
    useState<NsfSummaryRecord | null>(null)
  const [renamePairs, setRenamePairs] = useState<
    NsfRenamePair[]
  >([])
  // Track the jobId the captured results belong to. When jobId changes
  // (a fresh run), reset state during render — the React-idiomatic
  // alternative to a useEffect([jobId]), avoids a stale paint where
  // last run's rename pairs flash on screen before the effect runs.
  const [lastSeenJobId, setLastSeenJobId] = useState<
    string | null
  >(null)
  if (lastSeenJobId !== jobId) {
    setLastSeenJobId(jobId)
    setSummary(null)
    setRenamePairs([])
  }

  const handleDone = useCallback(
    (payload: LogStreamDonePayload) => {
      const finalStatus = payload.status ?? "completed"
      const hasResults = Array.isArray(payload.results)
        ? payload.results.length > 0
        : null
      // Intentionally NOT clearing `jobId` here — the previous behavior
      // (jobId: null) caused StepCard to unmount this component on done,
      // discarding the NSF summary that just arrived in payload.results.
      // Keeping jobId set lets the rename report and Fix Unnamed button
      // stay visible until the user kicks off the next run, which sets
      // a fresh jobId.
      setStepRunStatus({
        stepId,
        status: finalStatus,
        error: payload.error ?? null,
        hasResults,
      })
      setRunning(false)
      setSummary(findNsfSummary(payload.results))
      setRenamePairs(findNsfRenamePairs(payload.results))
    },
    [stepId, setStepRunStatus, setRunning],
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

  const isRunning = status === "running"

  return (
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
}
