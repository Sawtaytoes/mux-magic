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
  <div className="border border-slate-700 rounded px-2 py-2 mt-2 bg-slate-900/30">
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs font-mono text-blue-300">
        {clauseName}
      </span>
      {!isReadOnly && (
        <button
          type="button"
          onClick={() => {
            onCommitRules(
              removeApplyIfClause({
                rules,
                ruleIndex,
                clauseName,
              }),
            )
          }}
          className="text-xs text-slate-500 hover:text-red-400"
        >
          ✕ Remove clause
        </button>
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
      <button
        type="button"
        onClick={() => {
          onCommitRules(
            addApplyIfEntry({
              rules,
              ruleIndex,
              clauseName,
            }),
          )
        }}
        className="text-xs text-slate-400 hover:text-blue-400 mt-1"
      >
        + entry
      </button>
    )}
  </div>
)
