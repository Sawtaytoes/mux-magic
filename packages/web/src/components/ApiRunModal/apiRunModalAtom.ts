import { atom } from "jotai"
import type { ApiRunState } from "./types"

export const apiRunModalAtom = atom<ApiRunState | null>(
  null,
)
