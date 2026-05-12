import { atom } from "jotai"
import type { ProgressSnapshot } from "../jobs/types"

export const progressByJobIdAtom = atom<
  Map<string, ProgressSnapshot>
>(new Map())
