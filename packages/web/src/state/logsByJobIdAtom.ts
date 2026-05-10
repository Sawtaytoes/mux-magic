import { atom } from "jotai"

export const logsByJobIdAtom = atom<Map<string, string[]>>(
  new Map(),
)
