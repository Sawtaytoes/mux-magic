import { atom } from "jotai";

// YAML snapshot strings — each undo push saves the serialized sequence
export const undoStackAtom = atom<string[]>([]);
export const redoStackAtom = atom<string[]>([]);
