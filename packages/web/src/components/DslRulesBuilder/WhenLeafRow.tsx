import { useState } from "react"

import { ListboxPicker } from "./ListboxPicker"
import type { WhenLeaf } from "./whenTreeAdapters"

const SLOT_OPTIONS = [
  { label: "matches", value: "matches" },
  { label: "excludes", value: "excludes" },
] as const

/**
 * One condition row — the app-owned `renderLeaf` body.
 *
 * The leaf is a discriminated union rather than one shape with optional
 * fields, because `$ref` replaces a whole slot body (`matches: {$ref}`)
 * instead of adding a pair to it. Modelling it as a flag on a kv row
 * would make "a $ref that also has a key" representable, and the adapter
 * would have to pick a winner.
 *
 * Text still commits on blur, as it did in the row this replaces: the
 * tree is mirrored into `step.params` on every change, and committing
 * per keystroke would put a YAML/URL round-trip behind every character.
 */
export const WhenLeafRow = ({
  isReadOnly,
  onChange,
  predicateNames,
  value,
}: {
  isReadOnly: boolean
  onChange: (value: WhenLeaf) => void
  predicateNames: readonly string[]
  value: WhenLeaf
}) => {
  const [draftKey, setDraftKey] = useState(
    value.mode === "kv" ? value.key : "",
  )
  const [draftValue, setDraftValue] = useState(
    value.mode === "kv" ? value.value : "",
  )

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ListboxPicker
        isDisabled={isReadOnly}
        label="Slot"
        onChange={(slot) => {
          onChange({
            ...value,
            slot: slot as WhenLeaf["slot"],
          })
        }}
        options={SLOT_OPTIONS}
        value={value.slot}
      />

      <ListboxPicker
        isDisabled={isReadOnly}
        label="Condition kind"
        onChange={(nextMode) => {
          onChange(
            nextMode === "ref"
              ? {
                  mode: "ref",
                  ref: predicateNames[0] ?? "",
                  slot: value.slot,
                }
              : {
                  key: draftKey,
                  mode: "kv",
                  slot: value.slot,
                  value: draftValue,
                },
          )
        }}
        options={[
          { label: "key = value", value: "kv" },
          ...(predicateNames.length > 0
            ? [{ label: "$ref", value: "ref" }]
            : []),
        ]}
        value={value.mode}
      />

      {value.mode === "ref" ? (
        <ListboxPicker
          isDisabled={isReadOnly}
          label="Predicate"
          onChange={(ref) => {
            onChange({ ...value, ref })
          }}
          options={predicateNames.map((predicateName) => ({
            label: predicateName,
            value: predicateName,
          }))}
          value={value.ref}
        />
      ) : (
        <>
          <input
            aria-label="Condition key"
            className="min-w-32 flex-1 bg-surface-sunken text-content-primary text-xs rounded px-2 py-1 border border-border-default focus:outline-none focus:border-border-focus font-mono"
            onBlur={() => {
              onChange({ ...value, key: draftKey })
            }}
            onChange={(changeEvent) => {
              setDraftKey(changeEvent.target.value)
            }}
            placeholder="key"
            readOnly={isReadOnly}
            type="text"
            value={draftKey}
          />

          <span className="text-content-muted text-xs">
            =
          </span>

          <input
            aria-label="Condition value"
            className="min-w-32 flex-1 bg-surface-sunken text-content-primary text-xs rounded px-2 py-1 border border-border-default focus:outline-none focus:border-border-focus font-mono"
            onBlur={() => {
              onChange({ ...value, value: draftValue })
            }}
            onChange={(changeEvent) => {
              setDraftValue(changeEvent.target.value)
            }}
            placeholder="value"
            readOnly={isReadOnly}
            type="text"
            value={draftValue}
          />
        </>
      )}
    </div>
  )
}
