import { atom } from "jotai"

// YAML snapshot strings — each undo push saves the serialized sequence
export const undoStackAtom = atom<string[]>([])
export const redoStackAtom = atom<string[]>([])

// Enabled flags — set by builderBridge (React SPA) or via syncUndoRedo
// (legacy HTML bridge) after each history mutation. PageHeader reads these
// instead of watching DOM attribute mutations.
export const canUndoAtom = atom<boolean>(false)
export const canRedoAtom = atom<boolean>(false)
