import { IconButton, Select } from "@charcuterie/ui"
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
        className="flex-1 min-w-0 bg-surface-sunken text-content-primary text-xs rounded px-2 py-1 border border-border-default focus:outline-none focus:border-border-focus font-mono"
      />
      <Select
        className="w-28 font-mono"
        isDisabled={isReadOnly}
        key={verb}
        label={`Comparator for ${entryKey}`}
        onChange={(nextVerb) => {
          onCommitRules(
            setApplyIfEntryComparator({
              rules,
              ruleIndex,
              clauseName,
              entryKey,
              verb: nextVerb as ComparatorVerb,
            }),
          )
        }}
        options={COMPARATOR_VERBS.map((comparatorVerb) => ({
          label: comparatorVerb,
          value: comparatorVerb,
        }))}
        size="sm"
        value={verb}
      />
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
        className="w-20 bg-surface-sunken text-content-primary text-xs rounded px-2 py-1 border border-border-default focus:outline-none focus:border-border-focus font-mono"
      />
      {!isReadOnly && (
        <IconButton
          label="Remove entry"
          intent="danger"
          appearance="ghost"
          size="sm"
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
        >
          ✕
        </IconButton>
      )}
    </div>
  )
}
