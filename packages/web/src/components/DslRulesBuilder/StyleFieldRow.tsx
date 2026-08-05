import { IconButton } from "@charcuterie/ui"
import { useState } from "react"
import { AssFieldPicker } from "./AssFieldPicker"
import { STYLE_FIELDS } from "./assFields"
import { ComputeFromEditor } from "./ComputeFromEditor"
import { isPlainObject } from "./clauseUtils"
import {
  removeStyleField,
  renameStyleField,
  setStyleFieldComputedToggle,
  setStyleFieldLiteralValue,
} from "./styleMutations"
import type {
  ComputeFrom,
  DslRule,
  StyleFieldValue,
} from "./types"

type StyleFieldRowProps = {
  rules: DslRule[]
  ruleIndex: number
  fieldKey: string
  fieldValue: StyleFieldValue
  isReadOnly: boolean
  onCommitRules: (nextRules: DslRule[]) => void
}

export const StyleFieldRow = ({
  rules,
  ruleIndex,
  fieldKey,
  fieldValue,
  isReadOnly,
  onCommitRules,
}: StyleFieldRowProps) => {
  const isComputed =
    isPlainObject(fieldValue) &&
    isPlainObject(
      (fieldValue as { computeFrom?: unknown }).computeFrom,
    )
  const literalValue =
    typeof fieldValue === "string" ? fieldValue : ""
  const computeFrom = isComputed
    ? (fieldValue as { computeFrom: ComputeFrom })
        .computeFrom
    : null

  const [draftLiteral, setDraftLiteral] =
    useState(literalValue)

  return (
    <div className="border border-border-subtle rounded px-2 py-1.5 mt-1 bg-surface-raised">
      <div className="flex items-center gap-1.5">
        <AssFieldPicker
          label={fieldKey}
          value={fieldKey}
          options={STYLE_FIELDS}
          isReadOnly={isReadOnly}
          inputId={`ssf-field-${ruleIndex}-${fieldKey}`}
          onChange={(newKey) => {
            onCommitRules(
              renameStyleField({
                rules,
                ruleIndex,
                oldKey: fieldKey,
                newKey,
              }),
            )
          }}
        />
        <span className="text-content-muted text-xs">=</span>
        {isComputed ? (
          <span className="flex-1 text-xs text-content-secondary italic">
            computed from metadata ↓
          </span>
        ) : (
          <input
            type="text"
            value={draftLiteral}
            placeholder="value"
            readOnly={isReadOnly}
            onChange={(event) => {
              setDraftLiteral(event.target.value)
            }}
            onBlur={() => {
              onCommitRules(
                setStyleFieldLiteralValue({
                  rules,
                  ruleIndex,
                  fieldKey,
                  value: draftLiteral,
                }),
              )
            }}
            className="flex-1 min-w-0 bg-surface-sunken text-content-primary text-xs rounded px-2 py-1 border border-border-default focus:outline-none focus:border-border-focus font-mono"
          />
        )}
        <label className="flex items-center gap-1 text-xs text-content-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={isComputed}
            disabled={isReadOnly}
            onChange={(event) => {
              onCommitRules(
                setStyleFieldComputedToggle({
                  rules,
                  ruleIndex,
                  fieldKey,
                  isComputed: event.target.checked,
                }),
              )
            }}
            className="w-3.5 h-3.5 rounded bg-surface-sunken border-border-strong accent-intent-accent-solid cursor-pointer"
          />
          computed
        </label>
        {!isReadOnly && (
          <IconButton
            label="Remove field"
            intent="danger"
            appearance="ghost"
            size="sm"
            onClick={() => {
              onCommitRules(
                removeStyleField({
                  rules,
                  ruleIndex,
                  fieldKey,
                }),
              )
            }}
          >
            ✕
          </IconButton>
        )}
      </div>
      {isComputed && computeFrom && (
        <ComputeFromEditor
          rules={rules}
          ruleIndex={ruleIndex}
          fieldKey={fieldKey}
          computeFrom={computeFrom}
          isReadOnly={isReadOnly}
          onCommitRules={onCommitRules}
        />
      )}
    </div>
  )
}
