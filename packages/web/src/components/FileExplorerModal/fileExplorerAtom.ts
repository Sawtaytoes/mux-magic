import { atom } from "jotai"
import type { FileExplorerState } from "./types"

export const fileExplorerAtom =
  atom<FileExplorerState | null>(null)
