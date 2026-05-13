import { atom } from "jotai"
import { isGroup } from "../jobs/sequenceUtils"
import type { Group, SequenceItem, Step } from "../types"
import { stepsAtom } from "./stepsAtom"

// ─── Drag-and-drop reorder (dnd-kit) ─────────────────────────────────────────
// Called from BuilderSequenceList.onDragEnd.
// sourceContainerId / targetContainerId are the SortableContext `id` values:
//   "top-level" for the root list, or a group.id for intra-group lists.

const getItemId = (item: SequenceItem): string =>
  isGroup(item) ? item.id : (item as Step).id

export const dragReorderAtom = atom(
  null,
  (
    _get,
    set,
    args: {
      activeId: string
      overId: string
      sourceContainerId: string
      targetContainerId: string
    },
  ) => {
    const {
      activeId,
      overId,
      sourceContainerId,
      targetContainerId,
    } = args
    if (activeId === overId) return

    set(stepsAtom, (items) => {
      // ── Same container ────────────────────────────────────
      if (sourceContainerId === targetContainerId) {
        if (sourceContainerId === "top-level") {
          const oldIndex = items.findIndex(
            (item) => getItemId(item) === activeId,
          )
          const newIndex = items.findIndex(
            (item) => getItemId(item) === overId,
          )
          if (
            oldIndex < 0 ||
            newIndex < 0 ||
            oldIndex === newIndex
          )
            return items
          const reordered = [...items]
          const [moved] = reordered.splice(oldIndex, 1)
          if (!moved) return items
          // Spread to produce a fresh reference so identity-sensitive
          // subscribers (e.g. setAllCollapsedAtom) see the change (B13)
          reordered.splice(newIndex, 0, { ...moved })
          return reordered
        }
        return items.map((item) => {
          if (
            !isGroup(item) ||
            item.id !== sourceContainerId
          )
            return item
          const groupSteps = [...item.steps]
          const oldIndex = groupSteps.findIndex(
            (step) => step.id === activeId,
          )
          // B2: overId="" means drop landed on the group droppable zone
          // (not any specific step) — resolve to last position
          const newIndex =
            overId === ""
              ? groupSteps.length - 1
              : groupSteps.findIndex(
                  (step) => step.id === overId,
                )
          if (
            oldIndex < 0 ||
            newIndex < 0 ||
            oldIndex === newIndex
          )
            return item
          const [moved] = groupSteps.splice(oldIndex, 1)
          if (!moved) return item
          // Spread for fresh reference (B13)
          groupSteps.splice(newIndex, 0, { ...moved })
          return { ...item, steps: groupSteps }
        })
      }

      // ── Cross-container ───────────────────────────────────
      // Groups cannot be dragged into a group body.
      const isActiveGroup = items.some(
        (item) => isGroup(item) && item.id === activeId,
      )
      if (
        isActiveGroup &&
        targetContainerId !== "top-level"
      )
        return items

      const cloned: SequenceItem[] = items.map((item) =>
        isGroup(item)
          ? { ...item, steps: [...item.steps] }
          : item,
      )

      const findGroup = (
        groupId: string,
      ): Group | undefined =>
        cloned.find(
          (item) => isGroup(item) && item.id === groupId,
        ) as Group | undefined

      if (sourceContainerId === "top-level") {
        const sourceIndex = cloned.findIndex(
          (item) => getItemId(item) === activeId,
        )
        if (sourceIndex < 0) return items
        const [movedItem] = cloned.splice(sourceIndex, 1)
        if (!movedItem) return items
        const targetGroup = findGroup(targetContainerId)
        if (!targetGroup) return items
        const overIndex = targetGroup.steps.findIndex(
          (step) => step.id === overId,
        )
        const insertAt =
          overIndex < 0
            ? targetGroup.steps.length
            : overIndex
        targetGroup.steps.splice(
          insertAt,
          0,
          movedItem as Step,
        )
      } else {
        const sourceGroup = findGroup(sourceContainerId)
        if (!sourceGroup) return items
        const sourceIndex = sourceGroup.steps.findIndex(
          (step) => step.id === activeId,
        )
        if (sourceIndex < 0) return items
        const [movedStep] = sourceGroup.steps.splice(
          sourceIndex,
          1,
        )
        if (!movedStep) return items
        if (targetContainerId === "top-level") {
          const overIndex = cloned.findIndex(
            (item) => getItemId(item) === overId,
          )
          const insertAt =
            overIndex < 0 ? cloned.length : overIndex
          cloned.splice(insertAt, 0, movedStep)
        } else {
          const targetGroup = findGroup(targetContainerId)
          if (!targetGroup) return items
          const overIndex = targetGroup.steps.findIndex(
            (step) => step.id === overId,
          )
          const insertAt =
            overIndex < 0
              ? targetGroup.steps.length
              : overIndex
          targetGroup.steps.splice(insertAt, 0, movedStep)
        }
      }

      return cloned.filter(
        (item) => !isGroup(item) || item.steps.length > 0,
      )
    })
  },
)
