import { atom } from "jotai"
import type { PathVar } from "../types"

export const pathsAtom = atom<PathVar[]>([])
