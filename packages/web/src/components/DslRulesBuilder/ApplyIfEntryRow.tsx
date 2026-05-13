import { useState } from "react"

import { isPlainObject } from "./clauseUtils"
import {
  removeApplyIfEntry,
  setApplyIfEntryComparator,
  setApplyIfEntryKey,
  setApplyIfEntryOperand,
} from "./conditionMutations"
import {
  type ApplyIfClauseName,
  type ApplyIfEntry,
  COMPARATOR_VERBS,
  type ComparatorVerb,
  type DslRule,
} from "./types"

export const ApplyIfEntryRow = ({
  rules,
  ruleIndex,
  clauseName,
  entryKey,
  entryValue,
  isReadOnly,
  onCommitRules,
}: {
  rules: DslRule[]
  ruleIndex: number
  clauseName: ApplyIfClauseName
  entryKey: string
  entryValue: ApplyIfEntry
  isReadOnly: boolean
  onCommitRules: (nextRules: DslRule[]) => void
}) => {
  const verb = isPlainObject(entryValue)
    ? ((Object.keys(entryValue)[0] as ComparatorVerb) ??
      "eq")
    : "eq"
  const operand = isPlainObject(entryValue)
    ? (Object.values(
        entryValue as Record<string, number>,
      )[0] ?? 0)
    : 0

  const [draftKey, setDraftKey] = useState(entryKey)
  const [draftOperand, setDraftOperand] = useState(
    String(operand),
  )

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <input
        type="text"
        value={draftKey}
        placeholder="FieldName"
        readOnly={isReadOnly}
        onChange={(event) => {
          setDraftKey(event.target.value)
        }}
        onBlur={() => {
          onCommitRules(
            setApplyIfEntryKey({
              rules,
              ruleIndex,
              clauseName,
              oldKey: entryKey,
              newKey: draftKey,
            }),
          )
        }}
        className="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
      />
      <select
        disabled={isReadOnly}
        value={verb}
        onChange={(event) => {
          onCommitRules(
            setApplyIfEntryComparator({
              rules,
              ruleIndex,
              clauseName,
              entryKey,
              verb: event.target.value as ComparatorVerb,
            }),
          )
        }}
        className="text-xs bg-slate-700 text-slate-200 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500"
      >
        {COMPARATOR_VERBS.map((comparatorVerb) => (
          <option
            key={comparatorVerb}
            value={comparatorVerb}
          >
            {comparatorVerb}
          </option>
        ))}
      </select>
      <input
        type="number"
        value={draftOperand}
        readOnly={isReadOnly}
        onChange={(event) => {
          setDraftOperand(event.target.value)
        }}
        onBlur={() => {
          const parsed =
            draftOperand === "" ? 0 : Number(draftOperand)
          onCommitRules(
            setApplyIfEntryOperand({
              rules,
              ruleIndex,
              clauseName,
              entryKey,
              operand: parsed,
            }),
          )
        }}
        className="w-20 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
      />
      {!isReadOnly && (
        <button
          type="button"
          onClick={() => {
            onCommitRules(
              removeApplyIfEntry({
                rules,
                ruleIndex,
                clauseName,
                entryKey,
              }),
            )
          }}
          className="text-xs text-slate-500 hover:text-red-400 px-1.5"
        >
          ✕
        </button>
      )}
    </div>
  )
}
