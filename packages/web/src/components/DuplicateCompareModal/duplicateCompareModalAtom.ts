import { atom } from "jotai"

import type { DuplicateGroup } from "./duplicateCompareTypes"

// Payload that drives the DuplicateCompareModal. Set by the duplicate
// step's result card when a run finishes with duplicate groups; the
// modal opens on the next render.
//
// `sourcePath` is the folder the run walked. It is not decoration — the
// server recreates each copy's path BELOW this root inside the holding
// folder, so two same-named tracks from different albums cannot collide.
export type DuplicateCompareModalState = {
  groups: DuplicateGroup[]
  jobId: string
  sourcePath: string
  stepId: string
}

export const duplicateCompareModalAtom =
  atom<DuplicateCompareModalState | null>(null)

// Per-job log of copies the user moved through the modal. Mirrors
// `appliedTagWritesByJobIdAtom`: the step card reads these so its
// summary grows as rows succeed, and a re-open does not re-offer a copy
// that is already out of the library.
export const resolvedDuplicateFilePathsByJobIdAtom = atom<
  Map<string, string[]>
>(new Map())
