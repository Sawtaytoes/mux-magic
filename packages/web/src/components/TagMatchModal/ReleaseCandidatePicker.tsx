import type { ListboxItem } from "@charcuterie/ui"
import { Combobox, Listbox } from "@charcuterie/ui"
import { useState } from "react"
import {
  FILE_LOOKUP_THRESHOLD,
  type ScoredReleaseCandidate,
  TRACK_MATCHING_THRESHOLD,
} from "./tagMatchTypes"

// The per-row release picker. Each option renders two rows: release
// title + artist on top, then country / format / year / track count /
// label below. That meta line is exactly the information the Picard
// parity notes call out as the thing that stops a wrong match, and it
// is why this is a Charcuterie Listbox/Combobox rather than a native
// <select> — an <option> cannot render it.
type Props = {
  candidates: ScoredReleaseCandidate[]
  selectedReleaseId: string
  onSelect: (releaseId: string) => void
  isDisabled: boolean
  ariaLabel: string
}

// At or above this many candidates the list is long enough that
// scanning by eye is painful — render a searchable Combobox.
export const SEARCHABLE_CANDIDATE_COUNT = 6

const formatConfidence = (confidence: number) =>
  `${Math.round(confidence * 100)}%`

const confidenceClass = (confidence: number) =>
  confidence >= FILE_LOOKUP_THRESHOLD
    ? "bg-intent-success-solid text-intent-success-on-solid"
    : confidence >= TRACK_MATCHING_THRESHOLD
      ? "bg-intent-warning-solid text-intent-warning-on-solid"
      : "bg-intent-danger-solid text-intent-danger-on-solid"

const buildMetaParts = (scored: ScoredReleaseCandidate) =>
  [
    scored.candidate.country,
    scored.candidate.format,
    scored.candidate.year,
    scored.candidate.trackCount === undefined
      ? undefined
      : `${scored.candidate.trackCount} tracks`,
    scored.candidate.label,
  ].filter(
    (part): part is string =>
      part !== undefined && part.length > 0,
  )

const findScored = ({
  candidates,
  releaseId,
}: {
  candidates: ScoredReleaseCandidate[]
  releaseId: string
}) =>
  candidates.find(
    (scored) => scored.candidate.releaseId === releaseId,
  ) ?? null

// `textValue` is the Combobox filter target and the option's
// accessible name, so it carries every fact the meta row shows.
const toOption = (
  scored: ScoredReleaseCandidate,
): ListboxItem => ({
  value: scored.candidate.releaseId,
  textValue: [
    scored.candidate.releaseTitle,
    scored.candidate.artistName,
    ...buildMetaParts(scored),
    scored.candidate.source,
  ].join(" · "),
  label: (
    <div
      data-release-candidate-option={
        scored.candidate.releaseId
      }
      className="flex min-w-0 flex-col gap-0.5"
    >
      <span className="text-xs font-mono text-content-primary wrap-break-word">
        {scored.candidate.releaseTitle}
      </span>
      <span className="text-[10px] text-content-secondary font-mono wrap-break-word">
        {scored.candidate.artistName}
      </span>
      <span className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
        {buildMetaParts(scored).map((part) => (
          <span
            key={part}
            className="rounded border border-border-default bg-surface-sunken px-1.5 py-0 text-content-secondary"
          >
            {part}
          </span>
        ))}
        <span className="rounded border border-border-default px-1.5 py-0 text-content-muted uppercase">
          {scored.candidate.source}
        </span>
        <span
          className={`rounded px-1.5 py-0 ${confidenceClass(scored.confidence)}`}
        >
          {formatConfidence(scored.confidence)}
        </span>
      </span>
    </div>
  ),
})

export const ReleaseCandidatePicker = ({
  candidates,
  selectedReleaseId,
  onSelect,
  isDisabled,
  ariaLabel,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false)

  const selected = findScored({
    candidates,
    releaseId: selectedReleaseId,
  })

  const trigger = (
    <button
      type="button"
      aria-label={`${ariaLabel}: ${selected?.candidate.releaseTitle ?? "no release"}`}
      disabled={isDisabled}
      onClick={() => {
        setIsOpen(
          (isCurrentlyOpen) =>
            !isCurrentlyOpen && !isDisabled,
        )
      }}
      className="flex w-full items-center gap-2 rounded border border-border-default bg-surface-sunken px-2 py-1 text-start text-xs text-content-primary focus:border-border-focus focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          data-release-candidate-title
          className="truncate font-mono"
        >
          {selected?.candidate.releaseTitle ??
            (selectedReleaseId || "Pick a release…")}
        </span>
        {selected ? (
          <span
            data-release-candidate-meta
            className="truncate text-[10px] font-mono text-content-secondary"
          >
            {[
              selected.candidate.artistName,
              ...buildMetaParts(selected),
            ].join(" · ")}
          </span>
        ) : null}
        {selected ? (
          <span className="mt-0.5 flex items-center gap-1.5 text-[10px] font-mono">
            <span
              data-release-candidate-confidence
              className={`rounded px-1.5 py-0 ${confidenceClass(selected.confidence)}`}
            >
              {formatConfidence(selected.confidence)}
            </span>
          </span>
        ) : null}
      </span>
      <span
        aria-hidden
        className="shrink-0 text-[10px] text-content-secondary"
      >
        ▾
      </span>
    </button>
  )

  return candidates.length >= SEARCHABLE_CANDIDATE_COUNT ? (
    <Combobox
      emptyLabel="No releases match."
      isVisible={isOpen}
      onDismiss={() => {
        setIsOpen(false)
      }}
      onSelect={onSelect}
      options={candidates.map(toOption)}
      placeholder="Search releases…"
      selectedValue={selectedReleaseId}
      trigger={trigger}
    />
  ) : (
    <Listbox
      isVisible={isOpen}
      onDismiss={() => {
        setIsOpen(false)
      }}
      onSelect={onSelect}
      options={candidates.map(toOption)}
      selectedValue={selectedReleaseId}
      trigger={trigger}
    />
  )
}
