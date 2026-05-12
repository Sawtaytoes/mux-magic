import { atom } from "jotai"
import type { LookupState } from "./types"

export const lookupModalAtom = atom<LookupState | null>(
  null,
)
