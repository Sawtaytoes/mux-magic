import { Button, IconButton, Picker } from "@charcuterie/ui"
import { useAtom, useSetAtom } from "jotai"
import { Fragment, useState } from "react"
import { apiBase } from "../../apiBase"
import { audioPreviewModalAtom } from "../AudioPreviewModal/audioPreviewModalAtom"
import { ReleaseCandidatePicker } from "./ReleaseCandidatePicker"
import {
  formatTagValue,
  parseTagFieldText,
  TagFieldDiff,
} from "./TagFieldDiff"
import {
  appliedTagWritesByJobIdAtom,
  tagMatchModalAtom,
} from "./tagMatchModalAtom"
import {
  AUDIO_TAG_FIELD_LABELS,
  AUDIO_TAG_FIELD_NAMES,
  type AudioTagFieldName,
  type AudioTagSet,
  FILE_LOOKUP_THRESHOLD,
  type TagMatchFile,
  TRACK_MATCHING_THRESHOLD,
} from "./tagMatchTypes"

// A SmartMatch row commits one filename. A music row commits many
// fields, so the per-row state carries a whole tag set: the candidate's
// `proposedTags` with the user's per-field overrides layered on top.
type RowState = {
  isIncluded: boolean
  selectedReleaseId: string
  editedTags: AudioTagSet
  error: string | null
  isApplied: boolean
  isExpanded: boolean
}

const DEFAULT_ROW_STATE: RowState = {
  isIncluded: false,
  selectedReleaseId: "",
  editedTags: {},
  error: null,
  isApplied: false,
  isExpanded: false,
}

const formatDurationSeconds = (seconds: number | null) =>
  seconds === null
    ? "—"
    : `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`

const formatConfidence = (confidence: number) =>
  `${Math.round(confidence * 100)}%`

const findSelectedCandidate = ({
  file,
  selectedReleaseId,
}: {
  file: TagMatchFile
  selectedReleaseId: string
}) =>
  file.rankedCandidates.find(
    (scored) =>
      scored.candidate.releaseId === selectedReleaseId,
  ) ??
  file.rankedCandidates[0] ??
  null

const getRowConfidence = ({
  file,
  rowState,
}: {
  file: TagMatchFile
  rowState: RowState
}) =>
  findSelectedCandidate({
    file,
    selectedReleaseId: rowState.selectedReleaseId,
  })?.confidence ?? 0

// The tag set the row would write: the selected release's proposal,
// with the user's per-field edits on top.
const getEffectiveTags = ({
  file,
  rowState,
}: {
  file: TagMatchFile
  rowState: RowState
}): AudioTagSet => ({
  ...(findSelectedCandidate({
    file,
    selectedReleaseId: rowState.selectedReleaseId,
  })?.proposedTags ?? {}),
  ...rowState.editedTags,
})

const getEffectiveFieldText = ({
  fieldName,
  file,
  rowState,
}: {
  fieldName: AudioTagFieldName
  file: TagMatchFile
  rowState: RowState
}) =>
  formatTagValue(
    getEffectiveTags({ file, rowState })[fieldName],
  )

const isRowEditable = ({
  isApplying,
  rowState,
}: {
  isApplying: boolean
  rowState: RowState
}) => !rowState.isApplied && !isApplying

const isRowAffectedByReplace = ({
  fieldName,
  file,
  rowState,
  searchText,
}: {
  fieldName: AudioTagFieldName
  file: TagMatchFile
  rowState: RowState
  searchText: string
}) =>
  searchText.length > 0 &&
  rowState.isIncluded &&
  !rowState.isApplied &&
  getEffectiveFieldText({
    fieldName,
    file,
    rowState,
  }).includes(searchText)

// Rows at or above Picard's `file_lookup_threshold` (0.7) start
// checked. Rows below `track_matching_threshold` (0.4) are unmatched.
const buildInitialRows = (files: TagMatchFile[]) =>
  new Map(
    files.map((file): [string, RowState] => [
      file.filePath,
      {
        isIncluded:
          (file.rankedCandidates[0]?.confidence ?? 0) >=
          FILE_LOOKUP_THRESHOLD,
        selectedReleaseId:
          file.rankedCandidates[0]?.candidate.releaseId ??
          "",
        editedTags: {},
        error: null,
        isApplied: false,
        isExpanded: false,
      },
    ]),
  )

const setRowResult = ({
  error,
  filePath,
  isOk,
  rowsAccumulator,
}: {
  error: string | null
  filePath: string
  isOk: boolean
  rowsAccumulator: Map<string, RowState>
}) =>
  new Map(rowsAccumulator).set(filePath, {
    ...(rowsAccumulator.get(filePath) ?? DEFAULT_ROW_STATE),
    isApplied: isOk,
    error,
  })

// Drops the empty entries a half-typed multi-value field leaves
// behind, so "Ambient, " never writes an empty genre.
const toWritableTags = (tags: AudioTagSet) =>
  Object.fromEntries(
    Object.entries(tags).map(([fieldName, value]) => [
      fieldName,
      Array.isArray(value)
        ? value.filter((entry) => entry.trim().length > 0)
        : value,
    ]),
  ) as AudioTagSet

type TagWritePlan = {
  filePath: string
  tags: AudioTagSet
}

// One row, one POST. The endpoint is owned by the music-tagging API
// worker; this modal only calls it.
const postRowTags = ({
  plan,
  rowsAccumulator,
}: {
  plan: TagWritePlan
  rowsAccumulator: Map<string, RowState>
}) =>
  fetch(`${apiBase}/music/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filePath: plan.filePath,
      tags: plan.tags,
    }),
  })
    .then((response) =>
      response
        .json()
        .catch(() => ({}))
        .then((rawBody) => rawBody as TagWriteResponseBody)
        .then((body) =>
          setRowResult({
            rowsAccumulator,
            filePath: plan.filePath,
            isOk: response.ok && body.isOk !== false,
            error:
              response.ok && body.isOk !== false
                ? null
                : (body.error ?? `HTTP ${response.status}`),
          }),
        ),
    )
    .catch((fetchError: unknown) =>
      setRowResult({
        rowsAccumulator,
        filePath: plan.filePath,
        isOk: false,
        error: String(fetchError),
      }),
    )

type TagWriteResponseBody = {
  isOk?: boolean
  error?: string
}

const TAG_FIELD_OPTIONS = AUDIO_TAG_FIELD_NAMES.map(
  (fieldName) => ({
    label: AUDIO_TAG_FIELD_LABELS[fieldName],
    value: fieldName,
  }),
)

export const TagMatchModal = () => {
  const [state, setState] = useAtom(tagMatchModalAtom)
  const setAudioPreview = useSetAtom(audioPreviewModalAtom)
  const setAppliedTagWrites = useSetAtom(
    appliedTagWritesByJobIdAtom,
  )

  const files = state?.files ?? []

  const [rows, setRows] = useState<Map<string, RowState>>(
    () => buildInitialRows(files),
  )
  const [hasInitialized, setHasInitialized] = useState<
    string | null
  >(null)
  const [isApplying, setIsApplying] = useState(false)
  const [isBulkEditVisible, setIsBulkEditVisible] =
    useState(false)
  const [bulkFieldName, setBulkFieldName] =
    useState<AudioTagFieldName>("albumArtist")
  const [bulkValueText, setBulkValueText] = useState("")
  const [replaceFieldName, setReplaceFieldName] =
    useState<AudioTagFieldName>("artist")
  const [searchText, setSearchText] = useState("")
  const [replacementText, setReplacementText] = useState("")

  // Re-seed the row map whenever the atom payload changes, the same
  // render-phase reset SmartMatchModal uses.
  const sessionKey = state
    ? `${state.jobId}:${state.stepId}`
    : null
  if (sessionKey !== hasInitialized) {
    setRows(buildInitialRows(files))
    setHasInitialized(sessionKey)
  }

  if (state === null) {
    return null
  }

  const rowStateFor = (filePath: string) =>
    rows.get(filePath) ?? DEFAULT_ROW_STATE

  const close = () => {
    setState(null)
    setRows(new Map())
    setHasInitialized(null)
  }

  const updateRow = ({
    filePath,
    patch,
  }: {
    filePath: string
    patch: Partial<RowState>
  }) => {
    setRows((previousRows) =>
      previousRows.has(filePath)
        ? new Map(previousRows).set(filePath, {
            ...(previousRows.get(filePath) ??
              DEFAULT_ROW_STATE),
            ...patch,
          })
        : previousRows,
    )
  }

  const setAllIncluded = (isIncluded: boolean) => {
    setRows(
      (previousRows) =>
        new Map(
          Array.from(previousRows.entries()).map(
            ([filePath, rowState]): [string, RowState] =>
              rowState.isApplied
                ? [filePath, rowState]
                : [filePath, { ...rowState, isIncluded }],
          ),
        ),
    )
  }

  // MP3Tag behaviour 1: set one field on every included row at once,
  // with no MusicBrainz match behind it.
  const applyBulkFieldValue = () => {
    setRows(
      (previousRows) =>
        new Map(
          Array.from(previousRows.entries()).map(
            ([filePath, rowState]): [string, RowState] =>
              rowState.isIncluded && !rowState.isApplied
                ? [
                    filePath,
                    {
                      ...rowState,
                      editedTags: {
                        ...rowState.editedTags,
                        [bulkFieldName]: parseTagFieldText({
                          fieldName: bulkFieldName,
                          text: bulkValueText,
                        }),
                      },
                    },
                  ]
                : [filePath, rowState],
          ),
        ),
    )
  }

  // MP3Tag behaviour 2: find and replace across one field, over the
  // included rows only.
  const applyFindAndReplace = () => {
    setRows(
      (previousRows) =>
        new Map(
          files.map((file): [string, RowState] =>
            isRowAffectedByReplace({
              fieldName: replaceFieldName,
              file,
              rowState:
                previousRows.get(file.filePath) ??
                DEFAULT_ROW_STATE,
              searchText,
            })
              ? [
                  file.filePath,
                  {
                    ...(previousRows.get(file.filePath) ??
                      DEFAULT_ROW_STATE),
                    editedTags: {
                      ...(previousRows.get(file.filePath)
                        ?.editedTags ?? {}),
                      [replaceFieldName]: parseTagFieldText(
                        {
                          fieldName: replaceFieldName,
                          text: getEffectiveFieldText({
                            fieldName: replaceFieldName,
                            file,
                            rowState:
                              previousRows.get(
                                file.filePath,
                              ) ?? DEFAULT_ROW_STATE,
                          })
                            .split(searchText)
                            .join(replacementText),
                        },
                      ),
                    },
                  },
                ]
              : [
                  file.filePath,
                  previousRows.get(file.filePath) ??
                    DEFAULT_ROW_STATE,
                ],
          ),
        ),
    )
  }

  const handleApply = async () => {
    const plans: TagWritePlan[] = files
      .filter(
        (file) =>
          rowStateFor(file.filePath).isIncluded &&
          !rowStateFor(file.filePath).isApplied,
      )
      .map((file) => ({
        filePath: file.filePath,
        tags: toWritableTags(
          getEffectiveTags({
            file,
            rowState: rowStateFor(file.filePath),
          }),
        ),
      }))

    setIsApplying(true)

    // Sequential so per-row status lands as it goes and the server is
    // not hit with N parallel POSTs.
    const finalRows = await plans.reduce<
      Promise<Map<string, RowState>>
    >(
      (previousPromise, plan) =>
        previousPromise.then((rowsAccumulator) =>
          postRowTags({ plan, rowsAccumulator }),
        ),
      Promise.resolve(rows),
    )

    setRows(finalRows)
    setIsApplying(false)

    const successfulWrites = plans.filter(
      (plan) => finalRows.get(plan.filePath)?.isApplied,
    )
    if (successfulWrites.length > 0) {
      setAppliedTagWrites((previousWrites) =>
        new Map(previousWrites).set(
          state.jobId,
          (previousWrites.get(state.jobId) ?? []).concat(
            successfulWrites,
          ),
        ),
      )
    }

    const isEveryRowApplied = plans.every(
      (plan) => finalRows.get(plan.filePath)?.isApplied,
    )
    if (isEveryRowApplied && plans.length > 0) {
      close()
    }
  }

  const eligibleRows = Array.from(rows.values()).filter(
    (rowState) => !rowState.isApplied,
  )
  const isSomeEligibleIncluded = eligibleRows.some(
    (rowState) => rowState.isIncluded,
  )
  const isAllEligibleIncluded =
    eligibleRows.length > 0 &&
    eligibleRows.every((rowState) => rowState.isIncluded)
  const includedCount = eligibleRows.filter(
    (rowState) => rowState.isIncluded,
  ).length

  const affectedRowCount = files.filter((file) =>
    isRowAffectedByReplace({
      fieldName: replaceFieldName,
      file,
      rowState: rowStateFor(file.filePath),
      searchText,
    }),
  ).length

  return files.length === 0 ? (
    <div
      role="none"
      id="tag-match-modal"
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
        aria-label="Tag Match — empty"
        className="bg-surface-raised border border-border-default rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 flex flex-col gap-3"
      >
        <h2 className="text-base font-semibold text-content-primary">
          No audio files
        </h2>
        <p className="text-xs text-content-secondary">
          The scan found no audio files to tag — nothing to
          review.
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
      id="tag-match-modal"
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
        aria-label="Tag Match — Review Tags"
        className="bg-surface-raised border border-border-default rounded-xl shadow-2xl w-full max-w-5xl mx-4 max-h-[90dvh] flex flex-col"
      >
        <div className="px-4 py-3 border-b border-border-default flex items-center gap-2">
          <h2 className="text-base font-semibold text-content-primary">
            Tag Match — Review Tags
          </h2>
          <span className="text-xs text-content-muted font-mono ms-auto">
            {files.length} file
            {files.length === 1 ? "" : "s"}
          </span>
          <Button
            data-tag-match-bulk-toggle
            intent="neutral"
            appearance="soft"
            size="sm"
            aria-expanded={isBulkEditVisible}
            onClick={() => {
              setIsBulkEditVisible(
                (isCurrentlyVisible) => !isCurrentlyVisible,
              )
            }}
          >
            Bulk edit
          </Button>
          <IconButton
            label="Close"
            title="Close"
            intent="neutral"
            appearance="ghost"
            size="sm"
            onClick={close}
          >
            ✕
          </IconButton>
        </div>

        {isBulkEditVisible ? (
          <div
            data-tag-match-bulk-panel
            className="px-4 py-3 border-b border-border-default flex flex-col gap-3 bg-surface-sunken"
          >
            <div className="flex flex-wrap items-end gap-2">
              <Picker
                label="Bulk field"
                onChange={(fieldName) => {
                  setBulkFieldName(
                    fieldName as AudioTagFieldName,
                  )
                }}
                options={TAG_FIELD_OPTIONS}
                size="sm"
                value={bulkFieldName}
              />
              <input
                type="text"
                aria-label="Bulk value"
                placeholder="Value for every included row…"
                value={bulkValueText}
                onChange={(event) => {
                  setBulkValueText(event.target.value)
                }}
                className="flex-1 min-w-40 rounded border border-border-default bg-surface-base px-2 py-1 text-xs font-mono text-content-primary focus:border-border-focus focus:outline-none"
              />
              <Button
                data-tag-match-bulk-apply
                intent="info"
                appearance="soft"
                size="sm"
                isDisabled={
                  includedCount === 0 || isApplying
                }
                onClick={applyBulkFieldValue}
              >
                Apply to {includedCount} included row
                {includedCount === 1 ? "" : "s"}
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Picker
                label="Replace in field"
                onChange={(fieldName) => {
                  setReplaceFieldName(
                    fieldName as AudioTagFieldName,
                  )
                }}
                options={TAG_FIELD_OPTIONS}
                size="sm"
                value={replaceFieldName}
              />
              <input
                type="text"
                aria-label="Find text"
                placeholder="Find…"
                value={searchText}
                onChange={(event) => {
                  setSearchText(event.target.value)
                }}
                className="w-40 rounded border border-border-default bg-surface-base px-2 py-1 text-xs font-mono text-content-primary focus:border-border-focus focus:outline-none"
              />
              <input
                type="text"
                aria-label="Replace text"
                placeholder="Replace with…"
                value={replacementText}
                onChange={(event) => {
                  setReplacementText(event.target.value)
                }}
                className="w-40 rounded border border-border-default bg-surface-base px-2 py-1 text-xs font-mono text-content-primary focus:border-border-focus focus:outline-none"
              />
              <span
                data-tag-match-replace-preview
                className="text-xs text-content-secondary font-mono"
              >
                {affectedRowCount} row
                {affectedRowCount === 1 ? "" : "s"} affected
              </span>
              <Button
                data-tag-match-replace-apply
                intent="info"
                appearance="soft"
                size="sm"
                isDisabled={
                  affectedRowCount === 0 || isApplying
                }
                onClick={applyFindAndReplace}
              >
                Replace
              </Button>
            </div>
          </div>
        ) : null}

        <div className="px-4 py-3 flex-1 overflow-y-auto">
          <p className="text-xs text-content-secondary mb-3">
            Pick the release for each file, expand a row to
            review every field, then Apply. Rows at or above{" "}
            {Math.round(FILE_LOOKUP_THRESHOLD * 100)}%
            confidence start checked; rows below{" "}
            {Math.round(TRACK_MATCHING_THRESHOLD * 100)}%
            are unmatched.
          </p>
          <table className="w-full text-xs border-separate border-spacing-y-1.5">
            <thead className="text-[10px] uppercase tracking-wider text-content-secondary">
              <tr>
                <th className="px-1 py-1 w-8 text-start">
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
                      onChange={() => {
                        setAllIncluded(
                          !isSomeEligibleIncluded,
                        )
                      }}
                    />
                    <span className="normal-case">Use</span>
                  </div>
                </th>
                <th className="px-1 py-1 w-6"></th>
                <th className="px-2 py-1 text-start">
                  File
                </th>
                <th className="px-2 py-1 text-start">
                  Release
                </th>
                <th className="px-2 py-1 text-center w-20">
                  Confidence
                </th>
                <th className="px-1 py-1 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <Fragment key={file.filePath}>
                  <tr
                    data-tag-match-row={file.filePath}
                    className={
                      rowStateFor(file.filePath).isApplied
                        ? "border border-intent-success-border bg-intent-success-surface"
                        : getRowConfidence({
                              file,
                              rowState: rowStateFor(
                                file.filePath,
                              ),
                            }) < TRACK_MATCHING_THRESHOLD
                          ? "border border-intent-danger-border bg-intent-danger-surface"
                          : getRowConfidence({
                                file,
                                rowState: rowStateFor(
                                  file.filePath,
                                ),
                              }) < FILE_LOOKUP_THRESHOLD
                            ? "border border-intent-warning-border bg-intent-warning-surface"
                            : "border border-border-default bg-surface-sunken"
                    }
                  >
                    <td className="px-1.5 py-1.5 align-top">
                      <input
                        type="checkbox"
                        aria-label={`Include ${file.filename}`}
                        checked={
                          rowStateFor(file.filePath)
                            .isIncluded
                        }
                        disabled={
                          rowStateFor(file.filePath)
                            .isApplied || isApplying
                        }
                        onChange={(event) => {
                          updateRow({
                            filePath: file.filePath,
                            patch: {
                              isIncluded:
                                event.target.checked,
                            },
                          })
                        }}
                      />
                    </td>
                    <td className="px-1.5 py-1.5 align-top">
                      <IconButton
                        label={`Preview ${file.filename}`}
                        title="Preview this file"
                        intent="info"
                        appearance="ghost"
                        size="sm"
                        onClick={() => {
                          setAudioPreview({
                            path: file.filePath,
                          })
                        }}
                      >
                        ▶
                      </IconButton>
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <div className="font-mono text-xs text-content-primary wrap-break-word">
                        {file.filename}
                      </div>
                      <div className="text-[10px] text-content-secondary font-mono mt-0.5">
                        {formatDurationSeconds(
                          file.durationSeconds,
                        )}
                      </div>
                      {rowStateFor(file.filePath).error ? (
                        <div className="text-[10px] font-mono mt-1 text-intent-danger-content">
                          {rowStateFor(file.filePath).error}
                        </div>
                      ) : null}
                      {rowStateFor(file.filePath)
                        .isApplied ? (
                        <div className="text-[10px] font-mono mt-1 text-intent-success-content">
                          Tags written
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {file.rankedCandidates.length ===
                      0 ? (
                        <span
                          data-tag-match-unmatched={
                            file.filePath
                          }
                          className="text-[10px] font-mono text-intent-danger-content"
                        >
                          No release candidates
                        </span>
                      ) : (
                        <ReleaseCandidatePicker
                          ariaLabel={`Release for ${file.filename}`}
                          candidates={file.rankedCandidates}
                          isDisabled={
                            rowStateFor(file.filePath)
                              .isApplied || isApplying
                          }
                          onSelect={(releaseId) => {
                            updateRow({
                              filePath: file.filePath,
                              patch: {
                                selectedReleaseId:
                                  releaseId,
                              },
                            })
                          }}
                          selectedReleaseId={
                            rowStateFor(file.filePath)
                              .selectedReleaseId
                          }
                        />
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-top text-center">
                      <span
                        data-tag-match-confidence={
                          file.filePath
                        }
                        className={`inline-block text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          getRowConfidence({
                            file,
                            rowState: rowStateFor(
                              file.filePath,
                            ),
                          }) >= FILE_LOOKUP_THRESHOLD
                            ? "bg-intent-success-solid text-intent-success-on-solid"
                            : getRowConfidence({
                                  file,
                                  rowState: rowStateFor(
                                    file.filePath,
                                  ),
                                }) >=
                                TRACK_MATCHING_THRESHOLD
                              ? "bg-intent-warning-solid text-intent-warning-on-solid"
                              : "bg-intent-danger-solid text-intent-danger-on-solid"
                        }`}
                      >
                        {getRowConfidence({
                          file,
                          rowState: rowStateFor(
                            file.filePath,
                          ),
                        }) < TRACK_MATCHING_THRESHOLD
                          ? "Unmatched"
                          : formatConfidence(
                              getRowConfidence({
                                file,
                                rowState: rowStateFor(
                                  file.filePath,
                                ),
                              }),
                            )}
                      </span>
                    </td>
                    <td className="px-1.5 py-1.5 align-top">
                      <IconButton
                        data-tag-match-expand={
                          file.filePath
                        }
                        label={
                          rowStateFor(file.filePath)
                            .isExpanded
                            ? `Hide tag changes for ${file.filename}`
                            : `Show tag changes for ${file.filename}`
                        }
                        aria-expanded={
                          rowStateFor(file.filePath)
                            .isExpanded
                        }
                        title="Tag changes"
                        intent="neutral"
                        appearance="ghost"
                        size="sm"
                        onClick={() => {
                          updateRow({
                            filePath: file.filePath,
                            patch: {
                              isExpanded: !rowStateFor(
                                file.filePath,
                              ).isExpanded,
                            },
                          })
                        }}
                      >
                        {rowStateFor(file.filePath)
                          .isExpanded
                          ? "▾"
                          : "▸"}
                      </IconButton>
                    </td>
                  </tr>
                  {rowStateFor(file.filePath).isExpanded ? (
                    <tr
                      data-tag-match-diff-row={
                        file.filePath
                      }
                      className="border border-border-default bg-surface-base"
                    >
                      <td
                        colSpan={6}
                        className="px-3 py-2 align-top"
                      >
                        <div className="flex flex-col gap-1">
                          {AUDIO_TAG_FIELD_NAMES.map(
                            (fieldName) => (
                              <TagFieldDiff
                                key={fieldName}
                                currentValue={
                                  file.currentTags[
                                    fieldName
                                  ]
                                }
                                fieldName={fieldName}
                                isEditable={isRowEditable({
                                  isApplying,
                                  rowState: rowStateFor(
                                    file.filePath,
                                  ),
                                })}
                                onChange={(value) => {
                                  updateRow({
                                    filePath: file.filePath,
                                    patch: {
                                      editedTags: {
                                        ...rowStateFor(
                                          file.filePath,
                                        ).editedTags,
                                        [fieldName]: value,
                                      },
                                    },
                                  })
                                }}
                                proposedValue={
                                  getEffectiveTags({
                                    file,
                                    rowState: rowStateFor(
                                      file.filePath,
                                    ),
                                  })[fieldName]
                                }
                              />
                            ),
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-border-default flex items-center justify-end gap-2">
          <span className="text-xs text-content-secondary me-auto">
            {includedCount} file
            {includedCount === 1 ? "" : "s"} selected
          </span>
          <Button
            intent="neutral"
            appearance="soft"
            size="sm"
            onClick={close}
          >
            Close
          </Button>
          <Button
            id="tag-match-apply"
            intent="success"
            appearance="solid"
            size="sm"
            isDisabled={includedCount === 0 || isApplying}
            onClick={() => void handleApply()}
          >
            {isApplying ? "Writing tags…" : "Apply"}
          </Button>
        </div>
      </div>
    </div>
  )
}
