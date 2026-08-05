import { Accordion, Select } from "@charcuterie/ui"
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
    <Accordion
      className="mt-2"
      expandedKeys={isOpen ? [detailsKey] : []}
      items={[
        {
          content: (
            <>
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
                <p className="text-xs text-content-muted italic">
                  No clauses. Fields applied to all styles.
                </p>
              )}
              {!isReadOnly &&
                availableClauses.length > 0 && (
                  <Select
                    className="mt-2 w-56 font-mono"
                    // The old `<select>` had no accessible name at all — no
                    // `aria-label`, no `<label for>` — so it was announced as
                    // "combobox" and `getByRole("combobox", { name })` could not
                    // find it. `Select` makes the name a required-in-practice
                    // prop for exactly that reason.
                    label="Apply-if clause type"
                    onChange={(clauseName) => {
                      if (!clauseName) {
                        return
                      }

                      onCommitRules(
                        addApplyIfClause({
                          rules,
                          ruleIndex,
                          clauseName:
                            clauseName as ApplyIfClauseName,
                        }),
                      )
                    }}
                    options={availableClauses.map(
                      (clauseName) => ({
                        label: clauseName,
                        value: clauseName,
                      }),
                    )}
                    // Same one-shot reset as `WhenBuilder`, and the same direct
                    // DOM write deleted with it.
                    placeholder="+ Add clause…"
                    size="sm"
                  />
                )}
            </>
          ),
          // Disabled rather than collapsed in the read-only preview — see
          // `WhenBuilder` for what `<details>` could not express.
          isDisabled: isReadOnly,
          key: detailsKey,
          label:
            "Apply If (advanced — leave empty to apply to all styles)",
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
