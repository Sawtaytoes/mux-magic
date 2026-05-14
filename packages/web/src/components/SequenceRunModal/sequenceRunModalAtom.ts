import { atom } from "jotai"
import type { SequenceRunModalState } from "./types"

export const sequenceRunModalAtom =
  atom<SequenceRunModalState>({ mode: "closed" })
