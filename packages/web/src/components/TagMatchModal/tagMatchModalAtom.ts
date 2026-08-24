import { atom } from "jotai"
import type {
  AudioTagSet,
  TagMatchFile,
} from "./tagMatchTypes"

// Payload that drives the TagMatchModal. Set by the music match step's
// result card when a run finishes with scanned audio files; the modal
// opens on the next render.
//
// `sourcePath` is the folder the run walked. The modal itself commits
// per-file absolute paths, so the value is only used for display and
// for the preview overlay.
export type TagMatchModalState = {
  jobId: string
  stepId: string
  sourcePath: string
  files: TagMatchFile[]
}

export const tagMatchModalAtom =
  atom<TagMatchModalState | null>(null)

// Per-job log of tag writes the user applied through the modal.
// Mirrors `appliedSmartMatchRenamesByJobIdAtom`: the step card reads
// these so its summary grows as rows succeed, and a re-open of Tag
// Match does not re-offer a file whose tags are already written.
export type AppliedTagWrite = {
  filePath: string
  tags: AudioTagSet
}

export const appliedTagWritesByJobIdAtom = atom<
  Map<string, AppliedTagWrite[]>
>(new Map())
