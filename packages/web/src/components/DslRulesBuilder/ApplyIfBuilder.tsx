import { useState } from "react"

import { isPlainObject } from "./clauseUtils"
import {
  addApplyIfClause,
  addApplyIfEntry,
  removeApplyIfClause,
  removeApplyIfEntry,
  setApplyIfEntryComparator,
  setApplyIfEntryKey,
  setApplyIfEntryOperand,
} from "./conditionMutations"
import {
  APPLY_IF_CLAUSE_NAMES,
  type ApplyIfClauseName,
  type ApplyIfEntry,
  type ApplyIfMap,
  COMPARATOR_VERBS,
  type ComparatorVerb,
  type DslRule,
  type OpenDetailsKeys,
} from "./types"

// ─── ApplyIfEntryRow ──────────────────────────────────────────────────────────

const ApplyIfEntryRow = ({
  rules,
  ruleIndex,
  clauseName,
  entryKey,
  entryValue,
  isReadOnly,
  onCommitRules,
}: {
  rules: DslRule[]
  ruleIndex: number
  clauseName: ApplyIfClauseName
  entryKey: string
  entryValue: ApplyIfEntry
  isReadOnly: boolean
  onCommitRules: (nextRules: DslRule[]) => void
}) => {
  const verb = isPlainObject(entryValue)
    ? ((Object.keys(entryValue)[0] as ComparatorVerb) ??
      "eq")
    : "eq"
  const operand = isPlainObject(entryValue)
    ? (Object.values(
        entryValue as Record<string, number>,
      )[0] ?? 0)
    : 0

  const [draftKey, setDraftKey] = useState(entryKey)
  const [draftOperand, setDraftOperand] = useState(
    String(operand),
  )

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <input
        type="text"
        value={draftKey}
        placeholder="FieldName"
        readOnly={isReadOnly}
        onChange={(event) => {
          setDraftKey(event.target.value)
        }}
        onBlur={() => {
          onCommitRules(
            setApplyIfEntryKey({
              rules,
              ruleIndex,
              clauseName,
              oldKey: entryKey,
              newKey: draftKey,
            }),
          )
        }}
        className="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
      />
      <select
        disabled={isReadOnly}
        value={verb}
        onChange={(event) => {
          onCommitRules(
            setApplyIfEntryComparator({
              rules,
              ruleIndex,
              clauseName,
              entryKey,
              verb: event.target.value as ComparatorVerb,
            }),
          )
        }}
        className="text-xs bg-slate-700 text-slate-200 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500"
      >
        {COMPARATOR_VERBS.map((comparatorVerb) => (
          <option
            key={comparatorVerb}
            value={comparatorVerb}
          >
            {comparatorVerb}
          </option>
        ))}
      </select>
      <input
        type="number"
        value={draftOperand}
        readOnly={isReadOnly}
        onChange={(event) => {
          setDraftOperand(event.target.value)
        }}
        onBlur={() => {
          const parsed =
            draftOperand === "" ? 0 : Number(draftOperand)
          onCommitRules(
            setApplyIfEntryOperand({
              rules,
              ruleIndex,
              clauseName,
              entryKey,
              operand: parsed,
            }),
          )
        }}
        className="w-20 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
      />
      {!isReadOnly && (
        <button
          type="button"
          onClick={() => {
            onCommitRules(
              removeApplyIfEntry({
                rules,
                ruleIndex,
                clauseName,
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

// ─── ApplyIfClauseRow ─────────────────────────────────────────────────────────

const ApplyIfClauseRow = ({
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

// ─── ApplyIfBuilder (exported) ────────────────────────────────────────────────

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
