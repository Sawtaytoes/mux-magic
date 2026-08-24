import {
  AUDIO_TAG_FIELDS,
  type AudioTagField,
  type AudioTags,
  MULTI_VALUE_AUDIO_TAG_FIELDS,
  NUMERIC_AUDIO_TAG_FIELDS,
} from "./audioTagFields.js"

export type AudioTagChangeType =
  | "added"
  | "changed"
  | "removed"
  | "unchanged"

export type AudioTagValue = AudioTags[AudioTagField]

export type AudioTagDifference = {
  changeType: AudioTagChangeType
  currentValue: AudioTagValue
  field: AudioTagField
  proposedValue: AudioTagValue
}

const multiValueFields: readonly AudioTagField[] =
  MULTI_VALUE_AUDIO_TAG_FIELDS

const numericFields: readonly AudioTagField[] =
  NUMERIC_AUDIO_TAG_FIELDS

const isValueAbsent = (value: AudioTagValue) =>
  value === undefined ||
  value === "" ||
  (Array.isArray(value) && value.length === 0)

const isValuePresent = (value: AudioTagValue) =>
  !isValueAbsent(value)

const toStringList = (value: AudioTagValue) =>
  Array.isArray(value) ? value : [String(value)]

const isSameStringList = ({
  currentValues,
  proposedValues,
}: {
  currentValues: string[]
  proposedValues: string[]
}) =>
  currentValues.length === proposedValues.length &&
  currentValues.every(
    (currentValue, index) =>
      currentValue === proposedValues[index],
  )

const isSameValue = ({
  currentValue,
  field,
  proposedValue,
}: {
  currentValue: AudioTagValue
  field: AudioTagField
  proposedValue: AudioTagValue
}) =>
  multiValueFields.includes(field)
    ? isSameStringList({
        currentValues: toStringList(currentValue),
        proposedValues: toStringList(proposedValue),
      })
    : numericFields.includes(field)
      ? Number(currentValue) === Number(proposedValue)
      : String(currentValue) === String(proposedValue)

// `undefined` means "no proposal for this field", which matches
// writeAudioTags leaving the existing value alone. An explicit empty
// string or empty array is a proposal to clear the field.
const getChangeType = ({
  currentValue,
  field,
  proposedValue,
}: {
  currentValue: AudioTagValue
  field: AudioTagField
  proposedValue: AudioTagValue
}): AudioTagChangeType =>
  proposedValue === undefined
    ? "unchanged"
    : isValuePresent(proposedValue)
      ? isValuePresent(currentValue)
        ? isSameValue({
            currentValue,
            field,
            proposedValue,
          })
          ? "unchanged"
          : "changed"
        : "added"
      : isValuePresent(currentValue)
        ? "removed"
        : "unchanged"

export const diffAudioTags = ({
  currentTags,
  proposedTags,
}: {
  currentTags: AudioTags
  proposedTags: AudioTags
}): AudioTagDifference[] =>
  AUDIO_TAG_FIELDS.map((field) => ({
    changeType: getChangeType({
      currentValue: currentTags[field],
      field,
      proposedValue: proposedTags[field],
    }),
    currentValue: currentTags[field],
    field,
    proposedValue: proposedTags[field],
  }))
