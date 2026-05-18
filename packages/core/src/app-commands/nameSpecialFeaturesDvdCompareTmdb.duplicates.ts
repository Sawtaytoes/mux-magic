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
export const groupRenamesByTarget = <
  T extends { renamedFilename: string },
>(
  renames: T[],
): Map<string, T[]> => {
  const groups = new Map<string, T[]>()
  renames.forEach((rename) => {
    const existing = groups.get(rename.renamedFilename)
    if (existing) {
      existing.push(rename)
      return
    }
    groups.set(rename.renamedFilename, [rename])
  })
  return groups
}

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

// Build a Phase-B duplicate-detection prompt observable. For each group
// of >1 files mapping to the same target name, emit a multi-select
// `getUserSearchInput` prompt with one option per file (each option
// carrying a per-row `filePath` so the Builder can render a ▶ Play
// button on every row). The user picks which file claims the
// un-suffixed target name; the chosen file is moved to the front of
// the group, and the rest fall through to the existing scan-counter
// for `(2)/(3)/…` suffixing. -1 (skip) preserves DVDCompare order.
export const reorderForDuplicatePrompts = (
  renames: {
    fileInfo: FileInfo
    renamedFilename: string
  }[],
): Observable<
  { fileInfo: FileInfo; renamedFilename: string }[]
> => {
  const groups = groupRenamesByTarget(renames)
  const duplicateGroups = Array.from(
    groups.values(),
  ).filter((group) => group.length > 1)
  if (duplicateGroups.length === 0) {
    return of(renames)
  }
  // Walk each duplicate group sequentially. `concatMap` over the
  // groups keeps prompts strictly ordered so the UI never shows two
  // duplicate-pick modals at once. Each iteration emits one
  // { group, selectedIndex } pair; we collect them with toArray and
  // fold into the final reordered renames in a single pass at the
  // end. Avoids the prior reduce-of-observables pattern that caused
  // a hang after the first prompt was answered.
  return from(duplicateGroups).pipe(
    concatMap((group) =>
      getUserSearchInput({
        message:
          `These ${group.length} files all match "${group[0].renamedFilename}".\n` +
          "Pick the one that's the real match — the rest will be left " +
          "unrenamed so you can identify them separately.",
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
      picks.reduce(
        (currentRenames, { group, selectedIndex }) => {
          if (selectedIndex < 0) {
            // User skipped → preserve all renames; the downstream counter
            // scan auto-suffixes (2)/(3)/… in DVDCompare order.
            return currentRenames
          }
          const chosen = group[selectedIndex]
          if (!chosen) {
            return currentRenames
          }
          // Drop the non-chosen group members from the rename list.
          // Their fileInfo is still in the upstream `matches` array, so
          // they'll surface in `unrenamedFilenames` for the post-rename
          // summary — letting the user identify each via the Phase B
          // interactive renamer rather than wearing a misleading (2)
          // suffix the user explicitly rejected by picking only one.
          const droppedFullPaths = new Set(
            group
              .filter((rename) => rename !== chosen)
              .map((rename) => rename.fileInfo.fullPath),
          )
          return currentRenames.filter(
            (rename) =>
              !droppedFullPaths.has(
                rename.fileInfo.fullPath,
              ),
          )
        },
        renames,
      ),
    ),
  )
}
