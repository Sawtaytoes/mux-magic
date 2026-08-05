import type { ListboxItem } from "@charcuterie/ui"
import { Button, Combobox, IconButton } from "@charcuterie/ui"
import {
  defaultAnimateLayoutChanges,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useAtomValue, useSetAtom } from "jotai"
import { useEffect, useRef, useState } from "react"
// Single source of truth — the picker's tag ordering must match the
// canonical list in commands.ts so new tags (e.g. "Flow Control") flow
// through automatically.
import { TAG_ORDER } from "../../commands/commands"
import type { Commands } from "../../commands/types"
import {
  commandHelpCommandNameAtom,
  commandHelpModalOpenAtom,
} from "../../components/CommandHelpModal/commandHelpAtoms"
import { promptModalAtom } from "../../components/PromptModal/promptModalAtom"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import { CollapseChevron } from "../../icons/CollapseChevron/CollapseChevron"
import { CopyIcon } from "../../icons/CopyIcon/CopyIcon"
import { InfoIcon } from "../../icons/InfoIcon/InfoIcon"
import { commandLabel } from "../../jobs/commandLabels"
import { commandsAtom } from "../../state/commandsAtom"
import {
  runningAtom,
  runOrStopStepAtom,
} from "../../state/runAtoms"
import {
  toggleStepCollapsedAtom,
  updateStepAliasAtom,
} from "../../state/stepAtoms"
import type { Step } from "../../types"
import { RenderFields } from "../RenderFields/RenderFields"
import { StatusBadge } from "../StatusBadge/StatusBadge"
import { StepRunProgress } from "./StepRunProgress"

// The command picker's options, grouped by TAG_ORDER and alphabetised
// within each tag by display label. `textValue` carries label + name +
// tag so the Combobox's internal filter matches any of the three (the old
// CommandPicker.matchesQuery behaviour).
const buildCommandOptions = (
  commands: Commands,
): ListboxItem[] =>
  TAG_ORDER.flatMap((tag) =>
    Object.entries(commands)
      .filter(([, command]) => command.tag === tag)
      .map(([name]) => name)
      .sort((nameA, nameB) =>
        commandLabel(nameA).localeCompare(
          commandLabel(nameB),
        ),
      )
      .map((name) => ({
        value: name,
        textValue: `${commandLabel(name)} ${name} ${tag}`,
        label: (
          <span className="flex flex-1 items-start gap-2">
            <span className="flex-1 min-w-0 flex flex-col">
              <span className="text-xs truncate">
                {commandLabel(name)}
              </span>
              <span className="font-mono text-[10px] truncate text-content-muted">
                {name}
              </span>
            </span>
            <span className="text-[10px] shrink-0 mt-0.5 text-content-muted">
              {tag}
            </span>
          </span>
        ),
      })),
  )

interface StepCardProps {
  step: Step
  index: number
  isFirst: boolean
  isLast: boolean
  parentGroupId?: string | null
  isDragOverlay?: boolean
  isDropTarget?: boolean
}

export const StepCard = ({
  step,
  index,
  isFirst,
  isLast,
  parentGroupId = null,
  isDragOverlay = false,
  isDropTarget = false,
}: StepCardProps) => {
  const [isActionsOpen, setIsActionsOpen] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const toggleCollapsed = useSetAtom(
    toggleStepCollapsedAtom,
  )
  const updateAlias = useSetAtom(updateStepAliasAtom)
  const runOrStopStep = useSetAtom(runOrStopStepAtom)
  const isGloballyRunning = useAtomValue(runningAtom)
  const promptData = useAtomValue(promptModalAtom)
  const setPromptData = useSetAtom(promptModalAtom)
  const isThisStepRunning =
    step.status === "running" && step.jobId
  // Server-side the job is still "running" while suspended at a
  // prompt — but for the user, "paused" is the truthful word. Derive
  // it here so neither step.status nor the runner need a new field;
  // the prompt atom is the source of truth. Match on jobId because a
  // sequence's steps share an umbrella jobId — only the currently
  // running step among them is the one that issued the prompt.
  const isPausedForPrompt = Boolean(
    isThisStepRunning &&
      promptData &&
      promptData.jobId === step.jobId,
  )
  const resumePrompt = () => {
    setPromptData((prev) =>
      prev && prev.jobId === step.jobId
        ? { ...prev, isMinimized: false }
        : prev,
    )
  }
  // One-shot pulse on the falsy → true transition of this step's
  // promptData.isMinimized, so a user who dismissed the modal by
  // accident (Escape, backdrop click) sees a visual breadcrumb on
  // the badge where their prompt went. Not fired on first render of
  // an already-minimized prompt — see types.ts: a brand-new prompt
  // arrives with isMinimized undefined, so falsy→true only happens
  // on user-driven dismissal.
  const isCurrentlyMinimized = Boolean(
    isPausedForPrompt && promptData?.isMinimized,
  )
  const prevIsMinimizedRef = useRef(isCurrentlyMinimized)
  const [isJustMinimized, setIsJustMinimized] =
    useState(false)
  useEffect(() => {
    const hasJustMinimized =
      !prevIsMinimizedRef.current && isCurrentlyMinimized
    prevIsMinimizedRef.current = isCurrentlyMinimized
    if (!hasJustMinimized) return
    const isReducedMotion =
      window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches ?? false
    if (isReducedMotion) return
    setIsJustMinimized(true)
    const timer = window.setTimeout(() => {
      setIsJustMinimized(false)
    }, 900)
    return () => {
      window.clearTimeout(timer)
    }
  }, [isCurrentlyMinimized])
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
  const commands = useAtomValue(commandsAtom)
  const [isCommandPickerOpen, setIsCommandPickerOpen] =
    useState(false)

  const {
    changeCommand,
    copyStepYaml,
    moveStep,
    removeStep,
  } = useBuilderActions()

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

  const commandOptions = buildCommandOptions(commands)

  const handleCommandSelect = (name: string) => {
    changeCommand(step.id, name)
    setIsCommandPickerOpen(false)
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
    <span className="text-content-muted italic">
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
      className={`step-card bg-surface-raised rounded-xl border border-border-default overflow-hidden${isDropTarget && !isDragOverlay ? " ring-2 ring-border-focus" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border-default bg-surface-raised/80">
        <IconButton
          label="Drag to reorder"
          intent="neutral"
          appearance="ghost"
          size="sm"
          data-drag-handle
          title="Drag to reorder"
          className="shrink-0 select-none cursor-grab active:cursor-grabbing"
          ref={
            isDragOverlay
              ? undefined
              : sortable.setActivatorNodeRef
          }
          {...(isDragOverlay ? {} : sortable.attributes)}
          {...(isDragOverlay ? {} : sortable.listeners)}
        >
          ⠿
        </IconButton>
        <IconButton
          intent="neutral"
          appearance="ghost"
          size="sm"
          onClick={() => toggleCollapsed(step.id)}
          label={
            step.isCollapsed
              ? "Expand step"
              : "Collapse step"
          }
          title={
            step.isCollapsed
              ? "Expand step"
              : "Collapse step"
          }
          className="shrink-0"
        >
          <CollapseChevron isCollapsed={step.isCollapsed} />
        </IconButton>
        <span className="text-xs font-mono text-content-muted shrink-0 w-5 text-center">
          {index + 1}
        </span>
        <input
          type="text"
          defaultValue={step.alias}
          placeholder={label || "Click to name this step"}
          data-step-alias={step.id}
          onBlur={handleAliasBlur}
          onKeyDown={handleAliasKeydown}
          className="step-alias bg-transparent text-sm font-medium text-content-primary px-1.5 py-0.5 rounded border-0 focus:outline-none focus:bg-surface-sunken/40 placeholder:text-content-secondary placeholder:font-medium"
        />
        <Combobox
          trigger={
            <Button
              intent="neutral"
              appearance="outline"
              size="sm"
              onClick={() =>
                setIsCommandPickerOpen(
                  (isCurrentlyOpen) => !isCurrentlyOpen,
                )
              }
              data-cmd-picker-trigger
              iconEnd={
                <span className="text-content-secondary shrink-0">
                  ▾
                </span>
              }
              className="flex-1 min-w-0 justify-between text-left"
            >
              <span className="flex-1 min-w-0 truncate flex items-center">
                {triggerLabel}
              </span>
            </Button>
          }
          isVisible={isCommandPickerOpen}
          onDismiss={() => setIsCommandPickerOpen(false)}
          onSelect={handleCommandSelect}
          options={commandOptions}
          selectedValue={step.command || undefined}
          placeholder="Search commands…"
          emptyLabel="No commands match."
        />
        {isPausedForPrompt ? (
          // Clickable to reopen the minimized PromptModal. When the
          // modal isn't minimized the click is harmless — resumePrompt
          // sets isMinimized=false on a prompt that's already visible.
          <button
            type="button"
            onClick={resumePrompt}
            title="Resume — reopen the prompt for this step"
            aria-label="Resume — reopen the prompt for this step"
            data-just-minimized={
              isJustMinimized ? "true" : undefined
            }
            className={`cursor-pointer rounded-full${isJustMinimized ? " paused-badge-just-minimized" : ""}`}
          >
            <StatusBadge status="paused" />
          </button>
        ) : (
          step.status && (
            <StatusBadge status={step.status} />
          )
        )}
        {step.command && (
          <IconButton
            intent="neutral"
            appearance="ghost"
            size="sm"
            onClick={openCommandHelp}
            title="Show docs for this command's settings"
            label="Show docs for this command's settings"
          >
            <InfoIcon />
          </IconButton>
        )}
        <IconButton
          intent="neutral"
          appearance="ghost"
          size="sm"
          onClick={() =>
            setIsActionsOpen((isPrev) => !isPrev)
          }
          title="Step actions"
          label="Step actions"
          className="step-hamburger-btn leading-none"
        >
          ≡
        </IconButton>
        <div
          className={`step-actions${isActionsOpen ? " open" : ""} flex items-center gap-1`}
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
          <IconButton
            intent="neutral"
            appearance="ghost"
            size="sm"
            onClick={() => {
              moveStep({
                stepId: step.id,
                direction: -1,
                parentGroupId,
              })
            }}
            isDisabled={isFirst}
            label="Move step up"
          >
            ↑
          </IconButton>
          <IconButton
            intent="neutral"
            appearance="ghost"
            size="sm"
            onClick={() => {
              moveStep({
                stepId: step.id,
                direction: 1,
                parentGroupId,
              })
            }}
            isDisabled={isLast}
            label="Move step down"
          >
            ↓
          </IconButton>
          {step.command && (
            <IconButton
              intent={isCopied ? "success" : "neutral"}
              appearance={isCopied ? "soft" : "ghost"}
              size="sm"
              onClick={async () => {
                await copyStepYaml(step.id)
                setIsCopied(true)
                setTimeout(() => setIsCopied(false), 1500)
              }}
              title="Copy this step's YAML"
              label="Copy this step's YAML"
            >
              {isCopied ? "✓" : <CopyIcon />}
            </IconButton>
          )}
          <IconButton
            intent="danger"
            appearance="ghost"
            size="sm"
            onClick={() => {
              removeStep(step.id)
            }}
            title="Remove this step"
            label="Remove this step"
          >
            ✕
          </IconButton>
        </div>
      </div>
      {step.jobId && (
        <StepRunProgress
          stepId={step.id}
          jobId={step.jobId}
          status={step.status}
        />
      )}
      {!step.isCollapsed && (
        <div className="px-3 py-2">
          {cmd ? (
            <>
              {cmd.summary && (
                <p className="text-xs text-content-muted mb-2">
                  {cmd.summary}
                </p>
              )}
              {cmd.note && (
                <p className="text-xs text-intent-warning-content bg-intent-warning-surface border border-intent-warning-border rounded px-2 py-1 mb-2">
                  {cmd.note}
                </p>
              )}
              {cmd.outputFolderName && (
                <p className="text-xs text-intent-warning-content mb-2">
                  {"→ outputs to "}
                  <code className="text-intent-warning-content bg-surface-sunken px-1 rounded">
                    {cmd.outputFolderName}/
                  </code>
                  {" subfolder"}
                </p>
              )}
              {step.status === "completed" &&
                step.hasResults === false && (
                  <p className="text-xs text-intent-info-content bg-intent-info-surface border border-intent-info-border rounded px-2 py-1 mb-2">
                    Step completed — No items reported.
                  </p>
                )}
              {step.error && (
                <p className="text-xs text-intent-danger-content bg-intent-danger-surface rounded px-2 py-1 mb-2 font-mono">
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
            <p className="text-xs text-content-muted italic">
              No command selected — choose one from the
              dropdown above.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
