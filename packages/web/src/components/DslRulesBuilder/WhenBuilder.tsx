import { isPlainObject } from "./clauseUtils"
import { addWhenClause } from "./conditionMutations"
import {
  type DslRule,
  type OpenDetailsKeys,
  type PredicatesMap,
  WHEN_CLAUSE_NAMES,
  type WhenClauseName,
  type WhenMap,
} from "./types"
import { WhenClauseRow } from "./WhenClauseRow"

type WhenBuilderProps = {
  rules: DslRule[]
  ruleIndex: number
  whenValue: WhenMap | undefined
  predicates: PredicatesMap
  isReadOnly: boolean
  stepId: string
  openDetailsKeys: OpenDetailsKeys
  onToggleDetails: (
    detailsKey: string,
    isOpen: boolean,
  ) => void
  onCommitRules: (nextRules: DslRule[]) => void
}

export const WhenBuilder = ({
  rules,
  ruleIndex,
  whenValue,
  predicates,
  isReadOnly,
  stepId,
  openDetailsKeys,
  onToggleDetails,
  onCommitRules,
}: WhenBuilderProps) => {
  const when = isPlainObject(whenValue)
    ? (whenValue as WhenMap)
    : {}
  const usedClauses = new Set(Object.keys(when))
  const availableClauses = WHEN_CLAUSE_NAMES.filter(
    (clauseName) => !usedClauses.has(clauseName),
  )
  const detailsKey = `${stepId}:when:${ruleIndex}`
  const isOpen =
    !isReadOnly && openDetailsKeys.has(detailsKey)

  return (
    <details
      open={isOpen}
      data-details-key={detailsKey}
      className="mt-2 border border-slate-700/60 rounded"
      onToggle={(event) => {
        onToggleDetails(
          detailsKey,
          (event.target as HTMLDetailsElement).open,
        )
      }}
    >
      <summary className="cursor-pointer text-xs text-slate-400 px-2 py-1 select-none">
        When (advanced — leave empty to always fire)
      </summary>
      <div className="px-2 py-1.5">
        {WHEN_CLAUSE_NAMES.filter((clauseName) =>
          usedClauses.has(clauseName),
        ).map((clauseName) => (
          <WhenClauseRow
            key={clauseName}
            rules={rules}
            ruleIndex={ruleIndex}
            clauseName={clauseName}
            clauseValue={when[clauseName]}
            predicates={predicates}
            isReadOnly={isReadOnly}
            onCommitRules={onCommitRules}
          />
        ))}
        {usedClauses.size === 0 && (
          <p className="text-xs text-slate-500 italic">
            No clauses. Rule fires on every batch.
          </p>
        )}
        {!isReadOnly && availableClauses.length > 0 && (
          <select
            aria-label="Condition type"
            value=""
            onChange={(event) => {
              if (!event.target.value) {
                return
              }
              onCommitRules(
                addWhenClause({
                  rules,
                  ruleIndex,
                  clauseName: event.target
                    .value as WhenClauseName,
                }),
              )
              event.target.value = ""
            }}
            className="text-xs bg-slate-700 text-slate-200 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500 mt-2"
          >
            <option value="">+ Add clause…</option>
            {availableClauses.map((clauseName) => (
              <option key={clauseName} value={clauseName}>
                {clauseName}
              </option>
            ))}
          </select>
        )}
      </div>
    </details>
  )
}
