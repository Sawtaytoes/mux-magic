import { Button } from "@charcuterie/ui"

import { ApplyIfEntryRow } from "./ApplyIfEntryRow"
import {
  addApplyIfEntry,
  removeApplyIfClause,
} from "./conditionMutations"
import type {
  ApplyIfClauseName,
  ApplyIfEntry,
  DslRule,
} from "./types"

export const ApplyIfClauseRow = ({
  rules,
  ruleIndex,
  clauseName,
  clauseValue,
  isReadOnly,
  onCommitRules,
}: {
  rules: DslRule[]
  ruleIndex: number
  clauseName: ApplyIfClauseName
  clauseValue: Record<string, ApplyIfEntry>
  isReadOnly: boolean
  onCommitRules: (nextRules: DslRule[]) => void
}) => (
  <div className="border border-border-default rounded px-2 py-2 mt-2 bg-surface-raised">
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs font-mono text-intent-accent-content">
        {clauseName}
      </span>
      {!isReadOnly && (
        <Button
          intent="danger"
          appearance="ghost"
          size="sm"
          onClick={() => {
            onCommitRules(
              removeApplyIfClause({
                rules,
                ruleIndex,
                clauseName,
              }),
            )
          }}
        >
          ✕ Remove clause
        </Button>
      )}
    </div>
    {Object.entries(clauseValue).map(
      ([entryKey, entryValue]) => (
        <ApplyIfEntryRow
          key={entryKey}
          rules={rules}
          ruleIndex={ruleIndex}
          clauseName={clauseName}
          entryKey={entryKey}
          entryValue={entryValue}
          isReadOnly={isReadOnly}
          onCommitRules={onCommitRules}
        />
      ),
    )}
    {!isReadOnly && (
      <Button
        intent="neutral"
        appearance="ghost"
        size="sm"
        className="mt-1"
        onClick={() => {
          onCommitRules(
            addApplyIfEntry({
              rules,
              ruleIndex,
              clauseName,
            }),
          )
        }}
      >
        + entry
      </Button>
    )}
  </div>
)
