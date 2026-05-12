import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
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
import { flushSync } from "react-dom"
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
  const [overId, setOverId] = useState<string | null>(null)
  // Last-known container the pointer was hovering over a sortable item
  // in. dnd-kit's `over.data.current.sortable.containerId` is only set
  // when `over` is a sortable item — when the pointer crosses gaps or
  // hits a non-sortable droppable (the group's body zone), it goes
  // undefined, which previously fell back to "top-level" and caused
  // intra-group drags to escape the group. (B2)
  const [activeContainerId, setActiveContainerId] =
    useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    // Seed the tracker with the source container so intra-group drops
    // back into the source still resolve correctly.
    const sourceContainerId =
      (event.active.data.current?.sortable
        ?.containerId as string) ?? "top-level"
    setActiveContainerId(sourceContainerId)
  }

  const handleDragOver = (event: DragOverEvent) => {
    setOverId((event.over?.id as string) ?? null)
    const overContainerId = event.over?.data.current
      ?.sortable?.containerId as string | undefined
    if (overContainerId) {
      setActiveContainerId(overContainerId)
    } else if (
      typeof event.over?.id === "string" &&
      event.over.id.endsWith("-droppable")
    ) {
      // Hovering the group body droppable — treat as targeting that group.
      setActiveContainerId(
        event.over.id.replace(/-droppable$/, ""),
      )
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    setOverId(null)
    const stableContainerId = activeContainerId
    setActiveContainerId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const sourceContainerId =
      (active.data.current?.sortable
        ?.containerId as string) ?? "top-level"
    let targetContainerId =
      (over.data.current?.sortable
        ?.containerId as string) ??
      stableContainerId ??
      "top-level"

    let resolvedOverId = over.id as string
    if (resolvedOverId.endsWith("-droppable")) {
      const groupId = resolvedOverId.replace(
        /-droppable$/,
        "",
      )
      targetContainerId = groupId
      resolvedOverId = ""
    }

    dragReorder({
      activeId: active.id as string,
      overId: resolvedOverId,
      sourceContainerId,
      targetContainerId,
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
          onInsertStep={() =>
            document.startViewTransition(() =>
              flushSync(() =>
                actions.insertStep(itemIndex),
              ),
            )
          }
          onInsertSequentialGroup={() =>
            document.startViewTransition(() =>
              flushSync(() =>
                actions.insertGroup(itemIndex, false),
              ),
            )
          }
          onInsertParallelGroup={() =>
            document.startViewTransition(() =>
              flushSync(() =>
                actions.insertGroup(itemIndex, true),
              ),
            )
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
              isDropTarget={
                overId === item.id ||
                overId === `${item.id}-droppable`
              }
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
            isDropTarget={overId === step.id}
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
      onInsertStep={() =>
        document.startViewTransition(() =>
          flushSync(() => actions.insertStep(steps.length)),
        )
      }
      onInsertSequentialGroup={() =>
        document.startViewTransition(() =>
          flushSync(() =>
            actions.insertGroup(steps.length, false),
          ),
        )
      }
      onInsertParallelGroup={() =>
        document.startViewTransition(() =>
          flushSync(() =>
            actions.insertGroup(steps.length, true),
          ),
        )
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

  const activeGroup = activeId
    ? ((steps.find(
        (item) => isGroup(item) && item.id === activeId,
      ) as Group | undefined) ?? null)
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
          onInsertStep={() =>
            document.startViewTransition(() =>
              flushSync(() => actions.insertStep(0)),
            )
          }
          onInsertSequentialGroup={() =>
            document.startViewTransition(() =>
              flushSync(() =>
                actions.insertGroup(0, false),
              ),
            )
          }
          onInsertParallelGroup={() =>
            document.startViewTransition(() =>
              flushSync(() => actions.insertGroup(0, true)),
            )
          }
          onPaste={handlePaste(0)}
        />
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null)
        setOverId(null)
        setActiveContainerId(null)
      }}
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
        ) : activeGroup ? (
          <div className="opacity-90 rotate-1 shadow-2xl">
            <GroupCard
              group={activeGroup}
              itemIndex={0}
              startingFlatIndex={0}
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
