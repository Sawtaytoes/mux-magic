import { atom } from "jotai"

// Tracks user-toggled disclosure state for each job's Steps section.
// Absent entry → "use default for current status" (open while running/pending).
export const stepsOpenByJobIdAtom = atom<
  Map<string, boolean>
>(new Map())
