import { atom } from "jotai"
import type { PathVariable, SequenceItem } from "../types"

export type Snapshot = {
  steps: SequenceItem[]
  paths: PathVariable[]
  stepCounter: number
  threadCount: string | null
}

export const undoStackAtom = atom<Snapshot[]>([])
export const redoStackAtom = atom<Snapshot[]>([])

export const canUndoAtom = atom<boolean>(false)
export const canRedoAtom = atom<boolean>(false)
