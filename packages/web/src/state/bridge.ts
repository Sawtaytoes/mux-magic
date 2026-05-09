import { getDefaultStore } from "jotai"
import type { PathVar, SequenceItem } from "../types"
import { pathsAtom } from "./pathsAtom"
import { stepCounterAtom, stepsAtom } from "./stepsAtom"
import {
  apiRunModalAtom,
  dryRunAtom,
  failureModeAtom,
  fileExplorerAtom,
  loadModalOpenAtom,
  lookupModalAtom,
  promptModalAtom,
  runningAtom,
} from "./uiAtoms"
import type {
  FileExplorerState,
  LookupState,
  PromptData,
} from "../types"

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mediaTools: Record<string, any>
    openLoadModal: () => void
    closeLoadModal: () => void
    openVideoModal?: (path: string) => void
  }
}

export const initBridge = () => {
  const store = getDefaultStore()

  window.mediaTools = window.mediaTools ?? {}

  // Capture the legacy property descriptors that main.js installed (with
  // configurable:true). We keep the legacy setters alive so that writes from
  // either side propagate to the sequence-state.js module variables that
  // render-all.js reads as live ES module bindings.
  const stepsDesc = Object.getOwnPropertyDescriptor(window.mediaTools, "steps")
  const pathsDesc = Object.getOwnPropertyDescriptor(window.mediaTools, "paths")
  const counterDesc = Object.getOwnPropertyDescriptor(window.mediaTools, "stepCounter")

  const legacySetSteps = stepsDesc?.set
  const legacySetPaths = pathsDesc?.set
  const legacySetCounter = counterDesc?.set

  // Seed Jotai atoms from whatever legacy state already exists (URL restore
  // runs before this bridge, so atoms start with the correct initial values).
  if (stepsDesc?.get) store.set(stepsAtom, stepsDesc.get() as SequenceItem[])
  if (pathsDesc?.get) store.set(pathsAtom, pathsDesc.get() as PathVar[])
  if (counterDesc?.get) store.set(stepCounterAtom, counterDesc.get() as number)

  Object.defineProperty(window.mediaTools, "steps", {
    get: () => store.get(stepsAtom),
    set: (value: SequenceItem[]) => {
      legacySetSteps?.(value)
      store.set(stepsAtom, value)
    },
    configurable: true,
    enumerable: true,
  })

  Object.defineProperty(window.mediaTools, "paths", {
    get: () => store.get(pathsAtom),
    set: (value: PathVar[]) => {
      legacySetPaths?.(value)
      store.set(pathsAtom, value)
    },
    configurable: true,
    enumerable: true,
  })

  Object.defineProperty(window.mediaTools, "stepCounter", {
    get: () => store.get(stepCounterAtom),
    set: (value: number) => {
      legacySetCounter?.(value)
      store.set(stepCounterAtom, value)
    },
    configurable: true,
    enumerable: true,
  })

  // Modal open/close: exposed on both window.mediaTools and window.* for HTML
  // onclick="openLoadModal()" attribute compatibility (main.js is gone for these).
  const openLoadModal = () => {
    store.set(loadModalOpenAtom, true)
  }
  const closeLoadModal = () => {
    store.set(loadModalOpenAtom, false)
  }

  window.mediaTools.openLoadModal = openLoadModal
  window.mediaTools.closeLoadModal = closeLoadModal
  window.openLoadModal = openLoadModal
  window.closeLoadModal = closeLoadModal

  // ─── Wave E: Lookup modal ─────────────────────────────────────────────────

  window.mediaTools.openLookup = (
    lookupType: string,
    stepId: string,
    fieldName: string,
  ) => {
    store.set(lookupModalAtom, {
      lookupType: lookupType as LookupState["lookupType"],
      stepId,
      fieldName,
      stage: "search",
      searchTerm: "",
      searchError: null,
      results: null,
      formatFilter: lookupType === "dvdcompare" ? "Blu-ray 4K" : "all",
      selectedGroup: null,
      selectedVariant: null,
      selectedFid: null,
      releases: null,
      releasesDebug: null,
      releasesError: null,
      loading: false,
    })
  }

  window.mediaTools.closeLookupModal = () => store.set(lookupModalAtom, null)

  // ─── Wave E: File explorer modal ──────────────────────────────────────────

  window.mediaTools.openFileExplorer = (
    path: string,
    options: { pickerOnSelect?: (selectedPath: string) => void } = {},
  ) => {
    store.set(fileExplorerAtom, {
      path,
      pickerOnSelect: options.pickerOnSelect ?? null,
    } as FileExplorerState)
  }

  window.mediaTools.closeFileExplorerModal = () =>
    store.set(fileExplorerAtom, null)

  // Also expose directly on window for legacy result-card onclick calls.
  ;(window as Record<string, unknown>).openFileExplorer = (
    path: string,
    options?: { pickerOnSelect?: (selectedPath: string) => void },
  ) => window.mediaTools.openFileExplorer(path, options)

  // ─── Wave E: Run sequence ─────────────────────────────────────────────────

  window.mediaTools.openApiRunModal = ({
    jobId,
    status,
  }: {
    jobId: string | null
    status: string
  }) => {
    store.set(runningAtom, status === "running")
    store.set(apiRunModalAtom, {
      jobId: jobId ?? null,
      status: status as never,
      logs: [],
      childJobId: null,
      childStepId: null,
    })
  }

  window.mediaTools.closeApiRunModal = () => {
    store.set(apiRunModalAtom, null)
    store.set(runningAtom, false)
  }

  // ─── Wave E: Prompt modal ─────────────────────────────────────────────────

  window.mediaTools.showPromptModal = (
    jobId: string,
    promptData: Omit<PromptData, "jobId">,
  ) => {
    store.set(promptModalAtom, { jobId, ...promptData })
  }

  window.mediaTools.closePromptModal = () => store.set(promptModalAtom, null)

  // ─── Wave E: Dry-run sync (legacy → atoms) ────────────────────────────────
  // Seed from localStorage on init so React header reflects persisted state.
  store.set(dryRunAtom, localStorage.getItem("isDryRun") === "1")
  store.set(
    failureModeAtom,
    localStorage.getItem("dryRunScenario") === "failure",
  )
}
