import { getDefaultStore } from "jotai"
import { toYamlStr } from "../components/yamlSerializer"
import { commandLabel } from "../jobs/commandLabels"
import type { Commands, Group, SequenceItem, Step } from "../types"
import {
  canRedoAtom,
  canUndoAtom,
  redoStackAtom,
  undoStackAtom,
} from "./historyAtoms"
import { pathsAtom } from "./pathsAtom"
import {
  addPathAtom,
  changeCommandAtom,
  insertGroupAtom,
  insertStepAtom,
  setAllCollapsedAtom,
  setLinkAtom,
  setParamAtom,
} from "./sequenceAtoms"
import { stepCounterAtom, stepsAtom } from "./stepsAtom"
import { apiRunModalAtom, runningAtom } from "./uiAtoms"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isGroup = (item: SequenceItem): item is Group =>
  "kind" in item && item.kind === "group"

const findStep = (
  steps: SequenceItem[],
  stepId: string,
): Step | undefined => {
  for (const item of steps) {
    if (!isGroup(item)) {
      if ((item as Step).id === stepId) return item as Step
    } else {
      const found = item.steps.find((s) => s.id === stepId)
      if (found) return found
    }
  }
  return undefined
}

// ─── Commands loading ─────────────────────────────────────────────────────────

export const loadBuilderCommands = async (): Promise<void> => {
  try {
    // URL-based dynamic import of the static public asset at /builder/js/commands.js.
    // new Function bypasses TypeScript's static module resolver (public/ is
    // outside the TS project) while keeping runtime behaviour identical.
    // biome-ignore lint/security/noGlobalEval: intentional dynamic URL import of public asset
    const mod = await new Function(
      "u",
      "return import(u)",
    )("/builder/js/commands.js") as { COMMANDS: Commands }
    window.mediaTools.COMMANDS = mod.COMMANDS
  } catch {
    // Server not running or commands.js not available (e.g. in tests).
  }
}

// ─── History helpers ──────────────────────────────────────────────────────────

const syncButtons = (store: ReturnType<typeof getDefaultStore>) => {
  const canUndo = store.get(undoStackAtom).length > 0
  const canRedo = store.get(redoStackAtom).length > 0
  store.set(canUndoAtom, canUndo)
  store.set(canRedoAtom, canRedo)
}

const pushHistory = (store: ReturnType<typeof getDefaultStore>) => {
  const steps = store.get(stepsAtom)
  const paths = store.get(pathsAtom)
  const snapshot = toYamlStr(steps, paths)
  store.set(undoStackAtom, (prev) => [...prev, snapshot])
  store.set(redoStackAtom, [])
  syncButtons(store)
}

const applySnapshot = async (
  store: ReturnType<typeof getDefaultStore>,
  snapshot: string,
) => {
  // Inline YAML parsing to avoid a circular dep on loadYaml (which needs
  // COMMANDS). For undo/redo the snapshot was produced by toYamlStr, so the
  // format is always canonical. Use the lazy-loaded COMMANDS if available.
  const { loadYamlFromText } = await import(
    "../components/loadYaml"
  )
  const commands =
    (window.mediaTools?.COMMANDS as Commands | undefined) ?? {}
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

// ─── initBuilderBridge ────────────────────────────────────────────────────────
// Call once (from bridge.ts initBridge) to wire all builder-specific bridge
// functions into window.mediaTools. Safe to call when the legacy builder HTML
// is loaded too — the functions simply become no-ops if the React builder page
// never mounts.

export const initBuilderBridge = () => {
  const store = getDefaultStore()

  // ── Command metadata ────────────────────────────────────────────────────────

  window.commandLabel = (name: string) => commandLabel(name)
  window.mediaTools.commandLabel = window.commandLabel

  // findStepById — used by CommandPicker to pre-select the current command.
  window.mediaTools.findStepById = (stepId: string) =>
    findStep(store.get(stepsAtom), stepId)

  // ── Param / link mutations (called by field components and pickers) ─────────

  window.changeCommand = (stepId: string, commandName: string) => {
    pushHistory(store)
    store.set(changeCommandAtom, { stepId, commandName })
  }

  window.setParam = (
    stepId: string,
    fieldName: string,
    value: unknown,
  ) => {
    pushHistory(store)
    store.set(setParamAtom, { stepId, fieldName, value })
  }

  window.setParamAndRender = window.setParam

  window.setLink = (
    stepId: string,
    fieldName: string,
    value: string,
  ) => {
    pushHistory(store)
    store.set(setLinkAtom, { stepId, fieldName, value })
  }

  // ── Sequence-level actions (called by PageHeader via callBridge) ────────────

  window.mediaTools.startNewSequence = () => {
    pushHistory(store)
    store.set(stepsAtom, [])
    store.set(pathsAtom, [
      { id: "basePath", label: "basePath", value: "" },
    ])
    store.set(stepCounterAtom, 0)
    syncButtons(store)
  }

  window.mediaTools.setAllCollapsed = (collapsed: boolean) => {
    store.set(setAllCollapsedAtom, collapsed)
  }

  window.mediaTools.addPath = () => {
    pushHistory(store)
    store.set(addPathAtom)
  }

  window.mediaTools.copyYaml = async () => {
    const steps = store.get(stepsAtom)
    const paths = store.get(pathsAtom)
    const yaml = toYamlStr(steps, paths)
    await navigator.clipboard.writeText(yaml)
  }

  // ── Undo / redo ─────────────────────────────────────────────────────────────

  window.mediaTools.undo = () => {
    const undoStack = store.get(undoStackAtom)
    if (!undoStack.length) return
    const current = toYamlStr(
      store.get(stepsAtom),
      store.get(pathsAtom),
    )
    const snapshot = undoStack[undoStack.length - 1]
    store.set(undoStackAtom, undoStack.slice(0, -1))
    store.set(redoStackAtom, (prev) => [...prev, current])
    applySnapshot(store, snapshot).then(() => syncButtons(store))
  }

  window.mediaTools.redo = () => {
    const redoStack = store.get(redoStackAtom)
    if (!redoStack.length) return
    const current = toYamlStr(
      store.get(stepsAtom),
      store.get(pathsAtom),
    )
    const snapshot = redoStack[redoStack.length - 1]
    store.set(redoStackAtom, redoStack.slice(0, -1))
    store.set(undoStackAtom, (prev) => [...prev, current])
    applySnapshot(store, snapshot).then(() => syncButtons(store))
  }

  // ── Run sequence ────────────────────────────────────────────────────────────

  const runViaApi = async () => {
    if (store.get(runningAtom)) return
    const steps = store.get(stepsAtom)
    const paths = store.get(pathsAtom)
    const yaml = toYamlStr(steps, paths)

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
      const data = (await response.json()) as { jobId: string }
      store.set(apiRunModalAtom, (prev) =>
        prev ? { ...prev, jobId: data.jobId, status: "running" } : prev,
      )
    } catch {
      store.set(apiRunModalAtom, (prev) =>
        prev ? { ...prev, status: "failed" } : prev,
      )
      store.set(runningAtom, false)
    }
  }

  window.mediaTools.runSequence = runViaApi
  window.mediaTools.runViaApi = runViaApi

  // ── Insert helpers (called by BuilderPage InsertDivider callbacks) ──────────

  window.mediaTools.insertStep = (
    index: number,
    parentGroupId?: string | null,
  ) => {
    pushHistory(store)
    store.set(insertStepAtom, { index, parentGroupId })
  }

  window.mediaTools.insertGroup = (
    index: number,
    isParallel: boolean,
  ) => {
    pushHistory(store)
    store.set(insertGroupAtom, { index, isParallel })
  }

  syncButtons(store)
}
