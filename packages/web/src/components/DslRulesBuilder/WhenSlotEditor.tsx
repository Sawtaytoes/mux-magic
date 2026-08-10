import { Button, Select } from "@charcuterie/ui"
import { isPlainObject, isRefBody } from "./clauseUtils"
import {
  addWhenEntry,
  setWhenClauseRef,
} from "./conditionMutations"
import type {
  DslRule,
  PredicatesMap,
  WhenClauseName,
} from "./types"
import { WhenEntryRow } from "./WhenEntryRow"

export const WhenSlotEditor = ({
  rules,
  ruleIndex,
  clauseName,
  slot,
  slotValue,
  predicates,
  isReadOnly,
  onCommitRules,
}: {
  rules: DslRule[]
  ruleIndex: number
  clauseName: WhenClauseName
  slot: "matches" | "excludes"
  slotValue: unknown
  predicates: PredicatesMap
  isReadOnly: boolean
  onCommitRules: (nextRules: DslRule[]) => void
}) => {
  const isRef = isRefBody(slotValue)
  const refName = isRef
    ? (slotValue as { $ref: string }).$ref
    : ""
  const slotLabel =
    slot === "matches" ? "Matches" : "Excludes"
  const slotBody =
    isPlainObject(slotValue) && !isRef
      ? (slotValue as Record<string, string>)
      : {}
  const predicateNames = Object.keys(predicates)

  return (
    <div className="border border-border-subtle rounded px-2 py-1.5 bg-surface-raised">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-content-secondary">
          {slotLabel}
        </span>
        <Select
          className="w-56 font-mono"
          isDisabled={isReadOnly}
          key={refName}
          label={`${slotLabel} predicate`}
          onChange={(nextRefName) => {
            onCommitRules(
              setWhenClauseRef({
                rules,
                ruleIndex,
                clauseName,
                slot,
                refName: nextRefName,
              }),
            )
          }}
          options={[
            { label: "— inline —", value: "" },
            ...predicateNames.map((predicateName) => ({
              label: `$ref: ${predicateName}`,
              value: predicateName,
            })),
          ]}
          size="sm"
          value={refName}
        />
      </div>
      {!isRef && (
        <>
          {Object.entries(slotBody).map(
            ([entryKey, entryValue]) => (
              <WhenEntryRow
                key={entryKey}
                rules={rules}
                ruleIndex={ruleIndex}
                clauseName={clauseName}
                slot={slot}
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
                  addWhenEntry({
                    rules,
                    ruleIndex,
                    clauseName,
                    slot,
                  }),
                )
              }}
            >
              + entry
            </Button>
          )}
        </>
      )}
    </div>
  )
}
