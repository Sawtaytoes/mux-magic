import { useStore } from "jotai"
import { useCallback } from "react"
import { isGroup } from "../jobs/sequenceUtils"
import { toYamlStr } from "../jobs/yamlSerializer"
import { commandsAtom } from "../state/commandsAtom"
import {
  canRedoAtom,
  canUndoAtom,
  redoStackAtom,
  undoStackAtom,
} from "../state/historyAtoms"
import { pathsAtom } from "../state/pathsAtom"
import {
  addPathAtom,
  changeCommandAtom,
  insertGroupAtom,
  insertStepAtom,
  setAllCollapsedAtom,
  setLinkAtom,
  setParamAtom,
} from "../state/sequenceAtoms"
import {
  stepCounterAtom,
  stepsAtom,
} from "../state/stepsAtom"
import {
  apiRunModalAtom,
  runningAtom,
} from "../state/uiAtoms"
import type { Group, Step, StepLink } from "../types"

const DEFAULT_BASE_PATH = {
  id: "basePath",
  label: "basePath",
  value: "",
}

const applySnapshot = async (
  store: ReturnType<typeof useStore>,
  snapshot: string,
) => {
  const { loadYamlFromText } = await import(
    "../jobs/loadYaml"
  )
  const commands = store.get(commandsAtom)
  const currentPaths = store.get(pathsAtom)
  const currentCounter = store.get(stepCounterAtom)
  try {
    const result = loadYamlFromText(
      snapshot,
      commands,
      currentPaths,
      currentCounter,
    )
    store.set(stepsAtom, result.steps)
    store.set(pathsAtom, result.paths)
    store.set(stepCounterAtom, result.stepCounter)
  } catch {
    // Snapshot unreadable — silently skip to avoid corrupting state.
  }
}

export const useBuilderActions = () => {
  const store = useStore()

  const pushHistory = useCallback(() => {
    const snapshot = toYamlStr(
      store.get(stepsAtom),
      store.get(pathsAtom),
      store.get(commandsAtom),
    )
    store.set(undoStackAtom, (prev) => [...prev, snapshot])
    store.set(redoStackAtom, [])
    store.set(canUndoAtom, true)
    store.set(canRedoAtom, false)
  }, [store])

  const undo = useCallback(async () => {
    const undoStack = store.get(undoStackAtom)
    if (!undoStack.length) return
    const current = toYamlStr(
      store.get(stepsAtom),
      store.get(pathsAtom),
      store.get(commandsAtom),
    )
    const snapshot = undoStack[undoStack.length - 1]
    store.set(undoStackAtom, undoStack.slice(0, -1))
    store.set(redoStackAtom, (prev) => [...prev, current])
    await applySnapshot(store, snapshot)
    store.set(
      canUndoAtom,
      store.get(undoStackAtom).length > 0,
    )
    store.set(canRedoAtom, true)
  }, [store])

  const redo = useCallback(async () => {
    const redoStack = store.get(redoStackAtom)
    if (!redoStack.length) return
    const current = toYamlStr(
      store.get(stepsAtom),
      store.get(pathsAtom),
      store.get(commandsAtom),
    )
    const snapshot = redoStack[redoStack.length - 1]
    store.set(redoStackAtom, redoStack.slice(0, -1))
    store.set(undoStackAtom, (prev) => [...prev, current])
    await applySnapshot(store, snapshot)
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

  const addPath = useCallback(() => {
    pushHistory()
    store.set(addPathAtom)
  }, [store, pushHistory])

  const setAllCollapsed = useCallback(
    (collapsed: boolean) => {
      store.set(setAllCollapsedAtom, collapsed)
    },
    [store],
  )

  const startNew = useCallback(() => {
    pushHistory()
    store.set(stepsAtom, [])
    store.set(pathsAtom, [DEFAULT_BASE_PATH])
    store.set(stepCounterAtom, 0)
  }, [store, pushHistory])

  const copyYaml = useCallback(async () => {
    const yaml = toYamlStr(
      store.get(stepsAtom),
      store.get(pathsAtom),
      store.get(commandsAtom),
    )
    await navigator.clipboard.writeText(yaml)
  }, [store])

  const runViaApi = useCallback(async () => {
    if (store.get(runningAtom)) return
    const yaml = toYamlStr(
      store.get(stepsAtom),
      store.get(pathsAtom),
      store.get(commandsAtom),
    )
    store.set(runningAtom, true)
    store.set(apiRunModalAtom, {
      jobId: null,
      status: "pending",
      logs: [],
      childJobId: null,
      childStepId: null,
    })
    try {
      const response = await fetch("/sequences/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yaml }),
      })
      if (!response.ok) {
        store.set(apiRunModalAtom, (prev) =>
          prev ? { ...prev, status: "failed" } : prev,
        )
        store.set(runningAtom, false)
        return
      }
      const data = (await response.json()) as {
        jobId: string
      }
      store.set(apiRunModalAtom, (prev) =>
        prev
          ? {
              ...prev,
              jobId: data.jobId,
              status: "running",
            }
          : prev,
      )
    } catch {
      store.set(apiRunModalAtom, (prev) =>
        prev ? { ...prev, status: "failed" } : prev,
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
        "../jobs/loadYaml"
      )
      const commands = store.get(commandsAtom)
      const currentPaths = store.get(pathsAtom)
      const currentCounter = store.get(stepCounterAtom)

      try {
        const result = loadYamlFromText(
          text,
          commands,
          currentPaths,
          currentCounter,
        )
        pushHistory()
        const insertIndex =
          args.itemIndex ?? store.get(stepsAtom).length

        store.set(stepsAtom, (items) => {
          if (args.parentGroupId) {
            // Pasting into a group: flatten any groups in the clipboard
            // result into their inner steps so nesting is avoided.
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
              )
                return item
              const steps = [...item.steps]
              steps.splice(insertIndex, 0, ...flatSteps)
              return { ...item, steps }
            })
          }
          const updated = [...items]
          updated.splice(insertIndex, 0, ...result.steps)
          return updated
        })
        store.set(stepCounterAtom, result.stepCounter)
      } catch {
        // Clipboard content is not valid YAML — silently ignore.
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

      const yaml = toYamlStr([foundGroup], paths, commands)
      store.set(runningAtom, true)
      store.set(apiRunModalAtom, {
        jobId: null,
        status: "pending",
        logs: [],
        childJobId: null,
        childStepId: null,
      })

      try {
        const response = await fetch("/sequences/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ yaml }),
        })
        if (!response.ok) {
          store.set(apiRunModalAtom, (prev) =>
            prev ? { ...prev, status: "failed" } : prev,
          )
          store.set(runningAtom, false)
          return
        }
        const data = (await response.json()) as {
          jobId: string
        }
        store.set(apiRunModalAtom, (prev) =>
          prev
            ? {
                ...prev,
                jobId: data.jobId,
                status: "running",
              }
            : prev,
        )
      } catch {
        store.set(apiRunModalAtom, (prev) =>
          prev ? { ...prev, status: "failed" } : prev,
        )
        store.set(runningAtom, false)
      }
    },
    [store],
  )

  return {
    addPath,
    changeCommand,
    copyGroupYaml,
    copyStepYaml,
    copyYaml,
    insertGroup,
    insertStep,
    pasteCardAt,
    redo,
    runGroup,
    runViaApi,
    setAllCollapsed,
    setLink,
    setParam,
    startNew,
    undo,
  }
}
