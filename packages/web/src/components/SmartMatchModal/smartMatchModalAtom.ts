import { atom } from "jotai"
import type { FileSuggestion } from "./smartMatchTypes"

// Payload that drives the SmartMatchModal. Set by the NSF result-card
// trigger when an NSF step finishes with a non-empty
// `unnamedFileCandidates` summary; the modal opens on the next render.
//
// Worker 25: the modal now receives already-ranked suggestions directly
// from the server payload — no client-side `rankSuggestions` call. The
// shape is `FileSuggestion[]` (filename / extension / durationSeconds /
// rankedCandidates).
//
// `sourcePath` is required so the modal can construct absolute rename
// targets for the per-row POST /files/rename calls.
export type SmartMatchModalState = {
  jobId: string
  stepId: string
  sourcePath: string
  suggestions: FileSuggestion[]
}

export const smartMatchModalAtom =
  atom<SmartMatchModalState | null>(null)
