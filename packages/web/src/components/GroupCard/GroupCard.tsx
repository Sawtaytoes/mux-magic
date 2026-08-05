import { Button, IconButton } from "@charcuterie/ui"
import { useDndContext, useDroppable } from "@dnd-kit/core"
import {
  defaultAnimateLayoutChanges,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useAtomValue, useSetAtom } from "jotai"
import { useState } from "react"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import { CollapseChevron } from "../../icons/CollapseChevron/CollapseChevron"
import { CopyIcon } from "../../icons/CopyIcon/CopyIcon"
import { DoubleChevron } from "../../icons/DoubleChevron/DoubleChevron"
import {
  setGroupChildrenCollapsedAtom,
  toggleGroupCollapsedAtom,
  updateGroupLabelAtom,
} from "../../state/groupAtoms"
import { scrollToStepAtom } from "../../state/historyAtoms"
import { runningAtom } from "../../state/runAtoms"
import { addStepToGroupAtom } from "../../state/stepAtoms"
import type { Group, Step } from "../../types"
import { StepCard } from "../StepCard/StepCard"

interface GroupCardProps {
  group: Group
  itemIndex: number
  startingFlatIndex: number
  isFirst: boolean
  isLast: boolean
  isDragOverlay?: boolean
  isDropTarget?: boolean
}

export const GroupCard = ({
  group,
  itemIndex: _itemIndex,
  startingFlatIndex,
  isFirst,
  isLast,
  isDragOverlay = false,
  isDropTarget = false,
}: GroupCardProps) => {
  const toggleCollapsed = useSetAtom(
    toggleGroupCollapsedAtom,
  )
  const updateLabel = useSetAtom(updateGroupLabelAtom)
  const setChildrenCollapsed = useSetAtom(
    setGroupChildrenCollapsedAtom,
  )
  const addStep = useSetAtom(addStepToGroupAtom)
  const scrollToStep = useSetAtom(scrollToStepAtom)
  const {
    copyGroupYaml,
    moveGroup,
    pasteCardAt,
    removeGroup,
    runGroup,
  } = useBuilderActions()
  const isGloballyRunning = useAtomValue(runningAtom)
  const [isCopied, setIsCopied] = useState(false)

  const { active } = useDndContext()
  const isDraggingFromWithin = group.steps.some(
    (step) => step.id === active?.id,
  )

  const sortable = useSortable({
    id: group.id,
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

  const { setNodeRef: setDroppableRef, isOver } =
    useDroppable({
      id: `${group.id}-droppable`,
      disabled: isDraggingFromWithin,
    })

  const stepCount = group.steps.length
  const hasRunnableSteps = group.steps.some((step) =>
    Boolean(step.command),
  )
  const parallelBadge = group.isParallel ? (
    <span className="text-[10px] uppercase tracking-wide font-semibold text-intent-accent-content bg-intent-accent-surface border border-intent-accent-border rounded px-1.5 py-0.5">
      parallel
    </span>
  ) : (
    <span className="text-[10px] uppercase tracking-wide font-semibold text-content-secondary bg-surface-sunken border border-border-default rounded px-1.5 py-0.5">
      sequential
    </span>
  )

  const containerClasses = group.isParallel
    ? "parallel-group grid grid-cols-2 gap-3"
    : "serial-group flex flex-col gap-3"

  const innerStepIds = group.steps.map((step) => step.id)

  const outerOpacity = isDragOverlay
    ? 1
    : sortable.isDragging
      ? 0.3
      : 1

  return (
    <div
      ref={isDragOverlay ? undefined : sortable.setNodeRef}
      data-group={group.id}
      style={{
        viewTransitionName: isDragOverlay
          ? undefined
          : `group-${group.id}`,
        ...dragStyle,
        opacity: outerOpacity,
      }}
      className={`group-card ${group.isParallel ? "group-card-parallel" : "group-card-serial"} bg-surface-raised/50 rounded-xl border border-border-default overflow-hidden${isDropTarget && !isDragOverlay ? " ring-2 ring-border-focus" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border-default bg-surface-raised/70">
        <IconButton
          label="Drag to reorder"
          intent="neutral"
          appearance="ghost"
          size="sm"
          data-drag-handle
          title="Drag to reorder"
          className="select-none cursor-grab active:cursor-grabbing"
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
          onClick={() => toggleCollapsed(group.id)}
          label={
            group.isCollapsed
              ? "Expand group"
              : "Collapse group"
          }
          title={
            group.isCollapsed
              ? "Expand group"
              : "Collapse group"
          }
        >
          <CollapseChevron
            isCollapsed={group.isCollapsed}
          />
        </IconButton>
        <input
          type="text"
          defaultValue={group.label}
          placeholder={`${group.isParallel ? "Parallel group" : "Group"} (${stepCount} step${stepCount === 1 ? "" : "s"})`}
          data-group-label={group.id}
          onChange={(event) =>
            updateLabel({
              groupId: group.id,
              label: event.currentTarget.value,
            })
          }
          className="flex-1 min-w-0 bg-transparent text-sm font-medium text-content-primary px-1.5 py-0.5 rounded border-0 focus:outline-none focus:bg-surface-sunken/40 placeholder:text-content-secondary placeholder:font-medium"
        />
        {parallelBadge}
        <IconButton
          intent="neutral"
          appearance="ghost"
          size="sm"
          onClick={() =>
            setChildrenCollapsed({
              groupId: group.id,
              isCollapsed: true,
            })
          }
          label="Collapse all inner steps"
          title="Collapse all inner steps"
        >
          <DoubleChevron isCollapsed={true} />
        </IconButton>
        <IconButton
          intent="neutral"
          appearance="ghost"
          size="sm"
          onClick={() =>
            setChildrenCollapsed({
              groupId: group.id,
              isCollapsed: false,
            })
          }
          label="Expand all inner steps"
          title="Expand all inner steps"
        >
          <DoubleChevron isCollapsed={false} />
        </IconButton>
        <Button
          intent="neutral"
          appearance="outline"
          size="sm"
          onClick={() => {
            const newId = addStep(group.id)
            if (newId) scrollToStep(newId)
          }}
          title="Add a step inside this group"
          className="text-[10px]"
        >
          + Step
        </Button>
        <Button
          intent="neutral"
          appearance="outline"
          size="sm"
          onClick={() => {
            // pasteCardAt is async (reads clipboard first) and now
            // handles its own View Transition wrapping after the
            // async read resolves — do not wrap here.
            pasteCardAt({ parentGroupId: group.id })
          }}
          title="Paste a copied step into this group"
          className="text-[10px]"
        >
          📋 Paste
        </Button>
        <IconButton
          intent="neutral"
          appearance="ghost"
          size="sm"
          onClick={() => {
            moveGroup({ groupId: group.id, direction: -1 })
          }}
          label="Move group up"
          title="Move group up"
          isDisabled={isFirst}
        >
          ↑
        </IconButton>
        <IconButton
          intent="neutral"
          appearance="ghost"
          size="sm"
          onClick={() => {
            moveGroup({ groupId: group.id, direction: 1 })
          }}
          label="Move group down"
          title="Move group down"
          isDisabled={isLast}
        >
          ↓
        </IconButton>
        <IconButton
          intent={isCopied ? "success" : "neutral"}
          appearance={isCopied ? "soft" : "ghost"}
          size="sm"
          onClick={async () => {
            await copyGroupYaml(group.id)
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 1500)
          }}
          label="Copy this group's YAML"
          title="Copy this group's YAML"
        >
          {isCopied ? "✓" : <CopyIcon />}
        </IconButton>
        <Button
          intent="success"
          appearance="outline"
          size="sm"
          onClick={() => runGroup(group.id)}
          isDisabled={!hasRunnableSteps || isGloballyRunning}
          title={
            !hasRunnableSteps
              ? "Add a step with a command before running"
              : isGloballyRunning
                ? "Another job is already running"
                : "Run this group via /sequences/run"
          }
          className="text-[10px]"
        >
          ▶ Run
        </Button>
        <IconButton
          intent="danger"
          appearance="ghost"
          size="sm"
          onClick={() => {
            removeGroup(group.id)
          }}
          label="Remove this group (its inner steps go too)"
          title="Remove this group (its inner steps go too)"
        >
          ✕
        </IconButton>
      </div>
      {!group.isCollapsed && (
        <SortableContext
          id={group.id}
          items={innerStepIds}
          strategy={verticalListSortingStrategy}
        >
          <div
            ref={setDroppableRef}
            className={`${containerClasses} p-3 min-h-[3rem]${isOver && !isDraggingFromWithin ? " bg-intent-accent-surface" : ""}`}
          >
            {group.steps.map((step, idx) => (
              <StepCard
                key={step.id}
                step={step as Step}
                index={startingFlatIndex + idx}
                isFirst={idx === 0}
                isLast={idx === group.steps.length - 1}
                parentGroupId={group.id}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  )
}
