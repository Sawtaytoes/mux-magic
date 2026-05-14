import type { CreateJobResponse } from "@mux-magic/server/api-types"
import { useStore } from "jotai"
import { useCallback } from "react"
import { sequenceRunModalAtom } from "../components/SequenceRunModal/sequenceRunModalAtom"
import { isGroup } from "../jobs/sequenceUtils"
import { toYamlStr } from "../jobs/yamlCodec"
import { commandsAtom } from "../state/commandsAtom"
import { dragReorderAtom } from "../state/dragAtoms"
import {
  buildRunFetchUrl,
  dryRunAtom,
  failureModeAtom,
} from "../state/dryRunQuery"
import {
  insertGroupAtom,
  moveGroupAtom,
  removeGroupAtom,
} from "../state/groupAtoms"
import {
  canRedoAtom,
  canUndoAtom,
  redoStackAtom,
  type Snapshot,
  scrollToStepAtom,
  undoStackAtom,
} from "../state/historyAtoms"
import {
  addPathAtom,
  addPathVariableAtom,
  pathsAtom,
  setPathValueAtom,
} from "../state/pathsAtom"
import { runningAtom } from "../state/runAtoms"
import { setAllCollapsedAtom } from "../state/sequenceAtoms"
import {
  changeCommandAtom,
  insertStepAtom,
  moveStepAtom,
  removeStepAtom,
  setLinkAtom,
  setParamAtom,
} from "../state/stepAtoms"
import {
  stepCounterAtom,
  stepsAtom,
} from "../state/stepsAtom"
import { threadCountAtom } from "../state/threadCountAtom"
import type { Group, Step, StepLink } from "../types"
import { findFirstChangedStepId } from "../utils/diffSteps"
import { runWithViewTransition } from "../utils/runWithViewTransition"

const DEFAULT_BASE_PATH = {
  id: "basePath",
  label: "basePath",
  value: "",
  type: "path" as const,
}

const captureSnapshot = (
  store: ReturnType<typeof useStore>,
): Snapshot => ({
  steps: store.get(stepsAtom),
  paths: store.get(pathsAtom),
  stepCounter: store.get(stepCounterAtom),
  threadCount: store.get(threadCountAtom),
})

const applySnapshot = (
  store: ReturnType<typeof useStore>,
  snapshot: Snapshot,
) => {
  store.set(stepsAtom, snapshot.steps)
  store.set(pathsAtom, snapshot.paths)
  store.set(stepCounterAtom, snapshot.stepCounter)
  store.set(threadCountAtom, snapshot.threadCount)
}

export const useBuilderActions = () => {
  const store = useStore()

  const pushHistory = useCallback(() => {
    store.set(undoStackAtom, (prev) => [
      ...prev,
      captureSnapshot(store),
    ])
    store.set(redoStackAtom, [])
    store.set(canUndoAtom, true)
    store.set(canRedoAtom, false)
  }, [store])

  const undo = useCallback(() => {
    const undoStack = store.get(undoStackAtom)
    if (!undoStack.length) return
    const snapshot = undoStack[undoStack.length - 1]
    const currentSnapshot = captureSnapshot(store)
    store.set(undoStackAtom, undoStack.slice(0, -1))
    store.set(redoStackAtom, (prev) => [
      ...prev,
      currentSnapshot,
    ])
    const affectedId = findFirstChangedStepId(
      snapshot.steps,
      currentSnapshot.steps,
    )
    runWithViewTransition(() =>
      applySnapshot(store, snapshot),
    ).then(() => {
      if (affectedId)
        store.set(scrollToStepAtom, affectedId)
    })
    store.set(
      canUndoAtom,
      store.get(undoStackAtom).length > 0,
    )
    store.set(canRedoAtom, true)
  }, [store])

  const redo = useCallback(() => {
    const redoStack = store.get(redoStackAtom)
    if (!redoStack.length) return
    const snapshot = redoStack[redoStack.length - 1]
    const currentSnapshot = captureSnapshot(store)
    store.set(redoStackAtom, redoStack.slice(0, -1))
    store.set(undoStackAtom, (prev) => [
      ...prev,
      currentSnapshot,
    ])
    const affectedId = findFirstChangedStepId(
      snapshot.steps,
      currentSnapshot.steps,
    )
    runWithViewTransition(() =>
      applySnapshot(store, snapshot),
    ).then(() => {
      if (affectedId)
        store.set(scrollToStepAtom, affectedId)
    })
    store.set(
      canRedoAtom,
      store.get(redoStackAtom).length > 0,
    )
    store.set(canUndoAtom, true)
  }, [store])

  const changeCommand = useCallback(
    (stepId: string, commandName: string) => {
      pushHistory()
      store.set(changeCommandAtom, { stepId, commandName })
    },
    [store, pushHistory],
  )

  const setParam = useCallback(
    (stepId: string, fieldName: string, value: unknown) => {
      pushHistory()
      store.set(setParamAtom, { stepId, fieldName, value })
    },
    [store, pushHistory],
  )

  const setLink = useCallback(
    (
      stepId: string,
      fieldName: string,
      value: StepLink | null,
    ) => {
      pushHistory()
      store.set(setLinkAtom, { stepId, fieldName, value })
    },
    [store, pushHistory],
  )

  const insertStep = useCallback(
    (index: number, parentGroupId?: string | null) => {
      pushHistory()
      store.set(insertStepAtom, { index, parentGroupId })
    },
    [store, pushHistory],
  )

  const insertGroup = useCallback(
    (index: number, isParallel: boolean) => {
      pushHistory()
      store.set(insertGroupAtom, { index, isParallel })
    },
    [store, pushHistory],
  )

  const moveStep = useCallback(
    (args: {
      stepId: string
      direction: -1 | 1
      parentGroupId?: string | null
    }) => {
      pushHistory()
      runWithViewTransition(() =>
        store.set(moveStepAtom, args),
      )
    },
    [store, pushHistory],
  )

  const removeStep = useCallback(
    (stepId: string) => {
      pushHistory()
      runWithViewTransition(() =>
        store.set(removeStepAtom, stepId),
      )
    },
    [store, pushHistory],
  )

  const moveGroup = useCallback(
    (args: { groupId: string; direction: -1 | 1 }) => {
      pushHistory()
      runWithViewTransition(() =>
        store.set(moveGroupAtom, args),
      )
    },
    [store, pushHistory],
  )

  const removeGroup = useCallback(
    (groupId: string) => {
      pushHistory()
      runWithViewTransition(() =>
        store.set(removeGroupAtom, groupId),
      )
    },
    [store, pushHistory],
  )

  const reorderDrag = useCallback(
    (args: {
      activeId: string
      overId: string
      sourceContainerId: string
      targetContainerId: string
    }) => {
      pushHistory()
      runWithViewTransition(() =>
        store.set(dragReorderAtom, args),
      )
    },
    [store, pushHistory],
  )

  const addPath = useCallback(() => {
    pushHistory()
    store.set(addPathAtom)
  }, [store, pushHistory])

  const setPathValue = useCallback(
    (pathVariableId: string, value: string) => {
      pushHistory()
      store.set(setPathValueAtom, { pathVariableId, value })
    },
    [store, pushHistory],
  )

  const addPathVariable = useCallback(
    (pathVariableId: string, value: string) => {
      pushHistory()
      store.set(addPathVariableAtom, {
        id: pathVariableId,
        label: pathVariableId,
        value,
      })
    },
    [store, pushHistory],
  )

  const setAllCollapsed = useCallback(
    (isCollapsed: boolean) => {
      store.set(setAllCollapsedAtom, isCollapsed)
    },
    [store],
  )

  const startNew = useCallback(() => {
    pushHistory()
    store.set(stepsAtom, [])
    store.set(pathsAtom, [DEFAULT_BASE_PATH])
    store.set(stepCounterAtom, 0)
    store.set(threadCountAtom, null)
  }, [store, pushHistory])

  const copyYaml = useCallback(async () => {
    const yaml = toYamlStr(
      store.get(stepsAtom),
      store.get(pathsAtom),
      store.get(commandsAtom),
      store.get(threadCountAtom),
    )
    await navigator.clipboard.writeText(yaml)
  }, [store])

  const runViaApi = useCallback(async () => {
    if (store.get(runningAtom)) return
    const yaml = toYamlStr(
      store.get(stepsAtom),
      store.get(pathsAtom),
      store.get(commandsAtom),
      store.get(threadCountAtom),
    )
    store.set(runningAtom, true)
    store.set(sequenceRunModalAtom, {
      mode: "open",
      jobId: null,
      status: "pending",
      logs: [],
      activeChildren: [],
      source: "sequence",
    })
    // Dry-run gate — see packages/web/src/state/dryRunQuery.ts.
    const runUrl = buildRunFetchUrl("/sequences/run", {
      isDryRun: store.get(dryRunAtom),
      isFailureMode: store.get(failureModeAtom),
    })
    try {
      const response = await fetch(runUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yaml }),
      })
      if (!response.ok) {
        store.set(sequenceRunModalAtom, (prev) =>
          prev.mode !== "closed"
            ? { ...prev, status: "failed" }
            : prev,
        )
        store.set(runningAtom, false)
        return
      }
      const data =
        (await response.json()) as CreateJobResponse
      store.set(sequenceRunModalAtom, (prev) =>
        prev.mode !== "closed"
          ? {
              ...prev,
              jobId: data.jobId,
              status: "running",
            }
          : prev,
      )
    } catch {
      store.set(sequenceRunModalAtom, (prev) =>
        prev.mode !== "closed"
          ? { ...prev, status: "failed" }
          : prev,
      )
      store.set(runningAtom, false)
    }
  }, [store])

  const copyStepYaml = useCallback(
    async (stepId: string) => {
      const allItems = store.get(stepsAtom)
      const paths = store.get(pathsAtom)
      const commands = store.get(commandsAtom)

      // Walk top-level steps and group children to find the step.
      const foundStep = allItems.reduce<Step | undefined>(
        (found, item) => {
          if (found) return found
          if (!isGroup(item)) {
            return (item as Step).id === stepId
              ? (item as Step)
              : undefined
          }
          return (item as Group).steps.find(
            (step) => step.id === stepId,
          )
        },
        undefined,
      )

      if (!foundStep) return
      const yaml = toYamlStr([foundStep], paths, commands)
      await navigator.clipboard.writeText(yaml)
    },
    [store],
  )

  const copyGroupYaml = useCallback(
    async (groupId: string) => {
      const allItems = store.get(stepsAtom)
      const paths = store.get(pathsAtom)
      const commands = store.get(commandsAtom)

      const foundGroup = allItems.find(
        (item) => isGroup(item) && item.id === groupId,
      ) as Group | undefined

      if (!foundGroup) return
      const yaml = toYamlStr([foundGroup], paths, commands)
      await navigator.clipboard.writeText(yaml)
    },
    [store],
  )

  const pasteCardAt = useCallback(
    async (args: {
      itemIndex?: number
      parentGroupId?: string
    }) => {
      const text = await navigator.clipboard.readText()
      if (!text) return

      const { loadYamlFromText } = await import(
        "../jobs/yamlCodec"
      )
      const commands = store.get(commandsAtom)
      const currentPaths = store.get(pathsAtom)
      const currentCounter = store.get(stepCounterAtom)

      const existingIds = new Set<string>()
      for (const item of store.get(stepsAtom)) {
        if (isGroup(item)) {
          existingIds.add(item.id)
          for (const step of item.steps)
            existingIds.add(step.id)
        } else {
          existingIds.add(item.id)
        }
      }

      let result: ReturnType<typeof loadYamlFromText>
      try {
        result = loadYamlFromText(
          text,
          commands,
          currentPaths,
          currentCounter,
          existingIds,
        )
      } catch {
        // Clipboard content is not valid YAML — silently ignore.
        return
      }

      // Capture which IDs will be newly inserted (mirrors applyPaste's splice
      // logic) so we can animate them in after the view transition finishes.
      const newItemIds: Array<{
        type: "step" | "group"
        id: string
      }> = args.parentGroupId
        ? result.steps.flatMap((item) =>
            isGroup(item)
              ? (item as Group).steps.map((childStep) => ({
                  type: "step" as const,
                  id: childStep.id,
                }))
              : [
                  {
                    type: "step" as const,
                    id: (item as Step).id,
                  },
                ],
          )
        : result.steps.map((item) =>
            isGroup(item)
              ? {
                  type: "group" as const,
                  id: (item as Group).id,
                }
              : {
                  type: "step" as const,
                  id: (item as Step).id,
                },
          )

      // For group paste with no explicit position, append to the group's
      // own steps (not the top-level array). For top-level paste with no
      // explicit position, append at the end of the top-level array.
      const applyPaste = () => {
        pushHistory()
        store.set(stepsAtom, (items) => {
          if (args.parentGroupId) {
            const flatSteps = result.steps.flatMap(
              (item) =>
                isGroup(item)
                  ? (item as Group).steps
                  : [item as Step],
            )
            return items.map((item) => {
              if (
                !isGroup(item) ||
                item.id !== args.parentGroupId
              ) {
                return item
              }
              const innerSteps = [...item.steps]
              const insertIndex =
                args.itemIndex ?? innerSteps.length
              innerSteps.splice(
                insertIndex,
                0,
                ...flatSteps,
              )
              return { ...item, steps: innerSteps }
            })
          }
          const updated = [...items]
          const insertIndex =
            args.itemIndex ?? updated.length
          updated.splice(insertIndex, 0, ...result.steps)
          return updated
        })
        store.set(stepCounterAtom, result.stepCounter)
      }

      // Inject a scoped <style> that overrides the default crossfade on
      // ::view-transition-new pseudo-elements for each incoming card so
      // they use stepEnter (slide from above + fade) instead. This runs
      // inside the same transition as the surrounding cards shifting down,
      // so all animations are synchronised rather than sequential.
      // The style is removed once the transition finishes.
      if (newItemIds.length > 0) {
        const styleEl = document.createElement("style")
        const selectors = newItemIds
          .map(
            ({ type, id }) =>
              `::view-transition-new(${type === "group" ? `group-${id}` : `step-${id}`})`,
          )
          .join(",")
        styleEl.textContent = `${selectors}{animation:stepEnter 220ms ease-out;}`
        document.head.appendChild(styleEl)
        runWithViewTransition(applyPaste).finally(() => {
          styleEl.remove()
        })
      } else {
        runWithViewTransition(applyPaste)
      }
    },
    [store, pushHistory],
  )

  const runGroup = useCallback(
    async (groupId: string) => {
      if (store.get(runningAtom)) return

      const allItems = store.get(stepsAtom)
      const paths = store.get(pathsAtom)
      const commands = store.get(commandsAtom)

      const foundGroup = allItems.find(
        (item) => isGroup(item) && item.id === groupId,
      ) as Group | undefined

      if (!foundGroup) return

      const yaml = toYamlStr(
        [foundGroup],
        paths,
        commands,
        store.get(threadCountAtom),
      )
      store.set(runningAtom, true)
      store.set(sequenceRunModalAtom, {
        mode: "open",
        jobId: null,
        status: "pending",
        logs: [],
        activeChildren: [],
        source: "sequence",
      })

      // Dry-run gate — see packages/web/src/state/dryRunQuery.ts.
      const runUrl = buildRunFetchUrl("/sequences/run", {
        isDryRun: store.get(dryRunAtom),
        isFailureMode: store.get(failureModeAtom),
      })

      try {
        const response = await fetch(runUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ yaml }),
        })
        if (!response.ok) {
          store.set(sequenceRunModalAtom, (prev) =>
            prev.mode !== "closed"
              ? { ...prev, status: "failed" }
              : prev,
          )
          store.set(runningAtom, false)
          return
        }
        const data = (await response.json()) as {
          jobId: string
        }
        store.set(sequenceRunModalAtom, (prev) =>
          prev.mode !== "closed"
            ? {
                ...prev,
                jobId: data.jobId,
                status: "running",
              }
            : prev,
        )
      } catch {
        store.set(sequenceRunModalAtom, (prev) =>
          prev.mode !== "closed"
            ? { ...prev, status: "failed" }
            : prev,
        )
        store.set(runningAtom, false)
      }
    },
    [store],
  )

  return {
    addPath,
    addPathVariable,
    changeCommand,
    copyGroupYaml,
    copyStepYaml,
    copyYaml,
    insertGroup,
    insertStep,
    moveGroup,
    moveStep,
    pasteCardAt,
    redo,
    removeGroup,
    removeStep,
    reorderDrag,
    runGroup,
    runViaApi,
    setAllCollapsed,
    setLink,
    setParam,
    setPathValue,
    startNew,
    undo,
  }
}
