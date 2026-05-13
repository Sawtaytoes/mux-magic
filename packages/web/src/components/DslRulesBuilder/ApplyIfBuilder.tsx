import { ApplyIfClauseRow } from "./ApplyIfClauseRow"
import { isPlainObject } from "./clauseUtils"
import { addApplyIfClause } from "./conditionMutations"
import {
  APPLY_IF_CLAUSE_NAMES,
  type ApplyIfClauseName,
  type ApplyIfEntry,
  type ApplyIfMap,
  type DslRule,
  type OpenDetailsKeys,
} from "./types"

type ApplyIfBuilderProps = {
  rules: DslRule[]
  ruleIndex: number
  applyIfValue: ApplyIfMap | undefined
  isReadOnly: boolean
  stepId: string
  openDetailsKeys: OpenDetailsKeys
  onToggleDetails: (
    detailsKey: string,
    isOpen: boolean,
  ) => void
  onCommitRules: (nextRules: DslRule[]) => void
}

export const ApplyIfBuilder = ({
  rules,
  ruleIndex,
  applyIfValue,
  isReadOnly,
  stepId,
  openDetailsKeys,
  onToggleDetails,
  onCommitRules,
}: ApplyIfBuilderProps) => {
  const applyIf = isPlainObject(applyIfValue)
    ? (applyIfValue as ApplyIfMap)
    : {}
  const usedClauses = new Set(Object.keys(applyIf))
  const availableClauses = APPLY_IF_CLAUSE_NAMES.filter(
    (clauseName) => !usedClauses.has(clauseName),
  )
  const detailsKey = `${stepId}:applyif:${ruleIndex}`
  const isOpen =
    !isReadOnly && openDetailsKeys.has(detailsKey)

  return (
    <details
      open={isOpen}
      className="mt-2 border border-slate-700/60 rounded"
      onToggle={(event) => {
        onToggleDetails(
          detailsKey,
          (event.target as HTMLDetailsElement).open,
        )
      }}
    >
      <summary className="cursor-pointer text-xs text-slate-400 px-2 py-1 select-none">
        Apply If (advanced — leave empty to apply to all
        styles)
      </summary>
      <div className="px-2 py-1.5">
        {APPLY_IF_CLAUSE_NAMES.filter((clauseName) =>
          usedClauses.has(clauseName),
        ).map((clauseName) => {
          const clauseValue = isPlainObject(
            applyIf[clauseName],
          )
            ? (applyIf[clauseName] as Record<
                string,
                ApplyIfEntry
              >)
            : {}
          return (
            <ApplyIfClauseRow
              key={clauseName}
              rules={rules}
              ruleIndex={ruleIndex}
              clauseName={clauseName}
              clauseValue={clauseValue}
              isReadOnly={isReadOnly}
              onCommitRules={onCommitRules}
            />
          )
        })}
        {usedClauses.size === 0 && (
          <p className="text-xs text-slate-500 italic">
            No clauses. Fields applied to all styles.
          </p>
        )}
        {!isReadOnly && availableClauses.length > 0 && (
          <select
            value=""
            onChange={(event) => {
              if (!event.target.value) {
                return
              }
              onCommitRules(
                addApplyIfClause({
                  rules,
                  ruleIndex,
                  clauseName: event.target
                    .value as ApplyIfClauseName,
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
