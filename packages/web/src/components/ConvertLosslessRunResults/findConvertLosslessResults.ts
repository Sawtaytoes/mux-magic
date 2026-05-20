// Type guards + finder for the convertLosslessToFlac pipeline's
// `payload.results` stream. Each file emits a `ConvertLosslessToFlacRecord`
// — either `{ kind: "converted", source, destination, isSourceDeleted }`
// or `{ kind: "skipped", source, reason }`. StepRunProgress collects them
// here so the post-run panel can show "X converted / Y skipped (reason)".
//
// Mirrors the server-side discriminated union at
// `packages/core/src/app-commands/convertLosslessToFlac.ts` — narrowed to
// the fields the UI reads so unrelated server changes don't ripple in.

export type ConvertLosslessSkipReason =
  | "audit-only"
  | "dsd"
  | "float-pcm"

export type ConvertLosslessConvertedRecord = {
  kind: "converted"
  source: string
  destination: string
}

export type ConvertLosslessSkippedRecord = {
  kind: "skipped"
  source: string
  reason: ConvertLosslessSkipReason
}

export type ConvertLosslessRunResultsData = {
  converted: ConvertLosslessConvertedRecord[]
  skipped: ConvertLosslessSkippedRecord[]
}

const isConvertLosslessConvertedRecord = (
  entry: unknown,
): entry is ConvertLosslessConvertedRecord => {
  if (typeof entry !== "object" || entry === null)
    return false
  const candidate = entry as Record<string, unknown>
  return (
    candidate.kind === "converted" &&
    typeof candidate.source === "string" &&
    typeof candidate.destination === "string"
  )
}

const isConvertLosslessSkippedRecord = (
  entry: unknown,
): entry is ConvertLosslessSkippedRecord => {
  if (typeof entry !== "object" || entry === null)
    return false
  const candidate = entry as Record<string, unknown>
  return (
    candidate.kind === "skipped" &&
    typeof candidate.source === "string" &&
    (candidate.reason === "audit-only" ||
      candidate.reason === "dsd" ||
      candidate.reason === "float-pcm")
  )
}

export const findConvertLosslessResults = (
  results: unknown[] | undefined,
): ConvertLosslessRunResultsData => ({
  converted:
    results?.filter(isConvertLosslessConvertedRecord) ?? [],
  skipped:
    results?.filter(isConvertLosslessSkippedRecord) ?? [],
})
