import { useState } from "react"
import type {
  ConvertLosslessConvertedRecord,
  ConvertLosslessRunResultsData,
  ConvertLosslessSkippedRecord,
  ConvertLosslessSkipReason,
} from "./findConvertLosslessResults"

// Post-run report for a `convertLosslessToFlac` job. Surfaces what was
// converted vs. what was skipped (and why) — without this the StepCard
// just shows "completed" and the per-file SKIPPED FLAC SOURCE log lines
// stay buried in the collapsed logs panel. The "completed" badge alone
// gives the user no way to tell whether their 32-bit float WAVs were
// safely passed over or silently re-encoded.
//
// Presentational only — the hosting component derives `data` from the
// SSE `payload.results` at `isDone` and passes it in.
//
// Audit-mode awareness: a `skipped` record with reason `"audit-only"`
// means "the probe said this file is compatible, but Audit Only was on
// so I didn't encode it" — i.e. it's the *would-be-converted* set, not
// a real skip. The panel detects the presence of any audit-only record
// and re-labels: "Would convert / Would skip" instead of
// "Converted / Skipped". Hiding audit-only entirely (the previous
// behavior) caused the audit count to look like "all 124 are float-pcm"
// when really 124 were float and the other ~20 were compatible-but-
// dry-run, invisible to the user.

type Props = {
  data: ConvertLosslessRunResultsData
}

type ListedSkipReason = Exclude<
  ConvertLosslessSkipReason,
  "audit-only"
>

const skipReasonLabel: Record<ListedSkipReason, string> = {
  dsd: "DSD / DST (not representable in FLAC)",
  "float-pcm":
    "32-bit/64-bit float PCM (FLAC is integer-only)",
}

const basename = (path: string) => {
  const lastSep = Math.max(
    path.lastIndexOf("/"),
    path.lastIndexOf("\\"),
  )
  return lastSep === -1 ? path : path.slice(lastSep + 1)
}

const compareByBasename = (
  pathA: string,
  pathB: string,
) =>
  basename(pathA).localeCompare(
    basename(pathB),
    undefined,
    {
      sensitivity: "base",
      numeric: true,
    },
  )

const isListedSkipReason = (
  reason: ConvertLosslessSkipReason,
): reason is ListedSkipReason => reason !== "audit-only"

const groupSkippedByReason = (
  skipped: ConvertLosslessSkippedRecord[],
): Array<{
  reason: ListedSkipReason
  records: ConvertLosslessSkippedRecord[]
}> => {
  const reasons: ListedSkipReason[] = ["float-pcm", "dsd"]
  return reasons
    .map((reason) => ({
      reason,
      records: skipped
        .filter((record) => record.reason === reason)
        .toSorted((recordA, recordB) =>
          compareByBasename(recordA.source, recordB.source),
        ),
    }))
    .filter((group) => group.records.length > 0)
}

export const ConvertLosslessRunResults = ({
  data,
}: Props) => {
  const auditOnlyRecords = data.skipped.filter(
    (record) => record.reason === "audit-only",
  )
  const isAuditMode = auditOnlyRecords.length > 0

  // In a real run the converted list is the boring expected case
  // (collapsed). In an audit run it IS the answer the user came for
  // ("which files would actually encode?") — open it by default so the
  // list is visible without an extra click.
  const [isConvertedOpen, setIsConvertedOpen] =
    useState(isAuditMode)
  const [isSkippedOpen, setIsSkippedOpen] = useState(true)

  const listedSkipped = data.skipped.filter((record) =>
    isListedSkipReason(record.reason),
  )

  // Compatible-file count: in a real run that's the encoded set; in an
  // audit run it's the would-be-encoded set (the audit-only records).
  // Treated as one list so the UI tells the same story regardless of
  // which mode the user picked.
  const compatibleSources: Array<{
    source: string
    destination: string | null
  }> = isAuditMode
    ? auditOnlyRecords.map((record) => ({
        source: record.source,
        destination: null,
      }))
    : data.converted.map(
        (record: ConvertLosslessConvertedRecord) => ({
          source: record.source,
          destination: record.destination,
        }),
      )

  if (
    compatibleSources.length === 0 &&
    listedSkipped.length === 0
  ) {
    return null
  }

  const sortedCompatible = compatibleSources.toSorted(
    (entryA, entryB) =>
      compareByBasename(entryA.source, entryB.source),
  )
  const skippedGroups = groupSkippedByReason(listedSkipped)

  const compatibleHeading = isAuditMode
    ? "Would convert"
    : "Converted"
  const compatibleCountLabel = isAuditMode
    ? "would convert"
    : "converted"
  const skippedCountLabel = isAuditMode
    ? "would skip"
    : "skipped"
  const skippedHeadingPrefix = isAuditMode
    ? "Would skip"
    : "Skipped"

  return (
    <div
      id="convert-lossless-run-results"
      className="flex flex-col gap-2 text-xs"
    >
      {isAuditMode && (
        <div
          data-cl-audit-banner
          className="rounded border border-blue-800/40 bg-blue-950/30 px-2 py-1 text-blue-300"
        >
          Audit-only (dry-run) — counts below are what a
          real run <em>would</em> do; no files were encoded
          or deleted.
        </div>
      )}
      <div
        data-cl-counts
        className="flex flex-wrap items-center gap-3 text-slate-300"
      >
        <span>
          <span className="font-semibold text-emerald-300">
            {compatibleSources.length}
          </span>{" "}
          {compatibleCountLabel}
        </span>
        <span>
          <span className="font-semibold text-amber-300">
            {listedSkipped.length}
          </span>{" "}
          {skippedCountLabel}
        </span>
      </div>

      {compatibleSources.length > 0 && (
        <details
          data-cl-converted
          open={isConvertedOpen}
          onToggle={(event) =>
            setIsConvertedOpen(
              (event.currentTarget as HTMLDetailsElement)
                .open,
            )
          }
          className="rounded border border-emerald-800/40 bg-emerald-950/30"
        >
          <summary className="cursor-pointer px-2 py-1 text-emerald-300">
            {compatibleHeading} ({compatibleSources.length})
          </summary>
          <ul className="px-3 py-2 space-y-1 font-mono text-emerald-200/90 break-all">
            {sortedCompatible.map((entry) => (
              <li key={entry.source}>
                {basename(entry.source)}
                {entry.destination !== null && (
                  <>
                    <span className="text-emerald-500">
                      {" → "}
                    </span>
                    {basename(entry.destination)}
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {skippedGroups.map((group) => (
        <details
          key={group.reason}
          data-cl-skipped-group={group.reason}
          open={isSkippedOpen}
          onToggle={(event) =>
            setIsSkippedOpen(
              (event.currentTarget as HTMLDetailsElement)
                .open,
            )
          }
          className="rounded border border-amber-800/40 bg-amber-950/30"
        >
          <summary className="cursor-pointer px-2 py-1 text-amber-300">
            {skippedHeadingPrefix} —{" "}
            {skipReasonLabel[group.reason]} (
            {group.records.length})
          </summary>
          <ul className="px-3 py-2 space-y-1 font-mono text-amber-200/90 break-all">
            {group.records.map((record) => (
              <li key={record.source}>
                {basename(record.source)}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  )
}
