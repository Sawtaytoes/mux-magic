// Pure formatter for the catch-all "post-run results" panel.
// Ports the heuristic the deprecated public/builder formatStepResults
// used to apply: pick the best-fit representation for a results array
// without knowing what command produced it. Specialized renderers
// (NSF, ConvertLossless) live in their own components and run first;
// GenericRunResults only fires for commands they don't claim.

const basename = (path: string) => {
  const lastSeparatorIndex = Math.max(
    path.lastIndexOf("/"),
    path.lastIndexOf("\\"),
  )
  return lastSeparatorIndex === -1
    ? path
    : path.slice(lastSeparatorIndex + 1)
}

type AudioOffsetRecord = {
  destinationFilePath: string
  offsetInMilliseconds: number
  sourceFilePath?: string
}

const isAudioOffsetRecord = (
  entry: unknown,
): entry is AudioOffsetRecord => {
  if (typeof entry !== "object" || entry === null)
    return false
  const candidate = entry as Record<string, unknown>
  return (
    typeof candidate.destinationFilePath === "string" &&
    typeof candidate.offsetInMilliseconds === "number"
  )
}

type RenamePair = {
  fromValue: string
  toValue: string
}

const RENAME_FIELD_PAIRS: ReadonlyArray<
  readonly [string, string]
> = [
  ["source", "destination"],
  ["oldName", "newName"],
  ["from", "to"],
]

const findRenameFieldNames = (
  results: ReadonlyArray<unknown>,
): { fromKey: string; toKey: string } | null => {
  const match = RENAME_FIELD_PAIRS.find(
    ([fromKey, toKey]) =>
      results.every((item) => {
        if (typeof item !== "object" || item === null)
          return false
        const candidate = item as Record<string, unknown>
        return (
          typeof candidate[fromKey] === "string" &&
          typeof candidate[toKey] === "string"
        )
      }),
  )
  return match
    ? { fromKey: match[0], toKey: match[1] }
    : null
}

export type GenericResultsView =
  | { kind: "empty" }
  | {
      kind: "audioOffsets"
      rows: ReadonlyArray<{
        label: string
        offsetInMilliseconds: number
      }>
    }
  | {
      kind: "renames"
      rows: ReadonlyArray<RenamePair>
    }
  | {
      kind: "paths"
      rows: ReadonlyArray<string>
    }
  | {
      kind: "json"
      text: string
    }

const flattenResults = (
  results: ReadonlyArray<unknown>,
): unknown[] =>
  results.flatMap((entry) =>
    Array.isArray(entry) ? entry : [entry],
  )

export const formatGenericResults = (
  results: ReadonlyArray<unknown> | null | undefined,
): GenericResultsView => {
  if (!results || results.length === 0) {
    return { kind: "empty" }
  }

  const flattened = flattenResults(results)
  if (flattened.length === 0) {
    return { kind: "empty" }
  }

  if (flattened.every(isAudioOffsetRecord)) {
    return {
      kind: "audioOffsets",
      rows: flattened.map((record) => ({
        label: basename(record.destinationFilePath),
        offsetInMilliseconds: record.offsetInMilliseconds,
      })),
    }
  }

  const renameFields = findRenameFieldNames(flattened)
  if (renameFields) {
    return {
      kind: "renames",
      rows: flattened.map((item) => {
        const record = item as Record<string, unknown>
        return {
          fromValue: String(record[renameFields.fromKey]),
          toValue: String(record[renameFields.toKey]),
        }
      }),
    }
  }

  if (flattened.every((item) => typeof item === "string")) {
    return {
      kind: "paths",
      rows: flattened as string[],
    }
  }

  const value =
    flattened.length === 1 ? flattened[0] : flattened
  try {
    return {
      kind: "json",
      text: JSON.stringify(value, null, 2),
    }
  } catch {
    return { kind: "json", text: String(value) }
  }
}
