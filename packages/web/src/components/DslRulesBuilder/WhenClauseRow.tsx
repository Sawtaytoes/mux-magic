import { normalizeWhenClause } from "./clauseUtils"
import { removeWhenClause } from "./conditionMutations"
import type {
  DslRule,
  PredicatesMap,
  WhenClauseName,
} from "./types"
import { WhenSlotEditor } from "./WhenSlotEditor"

export const WhenClauseRow = ({
  rules,
  ruleIndex,
  clauseName,
  clauseValue,
  predicates,
  isReadOnly,
  onCommitRules,
}: {
  rules: DslRule[]
  ruleIndex: number
  clauseName: WhenClauseName
  clauseValue: unknown
  predicates: PredicatesMap
  isReadOnly: boolean
  onCommitRules: (nextRules: DslRule[]) => void
}) => {
  const canonical = normalizeWhenClause(clauseValue)

  return (
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
                removeWhenClause({
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
      <WhenSlotEditor
        rules={rules}
        ruleIndex={ruleIndex}
        clauseName={clauseName}
        slot="matches"
        slotValue={canonical.matches}
        predicates={predicates}
        isReadOnly={isReadOnly}
        onCommitRules={onCommitRules}
      />
      <div className="mt-1.5">
        <WhenSlotEditor
          rules={rules}
          ruleIndex={ruleIndex}
          clauseName={clauseName}
          slot="excludes"
          slotValue={canonical.excludes}
          predicates={predicates}
          isReadOnly={isReadOnly}
          onCommitRules={onCommitRules}
        />
      </div>
    </div>
  )
}
