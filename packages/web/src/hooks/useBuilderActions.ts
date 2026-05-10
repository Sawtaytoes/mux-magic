import { useStore } from "jotai"
import { useCallback } from "react"
import { toYamlStr } from "../components/yamlSerializer"
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
import { commandsAtom } from "../state/commandsAtom"
import { stepCounterAtom, stepsAtom } from "../state/stepsAtom"
import {
  apiRunModalAtom,
  runningAtom,
} from "../state/uiAtoms"
import type { StepLink } from "../types"

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
    "../components/loadYaml"
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
    )
    const snapshot = undoStack[undoStack.length - 1]
    store.set(undoStackAtom, undoStack.slice(0, -1))
    store.set(redoStackAtom, (prev) => [...prev, current])
    await applySnapshot(store, snapshot)
    store.set(canUndoAtom, store.get(undoStackAtom).length > 0)
    store.set(canRedoAtom, true)
  }, [store])

  const redo = useCallback(async () => {
    const redoStack = store.get(redoStackAtom)
    if (!redoStack.length) return
    const current = toYamlStr(
      store.get(stepsAtom),
      store.get(pathsAtom),
    )
    const snapshot = redoStack[redoStack.length - 1]
    store.set(redoStackAtom, redoStack.slice(0, -1))
    store.set(undoStackAtom, (prev) => [...prev, current])
    await applySnapshot(store, snapshot)
    store.set(canRedoAtom, store.get(redoStackAtom).length > 0)
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
    )
    await navigator.clipboard.writeText(yaml)
  }, [store])

  const runViaApi = useCallback(async () => {
    if (store.get(runningAtom)) return
    const yaml = toYamlStr(
      store.get(stepsAtom),
      store.get(pathsAtom),
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
        headers: { "Content-Type": "application/yaml" },
        body: yaml,
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
          ? { ...prev, jobId: data.jobId, status: "running" }
          : prev,
      )
    } catch {
      store.set(apiRunModalAtom, (prev) =>
        prev ? { ...prev, status: "failed" } : prev,
      )
      store.set(runningAtom, false)
    }
  }, [store])

  return {
    addPath,
    changeCommand,
    copyYaml,
    insertGroup,
    insertStep,
    redo,
    runViaApi,
    setAllCollapsed,
    setLink,
    setParam,
    startNew,
    undo,
  }
}