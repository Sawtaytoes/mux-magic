// Narrow type mirrors of the server-side duplicate shapes. The web side
// keeps its own copy — same pattern `tagMatchTypes.ts` and
// `smartMatchTypes.ts` use — so server-side type churn does not ripple
// into web typecheck.
//
// Source of truth: `FindDuplicateAudioFilesGroupRecord` in
// `packages/core/src/app-commands/findDuplicateAudioFiles.ts`.

export type DuplicateMatchReason =
  | "audio"
  | "fingerprint"
  | "tags"

// How much each way of matching actually PROVES. The table shows this
// beside every group because "identical audio" and "same tags" deserve
// very different amounts of trust from the person confirming a move, and
// a bare "duplicate" label would flatten the difference.
export const DUPLICATE_MATCH_REASON_LABELS: Record<
  DuplicateMatchReason,
  string
> = {
  audio: "Identical audio",
  fingerprint: "Same recording",
  tags: "Same tags",
}

export const DUPLICATE_MATCH_REASON_DESCRIPTIONS: Record<
  DuplicateMatchReason,
  string
> = {
  audio:
    "The decoded audio is byte-for-byte the same. Certain.",
  fingerprint:
    "AcoustID reports the same recording. Pairs a FLAC with an MP3, which no hash can.",
  tags: "Only the tags agree. The weakest signal — check before confirming.",
}

// Only "identical audio" is proof. Anything weaker starts UNCHECKED, so
// confirming a whole table without reading it cannot move a file on the
// strength of a tag coincidence.
export const AUTO_CHECKED_MATCH_REASONS: DuplicateMatchReason[] =
  ["audio"]

export type DuplicateFileInfo = {
  bitDepth?: number
  bitRate?: number
  channelCount?: number
  codec?: string
  durationSeconds?: number
  fileSizeBytes: number
  filePath: string
  hasEmbeddedCoverArt: boolean
  sampleRate?: number
}

export type DuplicateCopy = {
  filePath: string
  info: DuplicateFileInfo
  isLossless: boolean
  isRecommendedKeep: boolean
  rankReasons: string[]
}

export type DuplicateGroup = {
  copies: DuplicateCopy[]
  groupKey: string
  isDuplicateGroup: true
  matchReason: DuplicateMatchReason
}

export const isDuplicateGroup = (
  entry: unknown,
): entry is DuplicateGroup =>
  typeof entry === "object" &&
  entry !== null &&
  (entry as Record<string, unknown>).isDuplicateGroup ===
    true &&
  Array.isArray(
    (entry as Record<string, unknown>).copies,
  ) &&
  typeof (entry as Record<string, unknown>).groupKey ===
    "string"

export const findDuplicateGroups = (
  results: readonly unknown[] | null | undefined,
): DuplicateGroup[] =>
  results ? results.filter(isDuplicateGroup) : []

export const countRedundantCopies = (
  groups: DuplicateGroup[],
) =>
  groups.reduce(
    (total, group) =>
      total +
      group.copies.filter((copy) => !copy.isRecommendedKeep)
        .length,
    0,
  )

// A group whose copies the user already moved is not re-offered. Mirrors
// `dropAppliedMusicMatchFiles` — the step card must not invite the same
// work twice after a confirm.
export const dropResolvedDuplicateGroups = ({
  groups,
  resolvedFilePaths,
}: {
  groups: DuplicateGroup[]
  resolvedFilePaths: string[]
}): DuplicateGroup[] =>
  resolvedFilePaths.length === 0
    ? groups
    : ((resolvedPaths: Set<string>) =>
        groups
          .map((group) => ({
            ...group,
            copies: group.copies.filter(
              (copy) => !resolvedPaths.has(copy.filePath),
            ),
          }))
          // A group with one copy left is no longer a duplicate.
          .filter((group) => group.copies.length > 1))(
        new Set(resolvedFilePaths),
      )

export const formatFileSize = (bytes: number) =>
  bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.round(bytes / 1000)} KB`

export const formatQuality = (info: DuplicateFileInfo) =>
  [
    info.codec,
    info.bitDepth === undefined
      ? null
      : `${info.bitDepth}-bit`,
    info.sampleRate === undefined
      ? null
      : `${(info.sampleRate / 1000).toFixed(1)} kHz`,
    formatFileSize(info.fileSizeBytes),
  ]
    .filter(
      (part): part is string =>
        typeof part === "string" && part.length > 0,
    )
    .join(" · ")
