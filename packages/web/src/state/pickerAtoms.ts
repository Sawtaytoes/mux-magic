import { atom } from "jotai"
import type { DirEntry } from "../components/PathPicker/types"

// The command / enum / link pickers migrated onto Charcuterie's Combobox
// (rendered inline at each trigger site), so their atoms are gone. Only the
// path picker still uses this atom-driven singleton: its live-input
// directory autocomplete — the field's own input drives the suggestions and
// selecting a directory navigates deeper, keeping the list open — does not
// map onto the Combobox's trigger→popup-with-own-input, close-on-select
// model. See the pickers-onto-charcuterie-combobox migration notes.

export type TriggerRect = {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

// ─── Path picker ──────────────────────────────────────────────────────────────

export type PathPickerTarget =
  | { mode: "step"; stepId: string; fieldName: string }
  | { mode: "pathVariable"; pathVariableId: string }

export type PathPickerState = {
  inputElement: HTMLElement
  target: PathPickerTarget
  parentPath: string
  query: string
  triggerRect: TriggerRect
  entries: DirEntry[] | null
  error: string | null
  activeIndex: number
  matches: DirEntry[] | null
  separator: string
  cachedParentPath: string | null
  requestToken: number
  debounceTimerId: ReturnType<typeof setTimeout> | null
}

export const pathPickerStateAtom =
  atom<PathPickerState | null>(null)
