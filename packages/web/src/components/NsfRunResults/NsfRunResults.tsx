import { useSetAtom } from "jotai"
import { smartMatchModalAtom } from "../SmartMatchModal/smartMatchModalAtom"
import type {
  NsfRenamePair,
  NsfSummaryRecord,
} from "./findNsfResults"

// Post-run report for an NSF (nameSpecialFeaturesDvdCompareTmdb) job.
// Mirrors the legacy v1 builder's step-card output: "Renamed N. Files
// not renamed: M." counts + each oldName → newName pair in emerald
// font + a yellow block listing leftover filenames + the "✨ Fix
// Unnamed" trigger that opens the SmartMatchModal.
//
// Presentational only — the hosting component subscribes to the job's
// SSE stream, derives `renamePairs` / `summary` from `payload.results`
// at `isDone`, and resolves the linked `sourcePath` (the SmartMatch
// modal needs an absolute folder to build rename targets).
type Props = {
  jobId: string
  stepId: string
  sourcePath: string | null
  renamePairs: NsfRenamePair[]
  summary: NsfSummaryRecord | null
}

export const NsfRunResults = ({
  jobId,
  stepId,
  sourcePath,
  renamePairs,
  summary,
}: Props) => {
  const setSmartMatch = useSetAtom(smartMatchModalAtom)

  // Open Smart Match whenever leftover files exist — even with zero
  // DVDCompare candidates. Without candidates the modal renders the
  // leftover filenames as free-text rename rows; gating on
  // possibleNames.length > 0 previously hid the UI entirely when every
  // DVDCompare extra had a timecode.
  const isSmartMatchAvailable =
    summary !== null &&
    summary.unnamedFileCandidates !== undefined &&
    summary.unnamedFileCandidates.length > 0 &&
    sourcePath !== null

  const openSmartMatch = () => {
    if (!summary?.unnamedFileCandidates || !sourcePath) {
      return
    }
    setSmartMatch({
      jobId,
      stepId,
      sourcePath,
      // Worker 25: server already emits per-file ranked candidates,
      // so the modal receives them pre-scored. No client-side ranking.
      suggestions: summary.unnamedFileCandidates.map(
        (entry) => ({
          filename: entry.filename,
          extension: entry.extension ?? "",
          durationSeconds: entry.durationSeconds,
          rankedCandidates: entry.rankedCandidates,
        }),
      ),
    })
  }

  if (summary === null && renamePairs.length === 0) {
    return null
  }

  return (
    <div
      id="nsf-run-results"
      className="flex flex-col gap-2"
    >
      {summary && (
        <div
          data-nsf-rename-counts
          className="flex flex-wrap items-center gap-2 text-xs text-slate-300"
        >
          <span>
            Renamed {renamePairs.length}. Files not renamed:{" "}
            {summary.unrenamedFilenames.length}.
          </span>
          {isSmartMatchAvailable && (
            <button
              type="button"
              id="smart-match-trigger"
              onClick={openSmartMatch}
              className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded font-medium"
              title="Review and rename leftover files that didn't match by timecode"
            >
              ✨ Fix Unnamed
            </button>
          )}
        </div>
      )}
      {renamePairs.length > 0 && (
        <div
          data-nsf-rename-list
          className="font-mono text-xs flex flex-col gap-0.5"
        >
          {renamePairs.map((pair) => (
            <div
              key={`${pair.oldName}-${pair.newName}`}
              data-nsf-rename-pair
              className="flex flex-wrap items-baseline gap-1.5 wrap-break-word"
            >
              <span
                data-nsf-rename-old
                className="text-slate-400 line-through decoration-slate-600"
              >
                {pair.oldName}
              </span>
              <span aria-hidden className="text-slate-500">
                →
              </span>
              <span
                data-nsf-rename-new
                className="text-emerald-300"
              >
                {pair.newName}
              </span>
            </div>
          ))}
        </div>
      )}
      {summary && summary.unrenamedFilenames.length > 0 && (
        <div
          data-nsf-unrenamed-list
          className="bg-yellow-900/30 border border-yellow-700 text-yellow-100 rounded px-2 py-1.5 text-xs"
        >
          <p className="font-medium mb-1">
            Files not renamed:
          </p>
          <div className="font-mono wrap-break-word">
            {summary.unrenamedFilenames.map((filename) => (
              <div key={filename}>{filename}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
