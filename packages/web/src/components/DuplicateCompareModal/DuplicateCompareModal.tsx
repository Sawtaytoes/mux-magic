import { Button } from "@charcuterie/ui"
import { useAtom, useSetAtom } from "jotai"
import { useState } from "react"

import { apiBase } from "../../apiBase"
import { audioPreviewModalAtom } from "../AudioPreviewModal/audioPreviewModalAtom"
import { DuplicateCopyRow } from "./DuplicateCopyRow"
import {
  duplicateCompareModalAtom,
  resolvedDuplicateFilePathsByJobIdAtom,
} from "./duplicateCompareModalAtom"
import {
  AUTO_CHECKED_MATCH_REASONS,
  DUPLICATE_MATCH_REASON_DESCRIPTIONS,
  DUPLICATE_MATCH_REASON_LABELS,
  type DuplicateGroup,
} from "./duplicateCompareTypes"

// The duplicate compare table. Rows are duplicate GROUPS; each row shows
// the copies side by side with the facts that decided which to keep, the
// recommendation pre-selected, and a human confirming or overriding it.
//
// ⚠️ Confirming MOVES the losing copies to a holding folder. It does not
// delete them. The music library lives on a share with no Recycle Bin,
// where a delete is effectively permanent inside the hour and the only
// safety net is the hourly ZFS snapshot — so the reversible action is
// the only one this surface offers.
//
// Two safety defaults, both deliberate:
//   - only "identical audio" groups start checked. A tag-only match is a
//     coincidence until a human looks at it.
//   - the holding folder must be filled in before Confirm does anything.

// Inside the library the copy would just be found again on the next run,
// so the default sits beside it rather than in it.
const DEFAULT_HOLDING_FOLDER_PLACEHOLDER =
  "/media/Duplicates-Holding"

type RowState = {
  error: string | null
  isIncluded: boolean
  isResolved: boolean
  keepFilePath: string
}

const buildInitialRows = (groups: DuplicateGroup[]) =>
  new Map(
    groups.map((group): [string, RowState] => [
      group.groupKey,
      {
        error: null,
        isIncluded: AUTO_CHECKED_MATCH_REASONS.includes(
          group.matchReason,
        ),
        isResolved: false,
        keepFilePath:
          group.copies.find(
            (copy) => copy.isRecommendedKeep,
          )?.filePath ??
          group.copies[0]?.filePath ??
          "",
      },
    ]),
  )

const DEFAULT_ROW_STATE: RowState = {
  error: null,
  isIncluded: false,
  isResolved: false,
  keepFilePath: "",
}

type ResolveResponseBody = {
  destination?: string | null
  error?: string | null
  isOk?: boolean
}

// One copy, one POST. Sequential, so a per-row failure lands on its own
// row instead of arriving as one opaque batch error.
const postCopyMove = ({
  filePath,
  holdingFolderPath,
  sourceRootPath,
}: {
  filePath: string
  holdingFolderPath: string
  sourceRootPath: string
}) =>
  fetch(`${apiBase}/music/duplicates/resolve`, {
    body: JSON.stringify({
      filePath,
      holdingFolderPath,
      sourceRootPath,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })
    .then((response) =>
      response
        .json()
        .catch(() => ({}))
        .then((rawBody) => rawBody as ResolveResponseBody)
        .then((body) => ({
          error:
            body.error ??
            (response.ok ? null : "Move failed"),
          isOk: response.ok && body.isOk !== false,
        })),
    )
    .catch((error: unknown) => ({
      error:
        error instanceof Error
          ? error.message
          : String(error),
      isOk: false,
    }))

export const DuplicateCompareModal = () => {
  const [state, setState] = useAtom(
    duplicateCompareModalAtom,
  )
  const setAudioPreview = useSetAtom(audioPreviewModalAtom)
  const setResolvedPaths = useSetAtom(
    resolvedDuplicateFilePathsByJobIdAtom,
  )

  const groups = state?.groups ?? []

  const [rows, setRows] = useState<Map<string, RowState>>(
    () => buildInitialRows(groups),
  )
  const [hasInitialized, setHasInitialized] = useState<
    string | null
  >(null)
  const [holdingFolderPath, setHoldingFolderPath] =
    useState("")
  const [isResolving, setIsResolving] = useState(false)

  // Re-seed the row map whenever the atom payload changes, the same
  // render-phase reset the tag table uses.
  const sessionKey = state
    ? `${state.jobId}:${state.stepId}`
    : null
  if (sessionKey !== hasInitialized) {
    setRows(buildInitialRows(groups))
    setHasInitialized(sessionKey)
  }

  if (state === null) {
    return null
  }

  const rowStateFor = (groupKey: string) =>
    rows.get(groupKey) ?? DEFAULT_ROW_STATE

  const close = () => {
    setState(null)
    setRows(new Map())
    setHasInitialized(null)
  }

  const updateRow = ({
    groupKey,
    patch,
  }: {
    groupKey: string
    patch: Partial<RowState>
  }) => {
    setRows((previousRows) =>
      previousRows.has(groupKey)
        ? new Map(previousRows).set(groupKey, {
            ...(previousRows.get(groupKey) ??
              DEFAULT_ROW_STATE),
            ...patch,
          })
        : previousRows,
    )
  }

  const includedGroups = groups.filter(
    (group) =>
      rowStateFor(group.groupKey).isIncluded &&
      !rowStateFor(group.groupKey).isResolved,
  )

  // Nothing to move without somewhere to move it TO. Deleting instead is
  // not an option this surface offers.
  const isConfirmEnabled =
    holdingFolderPath.trim().length > 0 &&
    includedGroups.length > 0 &&
    !isResolving

  const handleConfirm = async () => {
    setIsResolving(true)

    const movedFilePaths = await includedGroups.reduce<
      Promise<string[]>
    >(
      (previousPromise, group) =>
        previousPromise.then(async (movedSoFar) => {
          const keepFilePath = rowStateFor(
            group.groupKey,
          ).keepFilePath
          const outcomes = await group.copies
            .filter(
              (copy) => copy.filePath !== keepFilePath,
            )
            .reduce<
              Promise<
                { error: string | null; isOk: boolean }[]
              >
            >(
              (previousOutcomes, copy) =>
                previousOutcomes.then((outcomesSoFar) =>
                  postCopyMove({
                    filePath: copy.filePath,
                    holdingFolderPath:
                      holdingFolderPath.trim(),
                    sourceRootPath: state.sourcePath,
                  }).then((outcome) =>
                    outcomesSoFar.concat([outcome]),
                  ),
                ),
              Promise.resolve([]),
            )

          const failure = outcomes.find(
            (outcome) => !outcome.isOk,
          )
          updateRow({
            groupKey: group.groupKey,
            patch: {
              error: failure?.error ?? null,
              isResolved: failure === undefined,
            },
          })

          return failure === undefined
            ? movedSoFar.concat(
                group.copies
                  .filter(
                    (copy) =>
                      copy.filePath !== keepFilePath,
                  )
                  .map((copy) => copy.filePath),
              )
            : movedSoFar
        }),
      Promise.resolve([]),
    )

    setIsResolving(false)

    if (movedFilePaths.length > 0) {
      setResolvedPaths((previousPaths) =>
        new Map(previousPaths).set(
          state.jobId,
          (previousPaths.get(state.jobId) ?? []).concat(
            movedFilePaths,
          ),
        ),
      )
    }
  }

  return groups.length === 0 ? (
    <div
      role="none"
      id="duplicate-compare-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          close()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Duplicates — none found"
        className="bg-surface-raised border border-border-default rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 flex flex-col gap-3"
      >
        <h2 className="text-base font-semibold text-content-primary">
          No duplicates
        </h2>
        <p className="text-xs text-content-secondary">
          The scan found no duplicate audio files — nothing
          to review.
        </p>
        <div className="flex justify-end">
          <Button
            intent="neutral"
            appearance="soft"
            size="sm"
            onClick={close}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  ) : (
    <div
      role="none"
      id="duplicate-compare-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          close()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Duplicates — Review Copies"
        className="bg-surface-raised border border-border-default rounded-xl shadow-2xl w-full max-w-5xl mx-4 max-h-[90dvh] flex flex-col"
      >
        <div className="px-4 py-3 border-b border-border-default flex items-center gap-2">
          <h2 className="text-base font-semibold text-content-primary">
            Duplicates — Review Copies
          </h2>
          <span className="text-xs text-content-muted font-mono ms-auto">
            {groups.length} group
            {groups.length === 1 ? "" : "s"}
          </span>
        </div>

        <div
          data-duplicate-holding-note
          className="px-4 py-2 border-b border-border-default flex flex-wrap items-center gap-2"
        >
          <label
            htmlFor="duplicate-holding-folder"
            className="text-xs text-content-secondary"
          >
            Holding folder
          </label>
          <input
            id="duplicate-holding-folder"
            type="text"
            placeholder={DEFAULT_HOLDING_FOLDER_PLACEHOLDER}
            value={holdingFolderPath}
            onChange={(event) => {
              setHoldingFolderPath(event.target.value)
            }}
            className="min-w-64 rounded border border-border-default bg-surface-base px-2 py-1 text-xs font-mono text-content-primary focus:border-border-focus focus:outline-none"
          />
          <p className="text-xs text-content-secondary grow basis-64">
            Confirmed copies are <strong>moved</strong>{" "}
            here, never deleted. The library share has no
            Recycle Bin, so a move is what makes this
            reversible.
          </p>
        </div>

        <div className="overflow-auto px-4 py-3 flex flex-col gap-3">
          {groups.map((group) => {
            const rowState = rowStateFor(group.groupKey)
            return (
              <div
                key={group.groupKey}
                data-duplicate-group
                data-match-reason={group.matchReason}
                className="border border-border-default rounded-lg p-2 flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={rowState.isIncluded}
                      disabled={
                        rowState.isResolved || isResolving
                      }
                      onChange={(event) => {
                        updateRow({
                          groupKey: group.groupKey,
                          patch: {
                            isIncluded:
                              event.target.checked,
                          },
                        })
                      }}
                      aria-label={`Include ${group.groupKey}`}
                    />
                    <span>Include</span>
                  </label>
                  <span
                    data-duplicate-reason
                    className="text-xs font-medium"
                    title={
                      DUPLICATE_MATCH_REASON_DESCRIPTIONS[
                        group.matchReason
                      ]
                    }
                  >
                    {
                      DUPLICATE_MATCH_REASON_LABELS[
                        group.matchReason
                      ]
                    }
                  </span>
                  <span className="text-xs text-content-secondary">
                    {
                      DUPLICATE_MATCH_REASON_DESCRIPTIONS[
                        group.matchReason
                      ]
                    }
                  </span>
                  {rowState.isResolved && (
                    <span className="text-xs text-intent-success-content ms-auto">
                      Moved
                    </span>
                  )}
                </div>

                {group.copies.map((copy) => (
                  <DuplicateCopyRow
                    key={copy.filePath}
                    copy={copy}
                    isKept={
                      copy.filePath ===
                      rowState.keepFilePath
                    }
                    isReadOnly={
                      rowState.isResolved || isResolving
                    }
                    onPlay={() => {
                      setAudioPreview({
                        path: copy.filePath,
                      })
                    }}
                    onSelectKeep={() => {
                      updateRow({
                        groupKey: group.groupKey,
                        patch: {
                          keepFilePath: copy.filePath,
                        },
                      })
                    }}
                  />
                ))}

                {/* Why the recommendation went the way it did, so a
                    human can disagree on sight rather than trusting a
                    bare "recommended" badge. */}
                {group.copies
                  .filter(
                    (copy) =>
                      copy.rankReasons.length > 0 &&
                      copy.filePath ===
                        rowState.keepFilePath,
                  )
                  .map((copy) => (
                    <p
                      key={copy.filePath}
                      data-duplicate-rank-reasons
                      className="text-xs text-content-muted"
                    >
                      Kept because —{" "}
                      {copy.rankReasons.join(", ")}
                    </p>
                  ))}

                {rowState.error !== null && (
                  <p
                    data-duplicate-row-error
                    className="bg-intent-danger-surface border border-intent-danger-border text-intent-danger-content rounded px-2 py-1 text-xs"
                  >
                    {rowState.error}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-4 py-3 border-t border-border-default flex items-center gap-2">
          <span className="text-xs text-content-secondary">
            {includedGroups.length} group
            {includedGroups.length === 1 ? "" : "s"}{" "}
            selected
          </span>
          <Button
            intent="neutral"
            appearance="soft"
            size="sm"
            className="ms-auto"
            onClick={close}
          >
            Close
          </Button>
          <Button
            id="duplicate-compare-confirm"
            intent="accent"
            appearance="solid"
            size="sm"
            isDisabled={!isConfirmEnabled}
            onClick={handleConfirm}
          >
            {isResolving
              ? "Moving…"
              : "Move redundant copies"}
          </Button>
        </div>
      </div>
    </div>
  )
}
