import type { FileInfo } from "@mux-magic/tools"
import {
  concatMap,
  from,
  map,
  type Observable,
  of,
  toArray,
} from "rxjs"
import { getUserSearchInput } from "../tools/getUserSearchInput.js"

// Group renames by target name and detect intra-run duplicates (groups
// where two-or-more files all map to the same target). Each group keeps
// the input order so callers can reason about positional semantics
// (e.g. which entry currently holds index 0 — that's the one the
// existing scan would assign the un-suffixed name to). Returns a map
// from target → ordered list of renames sharing it.
//
// Built via `.reduce` returning a fresh `Map` per iteration to satisfy
// the repo's no-array-mutation rule (worker 25 drive-by) — the old
// `.push` mutated the bucket array in place.
export const groupRenamesByTarget = <
  T extends { renamedFilename: string },
>(
  renames: T[],
): Map<string, T[]> =>
  renames.reduce<Map<string, T[]>>((groups, rename) => {
    const existing = groups.get(rename.renamedFilename)
    const next = new Map(groups)
    next.set(
      rename.renamedFilename,
      existing
        ? existing.concat(rename)
        : [rename],
    )
    return next
  }, new Map<string, T[]>())

// Promote one rename to the front of the array while preserving the
// relative order of every other entry. Used by the duplicate-detection
// branch: once the user picks which file should claim the un-suffixed
// target name, that file is bubbled up so the existing scan-counter
// assigns it the un-suffixed name and the others fall through to
// `(2)/(3)/…`. When `chosen` is not in the list the array is returned
// unchanged.
export const promoteRenameToFront = <T>(
  renames: T[],
  chosen: T,
): T[] => {
  if (!renames.includes(chosen)) {
    return renames
  }
  return [
    chosen,
    ...renames.filter((rename) => rename !== chosen),
  ]
}

export type DuplicatePromptResult = {
  // Renames that survived the prompt — what the rest of the pipeline
  // should act on.
  kept: {
    fileInfo: FileInfo
    renamedFilename: string
  }[]
  // Full paths of files the user excluded by picking "this one is the
  // real match" on a duplicate group. The orchestrator routes these
  // into `<sourcePath>/DUPLICATES/` so the user can review them on
  // disk (worker 25 — the filesystem is the cache).
  droppedFullPaths: string[]
}

// Build a Phase-B duplicate-detection prompt observable. For each group
// of >1 files mapping to the same target name, emit a multi-select
// `getUserSearchInput` prompt with one option per file (each option
// carrying a per-row `filePath` so the Builder can render a ▶ Play
// button on every row). The user picks which file claims the
// un-suffixed target name; the chosen file is kept in the rename list,
// the rest are filtered out AND reported in `droppedFullPaths` so the
// orchestrator can route them into `DUPLICATES/`. -1 (skip) preserves
// every entry in DVDCompare order so the downstream scan counter
// suffixes (2)/(3)/… deterministically.
export const reorderForDuplicatePrompts = (
  renames: {
    fileInfo: FileInfo
    renamedFilename: string
  }[],
): Observable<DuplicatePromptResult> => {
  const groups = groupRenamesByTarget(renames)
  const duplicateGroups = Array.from(
    groups.values(),
  ).filter((group) => group.length > 1)
  if (duplicateGroups.length === 0) {
    return of({ kept: renames, droppedFullPaths: [] })
  }
  return from(duplicateGroups).pipe(
    concatMap((group) =>
      getUserSearchInput({
        message:
          `These ${group.length} files all match "${group[0].renamedFilename}".\n` +
          "Pick the one that's the real match — the rest will be moved " +
          "to a DUPLICATES/ folder so you can identify them separately.",
        options: [
          ...group.map((rename, index) => ({
            index,
            label: rename.fileInfo.filename,
          })),
          {
            index: -1,
            label: "Skip — auto-suffix all with (2)/(3)/…",
          },
        ],
        filePaths: group.map((rename, index) => ({
          index,
          path: rename.fileInfo.fullPath,
        })),
      }).pipe(
        map((selectedIndex) => ({ group, selectedIndex })),
      ),
    ),
    toArray(),
    map((picks) =>
      picks.reduce<DuplicatePromptResult>(
        (current, { group, selectedIndex }) => {
          if (selectedIndex < 0) {
            // Skip → keep every entry; downstream counter auto-suffixes
            // (2)/(3)/… in DVDCompare order.
            return current
          }
          const chosen = group[selectedIndex]
          if (!chosen) {
            return current
          }
          const droppedFromGroup = group
            .filter((rename) => rename !== chosen)
            .map((rename) => rename.fileInfo.fullPath)
          const droppedSet = new Set(droppedFromGroup)
          return {
            kept: current.kept.filter(
              (rename) =>
                !droppedSet.has(rename.fileInfo.fullPath),
            ),
            droppedFullPaths:
              current.droppedFullPaths.concat(
                droppedFromGroup,
              ),
          }
        },
        { kept: renames, droppedFullPaths: [] },
      ),
    ),
  )
}
