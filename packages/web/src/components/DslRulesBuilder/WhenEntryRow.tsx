import { IconButton } from "@charcuterie/ui"
import { useState } from "react"
import {
  removeWhenEntry,
  setWhenEntryKey,
  setWhenEntryValue,
} from "./conditionMutations"
import type { DslRule, WhenClauseName } from "./types"

export const WhenEntryRow = ({
  rules,
  ruleIndex,
  clauseName,
  slot,
  entryKey,
  entryValue,
  isReadOnly,
  onCommitRules,
}: {
  rules: DslRule[]
  ruleIndex: number
  clauseName: WhenClauseName
  slot: "matches" | "excludes"
  entryKey: string
  entryValue: string
  isReadOnly: boolean
  onCommitRules: (nextRules: DslRule[]) => void
}) => {
  const [draftKey, setDraftKey] = useState(entryKey)
  const [draftValue, setDraftValue] = useState(entryValue)

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <input
        type="text"
        value={draftKey}
        placeholder="key"
        readOnly={isReadOnly}
        onChange={(event) => {
          setDraftKey(event.target.value)
        }}
        onBlur={() => {
          onCommitRules(
            setWhenEntryKey({
              rules,
              ruleIndex,
              clauseName,
              slot,
              oldKey: entryKey,
              newKey: draftKey,
            }),
          )
        }}
        className="flex-1 min-w-0 bg-surface-sunken text-content-primary text-xs rounded px-2 py-1 border border-border-default focus:outline-none focus:border-border-focus font-mono"
      />
      <span className="text-content-muted text-xs">=</span>
      <input
        type="text"
        value={draftValue}
        placeholder="value"
        readOnly={isReadOnly}
        onChange={(event) => {
          setDraftValue(event.target.value)
        }}
        onBlur={() => {
          onCommitRules(
            setWhenEntryValue({
              rules,
              ruleIndex,
              clauseName,
              slot,
              entryKey,
              value: draftValue,
            }),
          )
        }}
        className="flex-1 min-w-0 bg-surface-sunken text-content-primary text-xs rounded px-2 py-1 border border-border-default focus:outline-none focus:border-border-focus font-mono"
      />
      {!isReadOnly && (
        <IconButton
          label="Remove entry"
          intent="danger"
          appearance="ghost"
          size="sm"
          onClick={() => {
            onCommitRules(
              removeWhenEntry({
                rules,
                ruleIndex,
                clauseName,
                slot,
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
