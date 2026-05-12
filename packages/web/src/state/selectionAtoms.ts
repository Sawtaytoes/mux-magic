import { atom } from "jotai"

// Currently-selected step in the builder UI. Set by clicking on a step
// card; read by selection-aware UI like keyboard shortcuts.
export const selectedStepIdAtom = atom<string | null>(null)
