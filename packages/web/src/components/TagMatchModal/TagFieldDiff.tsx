import {
  AUDIO_TAG_FIELD_LABELS,
  type AudioTagFieldName,
  MULTI_VALUE_TAG_FIELD_NAMES,
  NUMERIC_TAG_FIELD_NAMES,
  type TagValue,
} from "./tagMatchTypes"

export type TagChangeType =
  | "added"
  | "changed"
  | "removed"
  | "unchanged"

type Props = {
  fieldName: AudioTagFieldName
  currentValue: TagValue
  proposedValue: TagValue
  isEditable: boolean
  onChange: (value: TagValue) => void
}

// Normalise any tag value to an ordered list of trimmed strings.
// Multi-value fields keep their order — Picard treats a reordered
// genre list as a change, and so do we.
const toComparableEntries = (value: TagValue) =>
  value === undefined
    ? []
    : Array.isArray(value)
      ? value
          .map((entry) => String(entry).trim())
          .filter((entry) => entry.length > 0)
      : String(value).trim().length > 0
        ? [String(value).trim()]
        : []

// Numbers compare numerically so "01" and 1 read as unchanged.
const isSameEntry = ({
  currentEntry,
  proposedEntry,
}: {
  currentEntry: string
  proposedEntry: string
}) =>
  currentEntry === proposedEntry ||
  (Number.isFinite(Number(currentEntry)) &&
    Number.isFinite(Number(proposedEntry)) &&
    Number(currentEntry) === Number(proposedEntry))

const isSameEntryList = ({
  currentEntries,
  proposedEntries,
}: {
  currentEntries: string[]
  proposedEntries: string[]
}) =>
  currentEntries.length === proposedEntries.length &&
  currentEntries.every((currentEntry, entryIndex) =>
    isSameEntry({
      currentEntry,
      proposedEntry: proposedEntries[entryIndex] ?? "",
    }),
  )

export const deriveTagChangeType = ({
  currentValue,
  proposedValue,
}: {
  currentValue: TagValue
  proposedValue: TagValue
}) =>
  toComparableEntries(currentValue).length === 0
    ? toComparableEntries(proposedValue).length === 0
      ? "unchanged"
      : "added"
    : toComparableEntries(proposedValue).length === 0
      ? "removed"
      : isSameEntryList({
            currentEntries:
              toComparableEntries(currentValue),
            proposedEntries:
              toComparableEntries(proposedValue),
          })
        ? "unchanged"
        : "changed"

// Display form. Multi-value fields join with ", " so the editable
// input round-trips through `parseTagFieldText`.
export const formatTagValue = (value: TagValue) =>
  value === undefined
    ? ""
    : Array.isArray(value)
      ? value.join(", ")
      : String(value)

// Text typed into the proposed-value input, back to a TagValue.
// `genres` commits as an array; the four numeric fields commit as a
// number when the text is numeric.
export const parseTagFieldText = ({
  fieldName,
  text,
}: {
  fieldName: AudioTagFieldName
  text: string
}) =>
  MULTI_VALUE_TAG_FIELD_NAMES.includes(fieldName)
    ? // Empty entries are kept so a half-typed "Ambient, " survives the
      // round-trip through the input. `toWritableTags` drops them
      // before anything is written.
      text.split(",").map((entry) => entry.trim())
    : NUMERIC_TAG_FIELD_NAMES.includes(fieldName) &&
        text.trim().length > 0 &&
        Number.isFinite(Number(text.trim()))
      ? Number(text.trim())
      : text

const CHANGE_TYPE_CLASS: Record<TagChangeType, string> = {
  added:
    "bg-intent-success-surface border-intent-success-border",
  changed:
    "bg-intent-warning-surface border-intent-warning-border",
  removed:
    "bg-intent-danger-surface border-intent-danger-border",
  unchanged: "bg-transparent border-border-default",
}

const CHANGE_TYPE_LABEL: Record<TagChangeType, string> = {
  added: "added",
  changed: "changed",
  removed: "removed",
  unchanged: "unchanged",
}

// One field's old value beside its new value. This is the review step
// Picard provides, and the reason a blind CLI run was rejected: an
// unchanged field must be visually quiet, a changed one obvious.
export const TagFieldDiff = ({
  fieldName,
  currentValue,
  proposedValue,
  isEditable,
  onChange,
}: Props) => {
  const changeType = deriveTagChangeType({
    currentValue,
    proposedValue,
  })
  const fieldLabel = AUDIO_TAG_FIELD_LABELS[fieldName]

  return (
    <div
      data-tag-match-field={fieldName}
      data-tag-match-change-type={changeType}
      className={`flex items-start gap-2 rounded border px-2 py-1 ${CHANGE_TYPE_CLASS[changeType]}`}
    >
      <span className="w-28 shrink-0 text-[10px] uppercase tracking-wider text-content-secondary">
        {fieldLabel}
      </span>
      <span
        data-tag-match-field-current
        className={`min-w-0 flex-1 font-mono text-xs wrap-break-word ${changeType === "unchanged" ? "text-content-muted" : "text-content-secondary"}`}
      >
        {formatTagValue(currentValue) || "—"}
      </span>
      <span
        aria-hidden
        className="shrink-0 text-[10px] text-content-muted"
      >
        →
      </span>
      <span className="min-w-0 flex-1">
        {isEditable ? (
          <input
            type="text"
            data-tag-match-field-input={fieldName}
            aria-label={`${fieldLabel} proposed value`}
            value={formatTagValue(proposedValue)}
            onChange={(event) => {
              onChange(
                parseTagFieldText({
                  fieldName,
                  text: event.target.value,
                }),
              )
            }}
            className="w-full rounded border border-border-default bg-surface-sunken px-1.5 py-0.5 font-mono text-xs text-content-primary focus:border-border-focus focus:outline-none"
          />
        ) : (
          <span
            data-tag-match-field-proposed
            className={`font-mono text-xs wrap-break-word ${changeType === "unchanged" ? "text-content-muted" : "text-content-primary"}`}
          >
            {formatTagValue(proposedValue) || "—"}
          </span>
        )}
      </span>
      <span
        data-tag-match-field-change-label
        className="w-20 shrink-0 text-end text-[10px] font-mono text-content-muted"
      >
        {CHANGE_TYPE_LABEL[changeType]}
      </span>
    </div>
  )
}
