import { Button } from "@charcuterie/ui"

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
                removeWhenClause({
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
