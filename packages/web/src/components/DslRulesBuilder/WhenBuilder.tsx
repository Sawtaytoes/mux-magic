import { useState } from "react"
import {
  isPlainObject,
  isRefBody,
  normalizeWhenClause,
} from "./clauseUtils"
import {
  addWhenClause,
  addWhenEntry,
  removeWhenClause,
  removeWhenEntry,
  setWhenClauseRef,
  setWhenEntryKey,
  setWhenEntryValue,
} from "./conditionMutations"
import {
  type DslRule,
  type OpenDetailsKeys,
  type PredicatesMap,
  WHEN_CLAUSE_NAMES,
  type WhenClauseName,
  type WhenMap,
} from "./types"

// ─── WhenSlotEditor ───────────────────────────────────────────────────────────

const WhenSlotEditor = ({
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

// ─── WhenEntryRow ─────────────────────────────────────────────────────────────

const WhenEntryRow = ({
  rules,
  ruleIndex,
  clauseName,
  slot,
  entryKey,
  entryValue,
  isReadOnly,
  onCommitRules,
}: {
  rules: DslRule[]
  ruleIndex: number
  clauseName: WhenClauseName
  slot: "matches" | "excludes"
  entryKey: string
  entryValue: string
  isReadOnly: boolean
  onCommitRules: (nextRules: DslRule[]) => void
}) => {
  const [draftKey, setDraftKey] = useState(entryKey)
  const [draftValue, setDraftValue] = useState(entryValue)

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <input
        type="text"
        value={draftKey}
        placeholder="key"
        readOnly={isReadOnly}
        onChange={(event) => {
          setDraftKey(event.target.value)
        }}
        onBlur={() => {
          onCommitRules(
            setWhenEntryKey({
              rules,
              ruleIndex,
              clauseName,
              slot,
              oldKey: entryKey,
              newKey: draftKey,
            }),
          )
        }}
        className="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
      />
      <span className="text-slate-500 text-xs">=</span>
      <input
        type="text"
        value={draftValue}
        placeholder="value"
        readOnly={isReadOnly}
        onChange={(event) => {
          setDraftValue(event.target.value)
        }}
        onBlur={() => {
          onCommitRules(
            setWhenEntryValue({
              rules,
              ruleIndex,
              clauseName,
              slot,
              entryKey,
              value: draftValue,
            }),
          )
        }}
        className="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
      />
      {!isReadOnly && (
        <button
          type="button"
          onClick={() => {
            onCommitRules(
              removeWhenEntry({
                rules,
                ruleIndex,
                clauseName,
                slot,
                entryKey,
              }),
            )
          }}
          className="text-xs text-slate-500 hover:text-red-400 px-1.5"
        >
          ✕
        </button>
      )}
    </div>
  )
}

// ─── WhenClauseRow ────────────────────────────────────────────────────────────

const WhenClauseRow = ({
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

// ─── WhenBuilder (exported) ───────────────────────────────────────────────────

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
