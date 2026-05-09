import { getDefaultStore } from "jotai"
import type { PathVar, SequenceItem } from "../types"
import { pathsAtom } from "./pathsAtom"
import { stepCounterAtom, stepsAtom } from "./stepsAtom"
import { loadModalOpenAtom } from "./uiAtoms"

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mediaTools: Record<string, any>
    openLoadModal: () => void
    closeLoadModal: () => void
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
}
