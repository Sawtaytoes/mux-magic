import { useState } from "react"

import type { ApplyIfLeaf } from "./applyIfTreeAdapters"
import { ListboxPicker } from "./ListboxPicker"
import type { ComparatorVerb } from "./types"
import { COMPARATOR_VERBS } from "./types"

/**
 * One `applyIf` condition — a style field, a comparator, and a number.
 *
 * The `literal` mode is offered because the DSL allows a bare string
 * value (`Fontsize: "60"`) alongside the comparator form. The row this
 * replaces could not represent that and rewrote it on the first edit;
 * here it round-trips.
 */
export const ApplyIfLeafRow = ({
  isReadOnly,
  onChange,
  value,
}: {
  isReadOnly: boolean
  onChange: (value: ApplyIfLeaf) => void
  value: ApplyIfLeaf
}) => {
  const [draftField, setDraftField] = useState(value.field)
  const [draftOperand, setDraftOperand] = useState(
    value.mode === "comparator"
      ? String(value.operand)
      : "0",
  )
  const [draftLiteral, setDraftLiteral] = useState(
    value.mode === "literal" ? value.value : "",
  )

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        aria-label="Style field"
        className="min-w-32 flex-1 bg-surface-sunken text-content-primary text-xs rounded px-2 py-1 border border-border-default focus:outline-none focus:border-border-focus font-mono"
        onBlur={() => {
          onChange({ ...value, field: draftField })
        }}
        onChange={(changeEvent) => {
          setDraftField(changeEvent.target.value)
        }}
        placeholder="FieldName"
        readOnly={isReadOnly}
        type="text"
        value={draftField}
      />

      <ListboxPicker
        isDisabled={isReadOnly}
        label="Comparator"
        onChange={(nextVerb) => {
          onChange(
            nextVerb === "literal"
              ? {
                  field: value.field,
                  mode: "literal",
                  value: draftLiteral,
                }
              : {
                  field: value.field,
                  mode: "comparator",
                  operand: Number(draftOperand) || 0,
                  verb: nextVerb as ComparatorVerb,
                },
          )
        }}
        options={[
          ...COMPARATOR_VERBS.map((comparatorVerb) => ({
            label: comparatorVerb,
            value: comparatorVerb,
          })),
          { label: "is (text)", value: "literal" },
        ]}
        value={
          value.mode === "literal" ? "literal" : value.verb
        }
      />

      {value.mode === "literal" ? (
        <input
          aria-label="Field text value"
          className="w-32 bg-surface-sunken text-content-primary text-xs rounded px-2 py-1 border border-border-default focus:outline-none focus:border-border-focus font-mono"
          onBlur={() => {
            onChange({ ...value, value: draftLiteral })
          }}
          onChange={(changeEvent) => {
            setDraftLiteral(changeEvent.target.value)
          }}
          readOnly={isReadOnly}
          type="text"
          value={draftLiteral}
        />
      ) : (
        <input
          aria-label="Comparator operand"
          className="w-24 bg-surface-sunken text-content-primary text-xs rounded px-2 py-1 border border-border-default focus:outline-none focus:border-border-focus font-mono"
          onBlur={() => {
            onChange({
              ...value,
              operand:
                draftOperand === ""
                  ? 0
                  : Number(draftOperand),
            })
          }}
          onChange={(changeEvent) => {
            setDraftOperand(changeEvent.target.value)
          }}
          readOnly={isReadOnly}
          type="number"
          value={draftOperand}
        />
      )}
    </div>
  )
}
