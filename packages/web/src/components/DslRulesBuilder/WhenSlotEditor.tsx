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
    <div className="border border-slate-700/60 rounded px-2 py-1.5 bg-slate-900/40">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">
          {slotLabel}
        </span>
        <select
          disabled={isReadOnly}
          value={refName}
          onChange={(event) => {
            onCommitRules(
              setWhenClauseRef({
                rules,
                ruleIndex,
                clauseName,
                slot,
                refName: event.target.value,
              }),
            )
          }}
          className="text-xs bg-slate-700 text-slate-200 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500"
        >
          <option value="">
            {refName ? "" : "— inline —"}
          </option>
          {predicateNames.map((predicateName) => (
            <option
              key={predicateName}
              value={predicateName}
            >
              $ref: {predicateName}
            </option>
          ))}
        </select>
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
            <button
              type="button"
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
              className="text-xs text-slate-400 hover:text-blue-400 mt-1"
            >
              + entry
            </button>
          )}
        </>
      )}
    </div>
  )
}
