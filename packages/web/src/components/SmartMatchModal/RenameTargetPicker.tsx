import type { ListboxItem } from "@charcuterie/ui"
import { Combobox, Listbox } from "@charcuterie/ui"
import { useState } from "react"
import {
  LOW_CONFIDENCE_THRESHOLD,
  type ScoredCandidate,
} from "./smartMatchTypes"

// Styled "Rename to" picker for the SmartMatchModal. Renders each
// candidate as two rows (candidate name on top + a meta row with
// timecode chip + confidence chip below) instead of cramming
// everything into one HTML <option> label — which is why it is a
// Charcuterie Listbox/Combobox rather than a native <select>.
type Props = {
  candidates: ScoredCandidate[]
  selectedName: string
  onSelect: (name: string) => void
  isDisabled: boolean
  ariaLabel: string
}

const formatConfidence = (confidence: number) =>
  `${Math.round(confidence * 100)}%`

const confidenceClass = (confidence: number) =>
  confidence >= LOW_CONFIDENCE_THRESHOLD
    ? "bg-intent-success-solid text-intent-success-on-solid"
    : "bg-intent-warning-solid text-intent-warning-on-solid"

const findScored = (
  candidates: ScoredCandidate[],
  name: string,
): ScoredCandidate | null =>
  candidates.find(
    (scored) => scored.candidate.name === name,
  ) ?? null

// Above this many candidates the list grows long enough (8 deleted
// scenes + a clutch of trailers, galleries, etc. on a busy disc) that
// scanning by eye is painful — render a searchable Combobox. Small
// lists stay chrome-free on a single-select Listbox.
const SEARCHABLE_CANDIDATE_COUNT = 6

// The option's `textValue` is the Combobox filter/type-ahead target and
// the accessible name. Include the parent name so a child row still
// matches a query for its parent (mirrors the old name-OR-parentName
// filter), while `label` renders the rich two-row layout.
const toOption = (scored: ScoredCandidate): ListboxItem => {
  const { name, timecode, parentName } = scored.candidate
  const isChild = Boolean(parentName)
  return {
    value: name,
    textValue: parentName ? `${name} ${parentName}` : name,
    label: (
      <div
        data-rename-target-option
        data-rename-target-option-name={name}
        data-rename-target-option-parent={parentName}
        className="flex min-w-0 flex-col gap-0.5"
      >
        {parentName && (
          <span
            data-rename-target-option-parent-label
            className="text-[9px] text-content-muted font-mono uppercase tracking-wider"
          >
            under {parentName}
          </span>
        )}
        <span
          className={`text-xs font-mono text-content-primary wrap-break-word ${isChild ? "ps-3 border-s border-border-default" : ""}`}
        >
          {isChild && (
            <span
              aria-hidden
              className="text-content-muted me-1"
            >
              ↳
            </span>
          )}
          {name}
        </span>
        <span
          className={`flex items-center gap-1.5 text-[10px] font-mono ${isChild ? "ps-3" : ""}`}
        >
          {timecode && (
            <span className="bg-surface-sunken text-content-secondary px-1.5 py-0 rounded border border-border-default">
              {timecode}
            </span>
          )}
          <span
            className={`px-1.5 py-0 rounded ${confidenceClass(scored.confidence)}`}
          >
            {formatConfidence(scored.confidence)}
          </span>
        </span>
      </div>
    ),
  }
}

export const RenameTargetPicker = ({
  candidates,
  selectedName,
  onSelect,
  isDisabled,
  ariaLabel,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false)

  const selected = findScored(candidates, selectedName)
  const isSearchable =
    candidates.length > SEARCHABLE_CANDIDATE_COUNT
  const options = candidates.map(toOption)

  const close = () => setIsOpen(false)

  const trigger = (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={isDisabled}
      onClick={() => {
        if (isDisabled) return
        setIsOpen((isCurrentlyOpen) => !isCurrentlyOpen)
      }}
      className="w-full text-start text-xs bg-surface-sunken text-content-primary border border-border-default rounded px-2 py-1 focus:outline-none focus:border-border-focus disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
    >
      <span className="flex-1 min-w-0 flex flex-col">
        {selected?.candidate.parentName && (
          <span
            data-rename-target-parent-label
            className="text-[9px] text-content-muted font-mono uppercase tracking-wider truncate"
          >
            under {selected.candidate.parentName}
          </span>
        )}
        <span
          data-rename-target-name
          className="font-mono truncate"
        >
          {selected?.candidate.name ?? selectedName ?? (
            <span className="text-content-muted italic">
              Pick a candidate…
            </span>
          )}
        </span>
        {selected && (
          <span className="flex items-center gap-1.5 mt-0.5 text-[10px] font-mono">
            {selected.candidate.timecode && (
              <span
                data-rename-target-timecode
                className="bg-surface-sunken text-content-secondary px-1.5 py-0 rounded border border-border-default"
              >
                {selected.candidate.timecode}
              </span>
            )}
            <span
              data-rename-target-confidence
              className={`px-1.5 py-0 rounded ${confidenceClass(selected.confidence)}`}
            >
              {formatConfidence(selected.confidence)}
            </span>
          </span>
        )}
      </span>
      <span
        aria-hidden
        className="text-content-secondary text-[10px] shrink-0"
      >
        ▾
      </span>
    </button>
  )

  return isSearchable ? (
    <Combobox
      trigger={trigger}
      isVisible={isOpen}
      onDismiss={close}
      onSelect={onSelect}
      options={options}
      selectedValue={selectedName}
      placeholder="Search candidates…"
      emptyLabel="No candidates match."
    />
  ) : (
    <Listbox
      trigger={trigger}
      isVisible={isOpen}
      onDismiss={close}
      onSelect={onSelect}
      options={options}
      selectedValue={selectedName}
    />
  )
}
