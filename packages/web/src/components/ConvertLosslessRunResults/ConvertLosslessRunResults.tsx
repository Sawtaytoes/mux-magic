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

type Props = {
  data: ConvertLosslessRunResultsData
}

// Audit-only is deliberately omitted from BOTH counts and the per-
// reason listing: an audit-only run skips every otherwise-encodable
// file by definition, so re-stating "60 audit-only skips" tells the
// user nothing the "Audit Only (Dry-Run)" checkbox didn't. Only the
// substantive skips (float / DSD) are worth surfacing.
type ListedSkipReason = Exclude<
  ConvertLosslessSkipReason,
  "audit-only"
>

const skipReasonLabel: Record<ListedSkipReason, string> = {
  dsd: "DSD / DST (not representable in FLAC)",
  "float-pcm":
    "32-bit/64-bit float PCM (FLAC is integer-only)",
}

const basename = (path: string): string => {
  const lastSep = Math.max(
    path.lastIndexOf("/"),
    path.lastIndexOf("\\"),
  )
  return lastSep === -1 ? path : path.slice(lastSep + 1)
}

const compareByBasename = (
  pathA: string,
  pathB: string,
): number =>
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
  const [isConvertedOpen, setIsConvertedOpen] =
    useState(false)
  const [isSkippedOpen, setIsSkippedOpen] = useState(true)

  const listedSkipped = data.skipped.filter((record) =>
    isListedSkipReason(record.reason),
  )

  if (
    data.converted.length === 0 &&
    listedSkipped.length === 0
  ) {
    return null
  }

  const sortedConverted = data.converted.toSorted(
    (recordA, recordB) =>
      compareByBasename(recordA.source, recordB.source),
  )
  const skippedGroups = groupSkippedByReason(listedSkipped)

  return (
    <div
      id="convert-lossless-run-results"
      className="flex flex-col gap-2 text-xs"
    >
      <div
        data-cl-counts
        className="flex flex-wrap items-center gap-3 text-slate-300"
      >
        <span>
          <span className="font-semibold text-emerald-300">
            {data.converted.length}
          </span>{" "}
          converted
        </span>
        <span>
          <span className="font-semibold text-amber-300">
            {listedSkipped.length}
          </span>{" "}
          skipped
        </span>
      </div>

      {data.converted.length > 0 && (
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
            Converted ({data.converted.length})
          </summary>
          <ul className="px-3 py-2 space-y-1 font-mono text-emerald-200/90 break-all">
            {sortedConverted.map(
              (record: ConvertLosslessConvertedRecord) => (
                <li key={record.source}>
                  {basename(record.source)}
                  <span className="text-emerald-500">
                    {" → "}
                  </span>
                  {basename(record.destination)}
                </li>
              ),
            )}
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
            Skipped — {skipReasonLabel[group.reason]} (
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
