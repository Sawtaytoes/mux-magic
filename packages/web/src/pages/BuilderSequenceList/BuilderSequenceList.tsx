import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { useAtomValue, useSetAtom } from "jotai"
import { useState } from "react"
import { GroupCard } from "../../components/GroupCard/GroupCard"
import { InsertDivider } from "../../components/InsertDivider/InsertDivider"
import { StepCard } from "../../components/StepCard/StepCard"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import { isGroup } from "../../jobs/sequenceUtils"
import { dragReorderAtom } from "../../state/sequenceAtoms"
import { stepsAtom } from "../../state/stepsAtom"
import type { Group, Step } from "../../types"

export const BuilderSequenceList = () => {
  const steps = useAtomValue(stepsAtom)
  const actions = useBuilderActions()
  const dragReorder = useSetAtom(dragReorderAtom)
  const [activeId, setActiveId] = useState<string | null>(
    null,
  )

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const sourceContainerId =
      (active.data.current?.sortable
        ?.containerId as string) ?? "top-level"
    const overContainerId =
      (over.data.current?.sortable
        ?.containerId as string) ?? "top-level"

    dragReorder({
      activeId: active.id as string,
      overId: over.id as string,
      sourceContainerId,
      targetContainerId: overContainerId,
    })
  }

  const handlePaste =
    (index: number) =>
    (event: React.MouseEvent<HTMLButtonElement>) => {
      actions.pasteCardAt({ itemIndex: index })
      event.stopPropagation()
    }

  const topLevelIds = steps.map((item) =>
    isGroup(item) ? item.id : (item as Step).id,
  )

  const { items } = steps.reduce<{
    items: React.ReactNode[]
    flatIndex: number
  }>(
    (acc, item, itemIndex) => {
      const divider = (
        <InsertDivider
          key={`divider-before-${item.id}`}
          index={itemIndex}
          onInsertStep={() => actions.insertStep(itemIndex)}
          onInsertSequentialGroup={() =>
            actions.insertGroup(itemIndex, false)
          }
          onInsertParallelGroup={() =>
            actions.insertGroup(itemIndex, true)
          }
          onPaste={handlePaste(itemIndex)}
        />
      )

      if (isGroup(item)) {
        return {
          items: [
            ...acc.items,
            divider,
            <GroupCard
              key={item.id}
              group={item}
              itemIndex={itemIndex}
              startingFlatIndex={acc.flatIndex}
              isFirst={itemIndex === 0}
              isLast={itemIndex === steps.length - 1}
            />,
          ],
          flatIndex: acc.flatIndex + item.steps.length,
        }
      }

      const step = item as Step
      return {
        items: [
          ...acc.items,
          divider,
          <StepCard
            key={step.id}
            step={step}
            index={acc.flatIndex}
            isFirst={itemIndex === 0}
            isLast={itemIndex === steps.length - 1}
          />,
        ],
        flatIndex: acc.flatIndex + 1,
      }
    },
    { items: [], flatIndex: 0 },
  )

  const trailingDivider = (
    <InsertDivider
      key="divider-end"
      index={steps.length}
      onInsertStep={() => actions.insertStep(steps.length)}
      onInsertSequentialGroup={() =>
        actions.insertGroup(steps.length, false)
      }
      onInsertParallelGroup={() =>
        actions.insertGroup(steps.length, true)
      }
      onPaste={handlePaste(steps.length)}
    />
  )

  const activeStep = activeId
    ? ((steps.find(
        (item) =>
          !isGroup(item) && (item as Step).id === activeId,
      ) as Step | undefined) ??
      steps
        .filter(isGroup)
        .flatMap((group) => (group as Group).steps)
        .find((step) => step.id === activeId))
    : null

  const activeStepFlatIndex = activeStep
    ? steps
        .filter((item) => !isGroup(item))
        .findIndex(
          (item) => (item as Step).id === activeStep.id,
        )
    : -1

  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-slate-500">
        <p className="text-sm">No steps yet.</p>
        <InsertDivider
          index={0}
          onInsertStep={() => actions.insertStep(0)}
          onInsertSequentialGroup={() =>
            actions.insertGroup(0, false)
          }
          onInsertParallelGroup={() =>
            actions.insertGroup(0, true)
          }
          onPaste={handlePaste(0)}
        />
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        id="top-level"
        items={topLevelIds}
        strategy={verticalListSortingStrategy}
      >
        <div id="steps-el" className="flex flex-col gap-3">
          {items}
          {trailingDivider}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeStep ? (
          <div className="opacity-90 rotate-1 shadow-2xl">
            <StepCard
              step={activeStep}
              index={
                activeStepFlatIndex < 0
                  ? 0
                  : activeStepFlatIndex
              }
              isFirst={false}
              isLast={false}
              isDragOverlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
