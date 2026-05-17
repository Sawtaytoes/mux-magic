import { atom } from "jotai"
import type {
  Candidate,
  UnrenamedFile,
} from "./smartMatchScoring"

// Payload that drives the SmartMatchModal. Set by the NSF result-card
// trigger when an NSF step finishes with a non-empty
// `unnamedFileCandidates` summary; the modal opens on the next render.
//
// `sourcePath` is required so the modal can construct absolute rename
// targets (`{sourcePath}{sep}{filename}`) for the per-row POST
// /files/rename calls.
export type SmartMatchModalState = {
  jobId: string
  stepId: string
  sourcePath: string
  unrenamedFiles: UnrenamedFile[]
  candidates: Candidate[]
}

export const smartMatchModalAtom =
  atom<SmartMatchModalState | null>(null)
