import { atom } from "jotai"
import type { NsfRenamePair } from "../NsfRunResults/findNsfResults"

// Per-job log of renames the user applied via SmartMatchModal. The
// modal POSTs each rename to /files/rename as the user clicks Apply;
// on success it appends the {oldName, newName} pair to this atom
// keyed by the NSF step's jobId. The step card (NsfRunResults) reads
// these and:
//   1. Concats them with the SSE-derived `renamePairs` so the emerald
//      "old → new" list grows to include the SmartMatch-applied ones.
//   2. Filters them out of `summary.unrenamedFilenames` /
//      `summary.unnamedFileCandidates` so the "Files not renamed:"
//      block and the SmartMatch dropdown stop showing files that
//      have already been renamed.
//
// Without this round-trip the step card stayed stuck on the original
// pre-SmartMatch summary — the user saw "Renamed 0. Files not
// renamed: 4." even after applying 3 renames, and re-opening Smart
// Match still listed the renamed files.
//
// Cleared on jobId change by StepRunProgress (a new run gets a fresh
// jobId so the old slot is harmless; this is just hygiene).
export const appliedSmartMatchRenamesByJobIdAtom = atom<
  Map<string, NsfRenamePair[]>
>(new Map())
