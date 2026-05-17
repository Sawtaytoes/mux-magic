import { useAtom, useSetAtom } from "jotai"
import { useMemo, useState } from "react"
import { apiBase } from "../../apiBase"
import { videoPreviewModalAtom } from "../../components/VideoPreviewModal/videoPreviewModalAtom"
import { smartMatchModalAtom } from "./smartMatchModalAtom"
import {
  type FileSuggestion,
  LOW_CONFIDENCE_THRESHOLD,
  rankSuggestions,
} from "./smartMatchScoring"

// Per-row state the user can edit. Distinguishes "off by default for
// low confidence" (off) from explicitly skipped (off after toggle).
type RowState = {
  isIncluded: boolean
  selectedCandidateName: string
  error: string | null
  isApplied: boolean
}

const joinPath = (
  folder: string,
  filename: string,
): string => {
  const trimmed = folder.replace(/[\\/]+$/, "")
  const separator = trimmed.includes("\\") ? "\\" : "/"
  return `${trimmed}${separator}${filename}`
}

const extensionOf = (filename: string): string => {
  const match = filename.match(/\.[^.\\/]+$/)
  return match ? match[0] : ""
}

const ensureExtension = (
  desiredName: string,
  originalFilename: string,
): string => {
  const extension = extensionOf(originalFilename)
  if (
    extension.length > 0 &&
    desiredName
      .toLowerCase()
      .endsWith(extension.toLowerCase())
  ) {
    return desiredName
  }
  return `${desiredName}${extension}`
}

const formatDurationSeconds = (
  seconds: number | null,
): string => {
  if (seconds === null) return "—"
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`
}

const formatConfidence = (confidence: number): string => {
  return `${Math.round(confidence * 100)}%`
}

// Build the initial per-row map: low-confidence rows default to
// excluded so the user explicitly opts-in to a sketchy match.
const buildInitialRows = (
  suggestions: FileSuggestion[],
): Map<string, RowState> => {
  return new Map(
    suggestions.map((suggestion) => {
      const top = suggestion.rankedCandidates[0]
      const topName = top?.candidate.name ?? ""
      const isHighConfidence =
        top !== undefined &&
        top.confidence >= LOW_CONFIDENCE_THRESHOLD
      return [
        suggestion.filename,
        {
          isIncluded: isHighConfidence,
          selectedCandidateName: topName,
          error: null,
          isApplied: false,
        },
      ]
    }),
  )
}

export const SmartMatchModal = () => {
  const [state, setState] = useAtom(smartMatchModalAtom)
  const setVideoPreview = useSetAtom(videoPreviewModalAtom)

  const suggestions = useMemo<FileSuggestion[]>(
    () =>
      state === null
        ? []
        : rankSuggestions({
            candidates: state.candidates,
            unrenamedFiles: state.unrenamedFiles,
          }),
    [state],
  )

  const [rows, setRows] = useState<Map<string, RowState>>(
    () => buildInitialRows(suggestions),
  )
  const [hasInitialized, setHasInitialized] = useState<
    string | null
  >(null)
  const [isApplying, setIsApplying] = useState(false)

  // Reset row state every time the atom payload changes (new modal open).
  const sessionKey = state
    ? `${state.jobId}:${state.stepId}`
    : null
  if (sessionKey !== hasInitialized) {
    setRows(buildInitialRows(suggestions))
    setHasInitialized(sessionKey)
  }

  if (state === null) return null

  const close = () => {
    setState(null)
    setRows(new Map())
    setHasInitialized(null)
  }

  const updateRow = (
    filename: string,
    patch: Partial<RowState>,
  ) => {
    setRows((prev) => {
      const next = new Map(prev)
      const current = next.get(filename)
      if (!current) return prev
      next.set(filename, { ...current, ...patch })
      return next
    })
  }

  const handleApply = async () => {
    setIsApplying(true)
    const plans = suggestions
      .map((suggestion) => {
        const row = rows.get(suggestion.filename)
        if (!row?.isIncluded || row.isApplied) return null
        const desiredBase = row.selectedCandidateName.trim()
        if (desiredBase.length === 0) return null
        const finalName = ensureExtension(
          desiredBase,
          suggestion.filename,
        )
        return {
          filename: suggestion.filename,
          oldPath: joinPath(
            state.sourcePath,
            suggestion.filename,
          ),
          newPath: joinPath(state.sourcePath, finalName),
        }
      })
      .filter(
        (entry): entry is NonNullable<typeof entry> =>
          entry !== null,
      )

    // Sequential renames so we can update per-row status as we go and
    // avoid hammering the server with N parallel POSTs.
    const finalRows = await plans.reduce<
      Promise<Map<string, RowState>>
    >(async (previousPromise, plan) => {
      const accumulator = await previousPromise
      try {
        const response = await fetch(
          `${apiBase}/files/rename`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              oldPath: plan.oldPath,
              newPath: plan.newPath,
            }),
          },
        )
        const body = (await response
          .json()
          .catch(() => ({}))) as {
          isOk?: boolean
          error?: string
        }
        const isOk = response.ok && body.isOk !== false
        const next = new Map(accumulator)
        const current = next.get(plan.filename)
        if (current) {
          next.set(plan.filename, {
            ...current,
            isApplied: isOk,
            error: isOk
              ? null
              : (body.error ?? `HTTP ${response.status}`),
          })
        }
        return next
      } catch (fetchError) {
        const next = new Map(accumulator)
        const current = next.get(plan.filename)
        if (current) {
          next.set(plan.filename, {
            ...current,
            error: String(fetchError),
          })
        }
        return next
      }
    }, Promise.resolve(rows))

    setRows(finalRows)
    setIsApplying(false)

    // Close the modal only when every applied row succeeded. Failed
    // rows stay visible with their inline error so the user can react.
    const isAllDone = plans.every(
      (plan) => finalRows.get(plan.filename)?.isApplied,
    )
    if (isAllDone && plans.length > 0) {
      close()
    }
  }

  const includedCount = Array.from(rows.values()).filter(
    (row) => row.isIncluded && !row.isApplied,
  ).length

  if (suggestions.length === 0) {
    return (
      <div
        role="none"
        id="smart-match-modal"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
        onClick={(event) => {
          if (event.target === event.currentTarget) close()
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Smart Match — empty"
          className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 flex flex-col gap-3"
        >
          <h2 className="text-base font-semibold text-slate-100">
            No unnamed files
          </h2>
          <p className="text-xs text-slate-400">
            Every file was matched on the last run — nothing
            to fix.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={close}
              className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      role="none"
      id="smart-match-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Smart Match — Fix Unnamed"
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90dvh] flex flex-col"
      >
        <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-100">
            Smart Match — Fix Unnamed
          </h2>
          <span className="text-xs text-slate-500 font-mono ml-auto">
            {suggestions.length} file
            {suggestions.length === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={close}
            className="text-slate-400 hover:text-slate-200 text-xl leading-none px-1"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-3 flex-1 overflow-y-auto">
          <p className="text-xs text-slate-400 mb-3">
            Pick the candidate name for each leftover file
            and check the box to include it in the rename
            batch. Yellow rows are below{" "}
            {Math.round(LOW_CONFIDENCE_THRESHOLD * 100)}%
            confidence — review before applying.
          </p>
          <table className="w-full text-xs border-separate border-spacing-y-1.5">
            <thead className="text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-1 py-1 w-8 text-left">
                  Use
                </th>
                <th className="px-1 py-1 w-6"></th>
                <th className="px-2 py-1 text-left">
                  File
                </th>
                <th className="px-2 py-1 text-left">
                  Rename to
                </th>
                <th className="px-2 py-1 text-center w-20">
                  Confidence
                </th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((suggestion) => {
                const row = rows.get(suggestion.filename)
                if (!row) return null
                const topCandidate =
                  suggestion.rankedCandidates[0]
                const confidence =
                  topCandidate?.confidence ?? 0
                const isLowConfidence =
                  confidence < LOW_CONFIDENCE_THRESHOLD
                const rowClass = row.isApplied
                  ? "border border-emerald-700/60 bg-emerald-900/20"
                  : isLowConfidence
                    ? "border border-amber-600/50 bg-amber-900/20"
                    : "border border-slate-700 bg-slate-800/40"
                const badgeClass = isLowConfidence
                  ? "bg-amber-700 text-amber-100"
                  : "bg-emerald-700 text-emerald-100"
                return (
                  <tr
                    key={suggestion.filename}
                    data-smart-match-row={
                      suggestion.filename
                    }
                    className={rowClass}
                  >
                    <td className="px-1.5 py-1.5 align-top">
                      <input
                        type="checkbox"
                        aria-label={`Include ${suggestion.filename}`}
                        checked={row.isIncluded}
                        disabled={
                          row.isApplied || isApplying
                        }
                        onChange={(event) =>
                          updateRow(suggestion.filename, {
                            isIncluded:
                              event.target.checked,
                          })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1.5 align-top">
                      <button
                        type="button"
                        className="text-cyan-400 hover:text-cyan-300 text-[13px] leading-none font-medium px-1.5"
                        title="Preview this file"
                        onClick={() =>
                          setVideoPreview({
                            path: joinPath(
                              state.sourcePath,
                              suggestion.filename,
                            ),
                          })
                        }
                      >
                        ▶
                      </button>
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <div className="font-mono text-xs text-slate-100 wrap-break-word">
                        {suggestion.filename}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {formatDurationSeconds(
                          suggestion.durationSeconds,
                        )}
                      </div>
                      {row.error && (
                        <div className="text-[10px] font-mono mt-1 text-red-300">
                          {row.error}
                        </div>
                      )}
                      {row.isApplied && (
                        <div className="text-[10px] font-mono mt-1 text-emerald-300">
                          Renamed
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <select
                        aria-label={`Rename target for ${suggestion.filename}`}
                        value={row.selectedCandidateName}
                        disabled={
                          row.isApplied || isApplying
                        }
                        onChange={(event) =>
                          updateRow(suggestion.filename, {
                            selectedCandidateName:
                              event.target.value,
                          })
                        }
                        className="w-full text-xs font-mono bg-slate-950 text-slate-100 border border-slate-600 rounded px-1.5 py-1 focus:outline-none focus:border-blue-500"
                      >
                        {suggestion.rankedCandidates.map(
                          (scored) => (
                            <option
                              key={scored.candidate.name}
                              value={scored.candidate.name}
                            >
                              {scored.candidate.name} —{" "}
                              {formatConfidence(
                                scored.confidence,
                              )}
                            </option>
                          ),
                        )}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 align-top text-center">
                      <span
                        className={`inline-block text-[10px] font-mono px-1.5 py-0.5 rounded ${badgeClass}`}
                      >
                        {formatConfidence(confidence)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-slate-700 flex items-center justify-end gap-2">
          <span className="text-xs text-slate-400 mr-auto">
            {includedCount} file
            {includedCount === 1 ? "" : "s"} selected
          </span>
          <button
            type="button"
            onClick={close}
            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded"
          >
            Close
          </button>
          <button
            type="button"
            id="smart-match-apply"
            disabled={includedCount === 0 || isApplying}
            onClick={() => void handleApply()}
            className="text-xs bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded font-medium"
          >
            {isApplying ? "Renaming…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  )
}
