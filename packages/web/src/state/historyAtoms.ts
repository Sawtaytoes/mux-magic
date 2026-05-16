import { atom } from "jotai"
import type { SequenceItem, Variable } from "../types"

export type Snapshot = {
  steps: SequenceItem[]
  // Holds every variable type (path, dvdCompareId, threadCount, …); the
  // field name is historical from when only path variables existed.
  paths: Variable[]
}

export const undoStackAtom = atom<Snapshot[]>([])
export const redoStackAtom = atom<Snapshot[]>([])

export const canUndoAtom = atom<boolean>(false)
export const canRedoAtom = atom<boolean>(false)

export const scrollToStepAtom = atom<string | null>(null)

// Monotonically incremented by useScrollToAffectedStep every time a
// scroll request is processed. Asynchronous scroll producers (paste,
// which only fires after a view transition resolves) capture the
// current value before starting and skip their delayed scroll if it
// has changed by the time they get to write — meaning a more recent
// action (insert, undo/redo, another paste) has already moved the
// viewport and should not be overridden.
export const scrollSeqAtom = atom<number>(0)
