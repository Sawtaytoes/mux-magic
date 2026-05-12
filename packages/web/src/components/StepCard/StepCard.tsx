import {
  defaultAnimateLayoutChanges,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useAtomValue, useSetAtom } from "jotai"
import { useEffect, useRef, useState } from "react"
import {
  commandHelpCommandNameAtom,
  commandHelpModalOpenAtom,
} from "../../components/CommandHelpModal/commandHelpAtoms"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import { useLogStream } from "../../hooks/useLogStream"
import { CollapseChevron } from "../../icons/CollapseChevron/CollapseChevron"
import { CopyIcon } from "../../icons/CopyIcon/CopyIcon"
import { commandLabel } from "../../jobs/commandLabels"
import { commandsAtom } from "../../state/commandsAtom"
import { commandPickerStateAtom } from "../../state/pickerAtoms"
import { progressByJobIdAtom } from "../../state/progressByJobIdAtom"
import {
  runningAtom,
  runOrStopStepAtom,
} from "../../state/runAtoms"
import {
  moveStepAtom,
  removeStepAtom,
  toggleStepCollapsedAtom,
  updateStepAliasAtom,
} from "../../state/stepAtoms"
import type { Step } from "../../types"
import { runWithViewTransition } from "../../utils/runWithViewTransition"
import { ProgressBar } from "../ProgressBar/ProgressBar"
import { RenderFields } from "../RenderFields/RenderFields"
import { StatusBadge } from "../StatusBadge/StatusBadge"

// ─── Progress bar for a running step ─────────────────────────────────────────
// Opens its own useLogStream connection so progress events populate
// progressByJobIdAtom even for single-step runs (runOrStopStepAtom's
// EventSource only handles the done event, not progress events).

const StepRunProgress = ({ jobId }: { jobId: string }) => {
  const progressByJobId = useAtomValue(progressByJobIdAtom)
  const { connect } = useLogStream(jobId)

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

interface StepCardProps {
  step: Step
  index: number
  isFirst: boolean
  isLast: boolean
  parentGroupId?: string | null
  isDragOverlay?: boolean
  isDropTarget?: boolean
}

const StepCardInner = ({
  step,
  index,
  isFirst,
  isLast,
  parentGroupId = null,
  isDragOverlay = false,
  isDropTarget = false,
}: StepCardProps) => {
  const [actionsOpen, setActionsOpen] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const toggleCollapsed = useSetAtom(
    toggleStepCollapsedAtom,
  )
  const updateAlias = useSetAtom(updateStepAliasAtom)
  const moveStep = useSetAtom(moveStepAtom)
  const removeStep = useSetAtom(removeStepAtom)
  const runOrStopStep = useSetAtom(runOrStopStepAtom)
  const isGloballyRunning = useAtomValue(runningAtom)
  const isThisStepRunning =
    step.status === "running" && step.jobId
  const isRunDisabled =
    !step.command ||
    (isGloballyRunning && !isThisStepRunning)
  const runStopLabel = isThisStepRunning
    ? "Cancel this step"
    : isGloballyRunning
      ? "Another job is already running"
      : "Run this step only"
  const setCommandHelpName = useSetAtom(
    commandHelpCommandNameAtom,
  )
  const setCommandHelpOpen = useSetAtom(
    commandHelpModalOpenAtom,
  )
  const setCommandPickerState = useSetAtom(
    commandPickerStateAtom,
  )
  const commands = useAtomValue(commandsAtom)

  const { copyStepYaml } = useBuilderActions()
  const triggerRef = useRef<HTMLButtonElement>(null)

  const sortable = useSortable({
    id: step.id,
    animateLayoutChanges: defaultAnimateLayoutChanges,
  })
  const dragStyle = isDragOverlay
    ? {}
    : {
        transform: CSS.Transform.toString(
          sortable.transform,
        ),
        transition:
          sortable.transition ??
          (sortable.transform
            ? "transform 250ms ease"
            : undefined),
      }

  const label = commandLabel(step.command) || step.command

  const openCommandPicker = () => {
    if (!triggerRef.current) return
    const raw = triggerRef.current.getBoundingClientRect()
    const triggerRect = {
      left: raw.left,
      top: raw.top,
      right: raw.right,
      bottom: raw.bottom,
      width: raw.width,
      height: raw.height,
    }
    setCommandPickerState((current) => {
      if (current?.anchor.stepId === step.id) return null
      return { anchor: { stepId: step.id }, triggerRect }
    })
  }

  const openCommandHelp = () => {
    setCommandHelpName(step.command)
    setCommandHelpOpen(true)
  }

  const handleAliasBlur = (
    event: React.FocusEvent<HTMLInputElement>,
  ) => {
    updateAlias({
      stepId: step.id,
      alias: event.currentTarget.value,
    })
  }

  const handleAliasKeydown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter" || event.key === "Escape") {
      event.currentTarget.blur()
    }
  }

  const triggerLabel = label ? (
    <span>{label}</span>
  ) : (
    <span className="text-slate-400 italic">
      — pick a command —
    </span>
  )

  const cmd = commands[step.command] as
    | {
        summary?: string
        note?: string
        outputFolderName?: string | null
      }
    | undefined

  const opacity =
    sortable.isDragging && !isDragOverlay ? 0.3 : 1

  return (
    <div
      ref={isDragOverlay ? undefined : sortable.setNodeRef}
      id={`step-${step.id}`}
      data-step-card={step.id}
      style={{
        viewTransitionName: `step-${step.id}`,
        ...dragStyle,
        opacity,
      }}
      className={`step-card bg-slate-800 rounded-xl border border-slate-700 overflow-hidden${isDropTarget && !isDragOverlay ? " ring-2 ring-blue-500/60" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-800/80">
        <button
          type="button"
          data-drag-handle
          aria-label="Drag to reorder"
          title="Drag to reorder"
          className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 shrink-0 select-none cursor-grab active:cursor-grabbing"
          ref={
            isDragOverlay
              ? undefined
              : sortable.setActivatorNodeRef
          }
          {...(isDragOverlay ? {} : sortable.attributes)}
          {...(isDragOverlay ? {} : sortable.listeners)}
        >
          ⠿
        </button>
        <button
          type="button"
          onClick={() => toggleCollapsed(step.id)}
          title={
            step.isCollapsed
              ? "Expand step"
              : "Collapse step"
          }
          className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 shrink-0"
        >
          <CollapseChevron isCollapsed={step.isCollapsed} />
        </button>
        <span className="text-xs font-mono text-slate-500 shrink-0 w-5 text-center">
          {index + 1}
        </span>
        <input
          type="text"
          defaultValue={step.alias}
          placeholder={label || "Click to name this step"}
          data-step-alias={step.id}
          onBlur={handleAliasBlur}
          onKeyDown={handleAliasKeydown}
          className="step-alias bg-transparent text-sm font-medium text-slate-200 px-1.5 py-0.5 rounded border-0 focus:outline-none focus:bg-slate-900/40 placeholder:text-slate-200 placeholder:font-medium"
        />
        <button
          ref={triggerRef}
          type="button"
          onClick={openCommandPicker}
          data-cmd-picker-trigger
          className="flex-1 min-w-0 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 text-left flex items-center gap-2 cursor-pointer"
        >
          <span className="flex-1 min-w-0 truncate flex items-center">
            {triggerLabel}
          </span>
          <span className="text-slate-400 shrink-0">▾</span>
        </button>
        {step.status && (
          <StatusBadge status={step.status} />
        )}
        {step.command && (
          <button
            type="button"
            onClick={openCommandHelp}
            title="Show docs for this command's settings"
            aria-label="Show docs for this command's settings"
            className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-blue-300 hover:bg-slate-700 text-xs"
          >
            ⓘ
          </button>
        )}
        <button
          type="button"
          onClick={() => setActionsOpen((prev) => !prev)}
          title="Step actions"
          aria-label="Step actions"
          className="step-hamburger-btn w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-base leading-none"
        >
          ≡
        </button>
        <div
          className={`step-actions${actionsOpen ? " open" : ""} flex items-center gap-1`}
        >
          <button
            type="button"
            onClick={() => void runOrStopStep(step.id)}
            disabled={isRunDisabled}
            aria-disabled={isRunDisabled}
            title={runStopLabel}
            aria-label={runStopLabel}
            data-step-run-stop={step.id}
            className={`step-run-stop ${isThisStepRunning ? "is-running" : ""}`}
          >
            <span className="step-run-stop-icon step-run-stop-play">
              ▶
            </span>
            <span className="step-run-stop-icon step-run-stop-stop">
              ⏹
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              runWithViewTransition(() => {
                moveStep({
                  stepId: step.id,
                  direction: -1,
                  parentGroupId,
                })
              })
            }}
            disabled={isFirst}
            aria-label="Move step up"
            className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 text-xs"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => {
              runWithViewTransition(() => {
                moveStep({
                  stepId: step.id,
                  direction: 1,
                  parentGroupId,
                })
              })
            }}
            disabled={isLast}
            aria-label="Move step down"
            className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 text-xs"
          >
            ↓
          </button>
          {step.command && (
            <button
              type="button"
              onClick={async () => {
                await copyStepYaml(step.id)
                setIsCopied(true)
                setTimeout(() => setIsCopied(false), 1500)
              }}
              title="Copy this step's YAML"
              aria-label="Copy this step's YAML"
              className={`w-6 h-6 flex items-center justify-center rounded text-xs border transition-colors ${isCopied ? "text-emerald-400 border-emerald-500/50 bg-slate-700" : "text-slate-500 hover:text-emerald-400 hover:bg-slate-700 border-transparent"}`}
            >
              {isCopied ? "✓" : <CopyIcon />}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              runWithViewTransition(() => {
                removeStep(step.id)
              })
            }}
            title="Remove this step"
            aria-label="Remove this step"
            className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 text-xs"
          >
            ✕
          </button>
        </div>
      </div>
      {step.status === "running" && step.jobId && (
        <StepRunProgress jobId={step.jobId} />
      )}
      {!step.isCollapsed && (
        <div className="px-3 py-2">
          {cmd ? (
            <>
              {cmd.summary && (
                <p className="text-xs text-slate-500 mb-2">
                  {cmd.summary}
                </p>
              )}
              {cmd.note && (
                <p className="text-xs text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded px-2 py-1 mb-2">
                  {cmd.note}
                </p>
              )}
              {cmd.outputFolderName && (
                <p className="text-xs text-amber-500/80 mb-2">
                  {"→ outputs to "}
                  <code className="text-amber-400 bg-slate-900 px-1 rounded">
                    {cmd.outputFolderName}/
                  </code>
                  {" subfolder"}
                </p>
              )}
              {step.status === "noop" && (
                <p className="text-xs text-blue-300 bg-blue-950/40 border border-blue-800/50 rounded px-2 py-1 mb-2">
                  Step completed — No items reported — see logs above for
                  detail.
                </p>
              )}
              {step.error && (
                <p className="text-xs text-red-400 bg-red-950/40 rounded px-2 py-1 mb-2 font-mono">
                  {step.error}
                </p>
              )}
              <div className="space-y-2">
                <RenderFields
                  step={step}
                  stepIndex={index}
                />
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500 italic">
              No command selected — choose one from the
              dropdown above.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export const StepCard = (props: StepCardProps) => (
  <StepCardInner {...props} />
)
