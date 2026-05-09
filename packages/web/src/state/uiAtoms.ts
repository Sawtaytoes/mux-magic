import { atom } from "jotai"
import type { ApiRunState, FileExplorerState, LookupState, PromptData } from "../types"

export const loadModalOpenAtom = atom<boolean>(false)
export const yamlModalOpenAtom = atom<boolean>(false)
export const commandHelpModalOpenAtom = atom<boolean>(false)
export const commandHelpCommandNameAtom = atom<string | null>(null)
export const selectedStepIdAtom = atom<string | null>(null)
export const dryRunAtom = atom<boolean>(false)
export const failureModeAtom = atom<boolean>(false)

// ─── Wave E atoms ─────────────────────────────────────────────────────────────

export const lookupModalAtom = atom<LookupState | null>(null)
export const apiRunModalAtom = atom<ApiRunState | null>(null)
export const promptModalAtom = atom<PromptData | null>(null)
export const fileExplorerAtom = atom<FileExplorerState | null>(null)
// true while a sequence / group / step run is in flight
export const runningAtom = atom<boolean>(false)
