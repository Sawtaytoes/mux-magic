import { useAtom } from "jotai"
import { useEffect, useRef } from "react"
import { stepsAtom } from "../state/stepsAtom"
import type { Group, SequenceItem, Step } from "../types"

// SortableJS is loaded as a vendor script in index.html.
declare global {
  interface Window {
    Sortable?: {
      new (
        el: HTMLElement,
        options: Record<string, unknown>,
      ): { destroy: () => void }
      get: (
        el: HTMLElement,
      ) => { destroy: () => void } | undefined
    }
  }
}

const isGroup = (item: SequenceItem): item is Group =>
  "kind" in item && item.kind === "group"

export const useDragAndDrop = (
  containerRef: React.RefObject<HTMLElement | null>,
) => {
  const [steps, setSteps] = useAtom(stepsAtom)
  const isProcessingRef = useRef(false)

  useEffect(() => {
    const Sortable = window.Sortable
    if (!Sortable || !containerRef.current) return

    const getStepsArrayFor = (
      el: HTMLElement,
    ):
      | { kind: "top"; steps: SequenceItem[] }
      | { kind: "group"; steps: Step[]; group: Group }
      | null => {
      if (el.id === "steps-el") {
        return { kind: "top", steps }
      }
      const groupId = el.dataset.groupBody
      if (groupId) {
        const group = steps.find(
          (item) => isGroup(item) && item.id === groupId,
        ) as Group | undefined
        if (group)
          return {
            kind: "group",
            steps: group.steps,
            group,
          }
      }
      return null
    }

    const onMove = (event: {
      dragged: HTMLElement
      to: HTMLElement
    }) => {
      const draggedIsGroup =
        event.dragged?.dataset?.group !== undefined
      const targetIsGroupBody = event.to?.matches?.(
        "[data-group-body]",
      )
      if (draggedIsGroup && targetIsGroupBody) return false
      return true
    }

    const onEnd = (event: {
      from: HTMLElement
      to: HTMLElement
      oldDraggableIndex: number | undefined
      newDraggableIndex: number | undefined
    }) => {
      if (isProcessingRef.current) return
      isProcessingRef.current = true

      const sourceInfo = getStepsArrayFor(event.from)
      const targetInfo = getStepsArrayFor(event.to)
      if (!sourceInfo || !targetInfo) {
        window.requestAnimationFrame(() => {
          isProcessingRef.current = false
        })
        return
      }

      const oldIndex = event.oldDraggableIndex
      const newIndex = event.newDraggableIndex
      if (
        oldIndex === undefined ||
        newIndex === undefined
      ) {
        window.requestAnimationFrame(() => {
          isProcessingRef.current = false
        })
        return
      }

      setSteps((currentSteps) => {
        if (
          sourceInfo.kind === "top" &&
          targetInfo.kind === "top"
        ) {
          if (oldIndex === newIndex) {
            isProcessingRef.current = false
            return currentSteps
          }
          const arr = [...currentSteps]
          const [moved] = arr.splice(oldIndex, 1)
          if (!moved) return currentSteps
          arr.splice(newIndex, 0, moved)
          return arr
        }

        // Cross-container or group-to-group moves need deep cloning.
        const cloned = currentSteps.map((item) =>
          isGroup(item)
            ? { ...item, steps: [...item.steps] }
            : item,
        )

        const sourceArray =
          sourceInfo.kind === "top"
            ? cloned
            : (
                cloned.find(
                  (item) =>
                    isGroup(item) &&
                    item.id === sourceInfo.group.id,
                ) as Group
              )?.steps

        const targetArray =
          targetInfo.kind === "top"
            ? cloned
            : (
                cloned.find(
                  (item) =>
                    isGroup(item) &&
                    item.id === targetInfo.group.id,
                ) as Group
              )?.steps

        if (!sourceArray || !targetArray)
          return currentSteps

        const [movedItem] = sourceArray.splice(oldIndex, 1)
        if (!movedItem) return currentSteps
        targetArray.splice(newIndex, 0, movedItem)

        // Drop empty groups — matches legacy behaviour.
        return cloned.filter(
          (item) => !isGroup(item) || item.steps.length > 0,
        )
      })

      window.requestAnimationFrame(() => {
        isProcessingRef.current = false
      })
    }

    const options = {
      group: { name: "sequence", pull: true, put: true },
      handle: "[data-drag-handle]",
      draggable: "[data-sortable-item]",
      animation: 0, // prevents race on fast double-drags (see drag-and-drop.js)
      ghostClass: "drag-ghost",
      chosenClass: "drag-chosen",
      fallbackOnBody: true,
      forceFallback: false,
      onMove,
      onEnd,
    }

    const containers = [
      containerRef.current,
      ...Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(
          "[data-group-body]",
        ),
      ),
    ]

    const instances = containers.map((container) => {
      const existing = Sortable.get?.(container)
      existing?.destroy()
      return new Sortable(container, options)
    })

    return () => {
      instances.forEach((instance) => {
        instance.destroy()
      })
    }
  }, [steps, containerRef, setSteps])
}
