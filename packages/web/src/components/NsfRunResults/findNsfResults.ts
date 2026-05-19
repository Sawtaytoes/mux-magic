// Type guards + finders for the NSF (nameSpecialFeaturesDvdCompareTmdb)
// pipeline's `payload.results` stream. The pipeline emits one
// `{ oldName, newName }` per rename followed by a trailing summary
// record. Both StepRunProgress (single-step run from a step card) and
// ChildProgressTracker (per-child display inside SequenceRunModal)
// extract these for the NsfRunResults panel; the type guards live here
// so neither component has its own copy.
//
// Mirrors the server-side type at
// `packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.events.ts`
// — narrowed to the fields the UI reads so unrelated server changes
// don't ripple into web typecheck.

export type NsfSummaryRecord = {
  unrenamedFilenames: string[]
  possibleNames: Array<{
    name: string
    timecode?: string
  }>
  unnamedFileCandidates?: Array<{
    filename: string
    // File extension including the dot (e.g. ".mkv"). Optional in the
    // narrowed type because old summary records emitted before the
    // server propagated it don't include the field. Modal callers
    // fall back to "" when undefined.
    extension?: string
    durationSeconds: number | null
    candidates: string[]
  }>
}

export type NsfRenamePair = {
  oldName: string
  newName: string
}

export const isNsfSummary = (
  entry: unknown,
): entry is NsfSummaryRecord => {
  if (typeof entry !== "object" || entry === null)
    return false
  const candidate = entry as Record<string, unknown>
  return (
    Array.isArray(candidate.unrenamedFilenames) &&
    Array.isArray(candidate.possibleNames)
  )
}

export const isNsfRenamePair = (
  entry: unknown,
): entry is NsfRenamePair => {
  if (typeof entry !== "object" || entry === null)
    return false
  const candidate = entry as Record<string, unknown>
  return (
    typeof candidate.oldName === "string" &&
    typeof candidate.newName === "string"
  )
}

export const findNsfSummary = (
  results: unknown[] | undefined,
): NsfSummaryRecord | null => {
  if (!results) return null
  const match = results.find(isNsfSummary)
  return match ?? null
}

export const findNsfRenamePairs = (
  results: unknown[] | undefined,
): NsfRenamePair[] => {
  if (!results) return []
  return results.filter(isNsfRenamePair)
}

// Folds SmartMatch-applied renames into the SSE-derived NSF results so
// the step card's display reflects renames the user just made via the
// modal. Specifically:
//   • Concats `appliedRenames` onto `renamePairs` so the emerald
//     "old → new" list grows immediately on Apply.
//   • Strips renamed entries from `summary.unrenamedFilenames` and
//     `summary.unnamedFileCandidates` so the "Files not renamed:"
//     block shrinks and a re-open of Smart Match doesn't re-list the
//     same files.
// Match key is the stem (oldName / filename) — both NSF and SmartMatch
// use extension-stripped names, so a direct string compare is enough.
export const mergeAppliedRenamesIntoNsfResults = ({
  summary,
  renamePairs,
  appliedRenames,
}: {
  summary: NsfSummaryRecord | null
  renamePairs: NsfRenamePair[]
  appliedRenames: NsfRenamePair[]
}): {
  summary: NsfSummaryRecord | null
  renamePairs: NsfRenamePair[]
} => {
  if (appliedRenames.length === 0) {
    return { summary, renamePairs }
  }
  const appliedOldNames = new Set(
    appliedRenames.map((pair) => pair.oldName),
  )
  const mergedPairs = renamePairs.concat(appliedRenames)
  if (summary === null) {
    return { summary, renamePairs: mergedPairs }
  }
  return {
    summary: {
      ...summary,
      unrenamedFilenames: summary.unrenamedFilenames.filter(
        (name) => !appliedOldNames.has(name),
      ),
      unnamedFileCandidates:
        summary.unnamedFileCandidates?.filter(
          (entry) => !appliedOldNames.has(entry.filename),
        ),
    },
    renamePairs: mergedPairs,
  }
}
