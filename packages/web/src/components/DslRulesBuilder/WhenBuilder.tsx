import { Accordion, Select } from "@charcuterie/ui"
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
    <Accordion
      className="mt-2"
      expandedKeys={isOpen ? [detailsKey] : []}
      items={[
        {
          content: (
            <>
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
              {!isReadOnly &&
                availableClauses.length > 0 && (
                  <Select
                    className="mt-2 w-56 font-mono"
                    label="Condition type"
                    onChange={(clauseName) => {
                      if (!clauseName) {
                        return
                      }

                      onCommitRules(
                        addWhenClause({
                          rules,
                          ruleIndex,
                          clauseName:
                            clauseName as WhenClauseName,
                        }),
                      )
                    }}
                    options={availableClauses.map(
                      (clauseName) => ({
                        label: clauseName,
                        value: clauseName,
                      }),
                    )}
                    // The old markup reset itself with `event.target.value = ""`
                    // — a direct DOM write, on a control React thought it owned,
                    // to make a one-shot action list look unchosen again. It is
                    // gone: the picked clause leaves `availableClauses` on the
                    // same commit, so the browser falls back to the disabled
                    // placeholder on its own.
                    placeholder="+ Add clause…"
                    size="sm"
                  />
                )}
            </>
          ),
          // A read-only preview's section is DISABLED, not merely
          // collapsed. `<details>` could not do this — a `<summary>`
          // cannot be disabled — so `open={false}` was the only lever and
          // the user could still click it open, at which point
          // `onToggleDetails` was a no-op and nothing pushed the section
          // shut again. It rendered exactly like a working disclosure.
          isDisabled: isReadOnly,
          key: detailsKey,
          label:
            "When (advanced — leave empty to always fire)",
        },
      ]}
      onChange={(expandedKeys) => {
        onToggleDetails(
          detailsKey,
          expandedKeys.includes(detailsKey),
        )
      }}
    />
  )
}
