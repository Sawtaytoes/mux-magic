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
    <div className="border border-slate-700/40 rounded px-2 py-1.5 mt-1 bg-slate-900/20">
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
        <span className="text-slate-500 text-xs">=</span>
        {isComputed ? (
          <span className="flex-1 text-xs text-slate-400 italic">
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
            className="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
          />
        )}
        <label className="flex items-center gap-1 text-xs text-slate-400 cursor-pointer">
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
            className="w-3.5 h-3.5 rounded bg-slate-700 border-slate-500 accent-blue-500 cursor-pointer"
          />
          computed
        </label>
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => {
              onCommitRules(
                removeStyleField({
                  rules,
                  ruleIndex,
                  fieldKey,
                }),
              )
            }}
            className="text-xs text-slate-500 hover:text-red-400 px-1.5"
          >
            ✕
          </button>
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
