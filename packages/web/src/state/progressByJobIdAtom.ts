import { atom } from "jotai"
import type { ProgressSnapshot } from "../types"

export const progressByJobIdAtom = atom<Map<string, ProgressSnapshot>>(new Map())
