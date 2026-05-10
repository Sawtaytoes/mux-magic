import { atom } from "jotai"
import type { DirEntry } from "../types"

export type TriggerRect = {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

// ─── Command picker ───────────────────────────────────────────────────────────

export type CommandPickerAnchor = { stepId: string }

export type CommandPickerState = {
  anchor: CommandPickerAnchor
  triggerRect: TriggerRect
}

export const commandPickerStateAtom =
  atom<CommandPickerState | null>(null)

// ─── Enum picker ──────────────────────────────────────────────────────────────

export type EnumPickerAnchor = {
  stepId: string
  fieldName: string
}

export type EnumPickerState = {
  anchor: EnumPickerAnchor
  triggerRect: TriggerRect
}

export const enumPickerStateAtom =
  atom<EnumPickerState | null>(null)

// ─── Link picker ──────────────────────────────────────────────────────────────

export type LinkPickerAnchor = {
  stepId: string
  fieldName: string
}

export type LinkPickerState = {
  anchor: LinkPickerAnchor
  triggerRect: TriggerRect
}

export const linkPickerStateAtom =
  atom<LinkPickerState | null>(null)

// ─── Path picker ──────────────────────────────────────────────────────────────

export type PathPickerTarget =
  | { mode: "step"; stepId: string; fieldName: string }
  | { mode: "pathVar"; pathVarId: string }

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
