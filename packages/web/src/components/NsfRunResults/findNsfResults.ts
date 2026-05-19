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
