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
  scrollSeqAtom,
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
import { stepsAtom } from "../state/stepsAtom"
import { variablesAtom } from "../state/variablesAtom"
import type { Group, Step, StepLink } from "../types"
import { findFirstChangedStepId } from "../utils/diffSteps"
import { runWithViewTransition } from "../utils/runWithViewTransition"

const DEFAULT_BASE_PATH = {
  id: "basePath",
  label: "basePath",
  value: "",
  type: "path" as const,
}

// History snapshots cover every variable type (path, dvdCompareId, threadCount,
// future types) by snapshotting variablesAtom directly — reading pathsAtom would
// silently drop non-path types.
const captureSnapshot = (
  store: ReturnType<typeof useStore>,
): Snapshot => ({
  steps: store.get(stepsAtom),
  paths: store.get(variablesAtom),
})

const applySnapshot = (
  store: ReturnType<typeof useStore>,
  snapshot: Snapshot,
) => {
  store.set(stepsAtom, snapshot.steps)
  store.set(variablesAtom, snapshot.paths)
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
      const newId = store.set(insertStepAtom, {
        index,
        parentGroupId,
      })
      if (newId) store.set(scrollToStepAtom, newId)
    },
    [store, pushHistory],
  )

  const insertGroup = useCallback(
    (index: number, isParallel: boolean) => {
      pushHistory()
      const newId = store.set(insertGroupAtom, {
        index,
        isParallel,
      })
      if (newId) store.set(scrollToStepAtom, newId)
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
  }, [store, pushHistory])

  const copyYaml = useCallback(async () => {
    const yaml = toYamlStr(
      store.get(stepsAtom),
      // All variables (path + dvdCompareId + threadCount + future types);
      // pathsAtom would silently drop non-path types from the emitted YAML.
      store.get(variablesAtom),
      store.get(commandsAtom),
    )
    await navigator.clipboard.writeText(yaml)
  }, [store])

  const runViaApi = useCallback(async () => {
    if (store.get(runningAtom)) return
    const yaml = toYamlStr(
      store.get(stepsAtom),
      store.get(variablesAtom),
      store.get(commandsAtom),
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
      // All variable types; see copyYaml above for the rationale.
      const paths = store.get(variablesAtom)
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
      const paths = store.get(variablesAtom)
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
      }

      // Inject a scoped <style> that overrides the default crossfade on
      // ::view-transition-new pseudo-elements for each incoming card so
      // they use stepEnter (slide from above + fade) instead. This runs
      // inside the same transition as the surrounding cards shifting down,
      // so all animations are synchronised rather than sequential.
      // The style is removed once the transition finishes.
      // The first newly-rendered step we can scroll to. For top-level
      // group paste the entry id is the group itself, which has no
      // `#step-<id>` element — descend into the group's first child.
      const firstNewStepId: string | null = (() => {
        for (const item of result.steps) {
          if (isGroup(item)) {
            const inner = (item as Group).steps[0]
            if (inner) return inner.id
          } else {
            return (item as Step).id
          }
        }
        return null
      })()

      // Capture the seq before the view transition so we can detect
      // a more recent scroll-targeting action (insert, undo/redo,
      // another paste) and skip our delayed scroll if so. Otherwise
      // the user-visible viewport jumps back to the pasted item once
      // the transition resolves, overriding the more recent intent.
      const startScrollSeq = store.get(scrollSeqAtom)

      let transition: Promise<void>
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
        transition = runWithViewTransition(
          applyPaste,
        ).finally(() => {
          styleEl.remove()
        })
      } else {
        transition = runWithViewTransition(applyPaste)
      }

      if (firstNewStepId) {
        transition.then(() => {
          if (store.get(scrollSeqAtom) !== startScrollSeq) {
            // Another scroll-targeting action ran while the paste
            // transition was animating — its target is what the user
            // expects to see, so don't override it.
            return
          }
          store.set(scrollToStepAtom, firstNewStepId)
        })
      }
    },
    [store, pushHistory],
  )

  const runGroup = useCallback(
    async (groupId: string) => {
      if (store.get(runningAtom)) return

      const allItems = store.get(stepsAtom)
      const paths = store.get(variablesAtom)
      const commands = store.get(commandsAtom)

      const foundGroup = allItems.find(
        (item) => isGroup(item) && item.id === groupId,
      ) as Group | undefined

      if (!foundGroup) return

      const yaml = toYamlStr([foundGroup], paths, commands)
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
