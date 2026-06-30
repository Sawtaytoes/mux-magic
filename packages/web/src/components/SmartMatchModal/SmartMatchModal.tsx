import { useAtom, useSetAtom } from "jotai"
import { useState } from "react"
import { apiBase } from "../../apiBase"
import { videoPreviewModalAtom } from "../../components/VideoPreviewModal/videoPreviewModalAtom"
import { appliedSmartMatchRenamesByJobIdAtom } from "./appliedSmartMatchRenamesAtom"
import {
  buildRenameTarget,
  extractSuffixFromStem,
  inferSuffixFromName,
  PLEX_EXTRA_TYPES,
} from "./plexExtraTypes"
import { RenameTargetPicker } from "./RenameTargetPicker"
import { smartMatchModalAtom } from "./smartMatchModalAtom"
import {
  type FileSuggestion,
  LOW_CONFIDENCE_THRESHOLD,
  UNNAMED_FEATURES_BUCKET,
} from "./smartMatchTypes"

// Per-row state the user can edit. Distinguishes "off by default for
// low confidence" (off) from explicitly skipped (off after toggle).
type RowState = {
  isIncluded: boolean
  selectedCandidateName: string
  error: string | null
  // Worker 25: an Apply-time collision warning lives here so the user
  // sees inline which row conflicts with which other row. Cleared on
  // the next Apply attempt or on any row mutation.
  collisionWith: string | null
  isApplied: boolean
  // Worker 6f: ✏ toggle swaps the candidate picker for a free-text
  // input. Picker selection and typed name are TWO independent fields:
  // the picker selection is preserved while the user edits, and Apply
  // uses the typed value only while `isEditing` is true AND
  // `customName` is non-empty. Entering ✏ for the first time seeds
  // `customName` from `selectedCandidateName` so the user can
  // hand-edit the candidate text (the common case: fix a DVDCompare
  // typo) rather than retype the whole name. Toggling off RETAINS
  // `customName` so flipping back to the picker for a quick compare
  // doesn't lose typed work.
  isEditing: boolean
  customName: string
  // Worker 7a: selected Plex extra-type suffix for this row.
  // Empty string = "— no type —" (base name used as-is on Apply).
  // Pre-populated from extractSuffixFromStem(filename) on row init,
  // falling back to inferSuffixFromName(candidateName).
  plexSuffix: string
  // Set to true by the Apply pre-flight when this row is included,
  // not yet applied, has a non-empty effective name, but plexSuffix is ''.
  // Cleared when the user picks a suffix or on the next Apply attempt.
  hasNoTypeWarning: boolean
}

// Worker 6f: the effective rename target. Custom name wins only while
// the input is visible AND non-empty (legacy semantic); otherwise the
// picker selection is the source of truth. Zero-candidate rows have no
// picker and always treat `selectedCandidateName` as the typed value
// (the cell's text input writes there directly — see render).
const resolveDesiredName = (
  row: RowState,
  candidateCount: number,
) => {
  if (candidateCount === 0) {
    return row.selectedCandidateName
  }
  if (row.isEditing && row.customName.trim().length > 0) {
    return row.customName
  }
  return row.selectedCandidateName
}

const joinPath = (folder: string, filename: string) => {
  const trimmed = folder.replace(/[\\/]+$/, "")
  const separator = trimmed.includes("\\") ? "\\" : "/"
  return `${trimmed}${separator}${filename}`
}

// Worker 25: leftover files live at
// `<sourcePath>/UNNAMED-FEATURES/<filename><ext>` after NSF completes.
// The modal builds `oldPath` against that bucket; the rename POST
// moves the file back to `<sourcePath>/<newName><ext>` in one
// /files/rename call (the route already handles cross-folder
// fs.rename).
const buildBucketOldPath = (
  sourcePath: string,
  filename: string,
  extension: string,
) =>
  joinPath(
    joinPath(sourcePath, UNNAMED_FEATURES_BUCKET),
    `${filename}${extension}`,
  )

// Append the file's extension to `desiredName` unless the user
// already typed one. The extension comes from the server-side
// `UnrenamedFile.extension` field (e.g. ".mkv") — the FileInfo
// `filename` itself is extension-stripped upstream by
// `getLastItemInFilePath`, so we can't recover the extension from
// the filename alone. Empty `extension` (when the file has none) is
// a no-op.
const ensureExtension = (
  desiredName: string,
  extension: string,
) => {
  if (extension.length === 0) {
    return desiredName
  }
  if (
    desiredName
      .toLowerCase()
      .endsWith(extension.toLowerCase())
  ) {
    return desiredName
  }
  return `${desiredName}${extension}`
}

const formatDurationSeconds = (seconds: number | null) => {
  if (seconds === null) return "—"
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`
}

const formatConfidence = (confidence: number) => {
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
      // Worker 7a: derive the initial Plex suffix via a three-step cascade:
      // 1. The existing filename may already carry a suffix (re-run case).
      // 2. The candidate name may carry a core-applied suffix (e.g. a gallery
      //    whose candidate name ends in '-other', or a '-trailer' the core
      //    pipeline baked in) — extractSuffixFromStem handles this too.
      // 3. Keyword inference on the candidate name — returns '' when unknown,
      //    so unknown files start on '— no type —' and require user action.
      const initialPlexSuffix =
        extractSuffixFromStem(suggestion.filename) ||
        extractSuffixFromStem(topName) ||
        (topName.length > 0
          ? inferSuffixFromName(topName)
          : "")
      return [
        suggestion.filename,
        {
          isIncluded: isHighConfidence,
          selectedCandidateName: topName,
          error: null,
          collisionWith: null,
          isApplied: false,
          // Worker 6f: rows start in picker mode with an empty custom
          // slot. The zero-candidates branch ignores both fields and
          // writes its input directly to `selectedCandidateName`.
          isEditing: false,
          customName: "",
          plexSuffix: initialPlexSuffix,
          hasNoTypeWarning: false,
        },
      ]
    }),
  )
}

export const SmartMatchModal = () => {
  const [state, setState] = useAtom(smartMatchModalAtom)
  const setVideoPreview = useSetAtom(videoPreviewModalAtom)
  const setAppliedRenames = useSetAtom(
    appliedSmartMatchRenamesByJobIdAtom,
  )

  // Worker 25: suggestions arrive pre-ranked from the server payload —
  // the duration-weighted scorer + order tie-break runs in
  // `nameSpecialFeaturesDvdCompareTmdb.rankCandidates.ts` before the
  // summary event is emitted, so the modal is a pure presenter.
  const suggestions: FileSuggestion[] =
    state?.suggestions ?? []

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

  // Bulk include/exclude every row the user can still act on. Applied rows
  // are locked (their checkbox is disabled), so they're left untouched.
  const setAllIncluded = (isIncluded: boolean) => {
    setRows((prev) => {
      const next = new Map(prev)
      for (const [filename, current] of next.entries()) {
        if (current.isApplied) continue
        if (current.isIncluded === isIncluded) continue
        next.set(filename, { ...current, isIncluded })
      }
      return next
    })
  }

  const handleApply = async () => {
    const plans = suggestions
      .map((suggestion) => {
        const row = rows.get(suggestion.filename)
        if (!row?.isIncluded || row.isApplied) return null
        // Worker 6f: pull the effective name through the picker/custom
        // resolver so typed values win while ✏ is active.
        const resolvedBase = resolveDesiredName(
          row,
          suggestion.rankedCandidates.length,
        ).trim()
        if (resolvedBase.length === 0) return null
        // Worker 7a: compose the final rename target from the resolved
        // base name and the per-row Plex suffix. buildRenameTarget strips
        // any existing suffix off the base before appending the selected
        // one, so the result never carries a double suffix even when the
        // user typed a name that already ends in a Plex slug.
        const desiredBase = buildRenameTarget(
          resolvedBase,
          row.plexSuffix,
        )
        // Both sides must include the file's extension. The server's
        // FileInfo.filename is extension-stripped; appending
        // `suggestion.extension` restores the on-disk path.
        const finalName = ensureExtension(
          desiredBase,
          suggestion.extension,
        )
        return {
          filename: suggestion.filename,
          // Stem of the typed/picked rename target (no extension).
          // Used after the POST succeeds to record an
          // `{oldName, newName}` pair in
          // `appliedSmartMatchRenamesByJobIdAtom` — same shape NSF
          // emits on its own renames, so the step card can merge the
          // two streams without special-casing.
          newName: desiredBase,
          // Worker 25: file lives in UNNAMED-FEATURES/ after NSF
          // completes. The /files/rename route handles cross-folder
          // fs.rename, so the move-back-to-sourcePath happens in the
          // same POST as the rename.
          oldPath: buildBucketOldPath(
            state.sourcePath,
            suggestion.filename,
            suggestion.extension,
          ),
          newPath: joinPath(state.sourcePath, finalName),
        }
      })
      .filter(
        (entry): entry is NonNullable<typeof entry> =>
          entry !== null,
      )

    // Clear any prior no-type warnings on rows that now have a suffix
    // (user picked a type since the last blocked Apply attempt).
    setRows((prev) => {
      const next = new Map(prev)
      for (const [filename, current] of next.entries()) {
        if (
          current.hasNoTypeWarning &&
          current.plexSuffix.length > 0
        ) {
          next.set(filename, {
            ...current,
            hasNoTypeWarning: false,
          })
        }
      }
      return next
    })

    // Pre-flight: every included, unapplied row with a non-empty effective
    // name must have a non-empty plexSuffix (per the 2026-06-30 decision:
    // unknown type → blocked, user must pick). Surface a warning in the row
    // and return without firing any POSTs.
    const noTypePlans = plans.filter(
      (plan) => rows.get(plan.filename)?.plexSuffix === "",
    )
    if (noTypePlans.length > 0) {
      setRows((prev) => {
        const next = new Map(prev)
        for (const plan of noTypePlans) {
          const current = next.get(plan.filename)
          if (!current) continue
          next.set(plan.filename, {
            ...current,
            hasNoTypeWarning: true,
          })
        }
        return next
      })
      return
    }

    // Worker 25: Apply-time collision detection. If two-or-more
    // checked rows would produce the same `newPath`, halt the Apply
    // and surface inline collision warnings on each conflicting row
    // with the colliding row's filename. Apply only proceeds when no
    // collisions remain. Pattern mirrors worker 66's pre-flight
    // collision detection in renameFiles.
    const collisionByPath = plans.reduce(
      (acc, plan) =>
        acc.set(
          plan.newPath,
          (acc.get(plan.newPath) ?? []).concat(
            plan.filename,
          ),
        ),
      new Map<string, string[]>(),
    )
    const collisions = new Map<string, string[]>(
      Array.from(collisionByPath.entries()).filter(
        ([, filenames]) => filenames.length > 1,
      ),
    )
    if (collisions.size > 0) {
      setRows((prev) => {
        const next = new Map(prev)
        for (const filenames of collisions.values()) {
          for (const filename of filenames) {
            const current = next.get(filename)
            if (!current) continue
            const others = filenames.filter(
              (other) => other !== filename,
            )
            next.set(filename, {
              ...current,
              collisionWith: others.join(", "),
            })
          }
        }
        return next
      })
      return
    }

    // Clear any prior collision warnings now that the plan is clean.
    setRows((prev) => {
      const next = new Map(prev)
      for (const [filename, current] of next.entries()) {
        if (current.collisionWith !== null) {
          next.set(filename, {
            ...current,
            collisionWith: null,
          })
        }
      }
      return next
    })
    setIsApplying(true)

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

    // Bubble successful renames out to the step card so the emerald
    // "old → new" list grows, "Files not renamed:" shrinks, and a
    // re-open of Smart Match doesn't re-list the same files. Keyed by
    // the current jobId so multiple in-flight NSF runs don't trample
    // each other's applied state.
    const successfulRenames = plans
      .filter(
        (plan) => finalRows.get(plan.filename)?.isApplied,
      )
      .map((plan) => ({
        oldName: plan.filename,
        newName: plan.newName,
      }))
    if (successfulRenames.length > 0) {
      setAppliedRenames((prev) => {
        const next = new Map(prev)
        const existing = next.get(state.jobId) ?? []
        next.set(
          state.jobId,
          existing.concat(successfulRenames),
        )
        return next
      })
    }

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

  // Header "select all" checkbox state. Only rows the user can still act on
  // (not yet applied) count toward the tri-state. Clicking clears all when
  // anything is selected (the "uncheck all" the user wanted) and selects all
  // otherwise — so a single click resolves either direction.
  const eligibleRows = Array.from(rows.values()).filter(
    (row) => !row.isApplied,
  )
  const isSomeEligibleIncluded = eligibleRows.some(
    (row) => row.isIncluded,
  )
  const isAllEligibleIncluded =
    eligibleRows.length > 0 &&
    eligibleRows.every((row) => row.isIncluded)

  // Apply is blocked when any included, unapplied row that has a non-empty
  // effective name is still on '— no type —'. We use `rows` + `suggestions`
  // together so we can call resolveDesiredName (needs the candidate count).
  const hasIncludedRowWithNoType = suggestions.some(
    (suggestion) => {
      const row = rows.get(suggestion.filename)
      if (!row?.isIncluded || row.isApplied) {
        return false
      }
      const resolvedBase = resolveDesiredName(
        row,
        suggestion.rankedCandidates.length,
      ).trim()
      return (
        resolvedBase.length > 0 && row.plexSuffix === ""
      )
    },
  )

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
                  <div className="flex flex-col items-start gap-0.5">
                    <input
                      type="checkbox"
                      aria-label={
                        isSomeEligibleIncluded
                          ? "Uncheck all"
                          : "Select all"
                      }
                      title={
                        isSomeEligibleIncluded
                          ? "Uncheck all"
                          : "Select all"
                      }
                      ref={(node) => {
                        if (node) {
                          node.indeterminate =
                            isSomeEligibleIncluded &&
                            !isAllEligibleIncluded
                        }
                      }}
                      checked={isAllEligibleIncluded}
                      disabled={
                        isApplying ||
                        eligibleRows.length === 0
                      }
                      onChange={() =>
                        setAllIncluded(
                          !isSomeEligibleIncluded,
                        )
                      }
                    />
                    <span className="normal-case">Use</span>
                  </div>
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
                const selectedCandidate =
                  suggestion.rankedCandidates.find(
                    (scoredCandidate) =>
                      scoredCandidate.candidate.name ===
                      row.selectedCandidateName,
                  ) ?? suggestion.rankedCandidates[0]
                const confidence =
                  selectedCandidate?.confidence ?? 0
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
                            // Worker 25: the file lives in
                            // UNNAMED-FEATURES/ after NSF completes;
                            // build the preview path against the bucket.
                            path: buildBucketOldPath(
                              state.sourcePath,
                              suggestion.filename,
                              suggestion.extension,
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
                      {row.collisionWith && (
                        <div
                          data-smart-match-collision
                          className="text-[10px] font-mono mt-1 text-amber-300"
                        >
                          Same target as:{" "}
                          {row.collisionWith}
                        </div>
                      )}
                      {row.hasNoTypeWarning && (
                        <div
                          data-smart-match-no-type-warning
                          className="text-[10px] font-mono mt-1 text-amber-300"
                        >
                          Pick a Plex type before applying.
                        </div>
                      )}
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
                      {/* Worker 7a: derive the effective name for the
                          suffix-row visibility check — mirrors resolveDesiredName
                          but used here purely to hide/show the suffix row. */}
                      {(() => {
                        const effectiveName =
                          resolveDesiredName(
                            row,
                            suggestion.rankedCandidates
                              .length,
                          ).trim()
                        const hasSuffixRow =
                          effectiveName.length > 0
                        return (
                          hasSuffixRow && (
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <label
                                htmlFor={`plex-suffix-${suggestion.filename}`}
                                className="text-[10px] text-slate-400 whitespace-nowrap shrink-0"
                              >
                                Plex type:
                              </label>
                              <select
                                id={`plex-suffix-${suggestion.filename}`}
                                data-plex-suffix-select={
                                  suggestion.filename
                                }
                                value={row.plexSuffix}
                                disabled={
                                  row.isApplied ||
                                  isApplying
                                }
                                onChange={(event) =>
                                  updateRow(
                                    suggestion.filename,
                                    {
                                      plexSuffix:
                                        event.target.value,
                                    },
                                  )
                                }
                                className="text-[10px] font-mono bg-slate-950 text-slate-100 border border-slate-600 rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {PLEX_EXTRA_TYPES.map(
                                  (plexType) => (
                                    <option
                                      key={plexType.suffix}
                                      value={
                                        plexType.suffix
                                      }
                                    >
                                      {plexType.label}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                          )
                        )
                      })()}
                      <div className="flex items-start gap-1.5">
                        <div className="flex-1 min-w-0">
                          {suggestion.rankedCandidates
                            .length === 0 ? (
                            <input
                              type="text"
                              aria-label={`Rename target for ${suggestion.filename}`}
                              placeholder="Type a new name…"
                              value={
                                row.selectedCandidateName
                              }
                              disabled={
                                row.isApplied || isApplying
                              }
                              onChange={(event) =>
                                updateRow(
                                  suggestion.filename,
                                  {
                                    selectedCandidateName:
                                      event.target.value,
                                    isIncluded:
                                      event.target.value.trim()
                                        .length > 0,
                                  },
                                )
                              }
                              className="w-full text-xs font-mono bg-slate-950 text-slate-100 border border-slate-600 rounded px-1.5 py-1 focus:outline-none focus:border-blue-500"
                            />
                          ) : row.isEditing ? (
                            <input
                              type="text"
                              data-smart-match-custom-input={
                                suggestion.filename
                              }
                              aria-label={`Custom rename target for ${suggestion.filename}`}
                              placeholder="Type a custom name…"
                              value={row.customName}
                              disabled={
                                row.isApplied || isApplying
                              }
                              onChange={(event) =>
                                updateRow(
                                  suggestion.filename,
                                  {
                                    customName:
                                      event.target.value,
                                    // Worker 6f: typing in ✏ mode opts
                                    // the row in (matches the
                                    // zero-candidates branch's UX) but
                                    // does NOT flip off on empty — the
                                    // picker selection may still be a
                                    // valid include target.
                                    isIncluded:
                                      event.target.value.trim()
                                        .length > 0 ||
                                      row.isIncluded,
                                  },
                                )
                              }
                              onKeyDown={(event) => {
                                // Worker 6f: legacy v1 commit-on-Enter
                                // — blur the input so the user can tab
                                // through to Apply without an extra
                                // click. Doesn't toggle ✏ off; typed
                                // value stays the active rename target.
                                if (event.key === "Enter") {
                                  event.preventDefault()
                                  event.currentTarget.blur()
                                }
                              }}
                              className="w-full text-xs font-mono bg-slate-950 text-slate-100 border border-blue-500 rounded px-1.5 py-1 focus:outline-none"
                            />
                          ) : (
                            <RenameTargetPicker
                              candidates={
                                suggestion.rankedCandidates
                              }
                              selectedName={
                                row.selectedCandidateName
                              }
                              onSelect={(name) =>
                                updateRow(
                                  suggestion.filename,
                                  {
                                    selectedCandidateName:
                                      name,
                                  },
                                )
                              }
                              isDisabled={
                                row.isApplied || isApplying
                              }
                              ariaLabel={`Rename target for ${suggestion.filename}`}
                            />
                          )}
                        </div>
                        {/* Worker 6f: ✏ toggle only renders when candidates
                            exist — the zero-candidates branch already shows
                            a text input, so there's nothing to swap back to.
                            Icon mirrors legacy v1: ✏ enters edit, ↩ returns
                            to the picker. `customName` is retained across
                            toggles (hybrid: legacy fields, doc retention). */}
                        {suggestion.rankedCandidates
                          .length > 0 && (
                          <button
                            type="button"
                            data-smart-match-edit-toggle={
                              suggestion.filename
                            }
                            aria-label={
                              row.isEditing
                                ? `Use candidate picker for ${suggestion.filename}`
                                : `Type a custom name for ${suggestion.filename}`
                            }
                            aria-pressed={row.isEditing}
                            title={
                              row.isEditing
                                ? "Back to selection"
                                : "Enter a custom name"
                            }
                            disabled={
                              row.isApplied || isApplying
                            }
                            onClick={() => {
                              // Seed `customName` from the picker
                              // selection on first ✏ entry so the user
                              // can hand-edit the candidate text (e.g.
                              // strip a "(0:33" typo from a DVDCompare
                              // entry) instead of retyping the whole
                              // name. Only seeds when empty so an
                              // already-typed value survives an
                              // off-then-on round-trip (legacy v1
                              // hybrid retention contract — see test
                              // "toggling ✏ off retains the typed
                              // value for the next toggle").
                              const isEnteringEdit =
                                !row.isEditing
                              const isSeedingCustomName =
                                isEnteringEdit &&
                                row.customName.length === 0
                              updateRow(
                                suggestion.filename,
                                {
                                  isEditing: isEnteringEdit,
                                  ...(isSeedingCustomName && {
                                    customName:
                                      row.selectedCandidateName,
                                  }),
                                },
                              )
                            }}
                            className="text-cyan-400 hover:text-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-[13px] leading-none font-medium px-1.5 py-1"
                          >
                            {row.isEditing ? "↩" : "✏"}
                          </button>
                        )}
                      </div>
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
            disabled={
              includedCount === 0 ||
              isApplying ||
              hasIncludedRowWithNoType
            }
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
