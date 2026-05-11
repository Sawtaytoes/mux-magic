import { useState } from "react"

import { isPlainObject } from "./clauseUtils"
import {
  addPredicate,
  addPredicateEntry,
  removePredicate,
  removePredicateEntry,
  renamePredicate,
  setPredicateEntryKey,
  setPredicateEntryValue,
} from "./ruleMutations"
import type {
  OpenDetailsKeys,
  PredicatesMap,
} from "./types"

// ─── PredicateEntryRow ────────────────────────────────────────────────────────

const PredicateEntryRow = ({
  predicates,
  predicateName,
  entryKey,
  entryValue,
  isReadOnly,
  onCommitPredicates,
}: {
  predicates: PredicatesMap
  predicateName: string
  entryKey: string
  entryValue: string
  isReadOnly: boolean
  onCommitPredicates: (
    nextPredicates: PredicatesMap,
  ) => void
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
          onCommitPredicates(
            setPredicateEntryKey({
              predicates,
              predicateName,
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
          onCommitPredicates(
            setPredicateEntryValue({
              predicates,
              predicateName,
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
            onCommitPredicates(
              removePredicateEntry({
                predicates,
                predicateName,
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

// ─── PredicateCard ────────────────────────────────────────────────────────────

const PredicateCard = ({
  predicates,
  predicateName,
  isReadOnly,
  onCommitPredicates,
}: {
  predicates: PredicatesMap
  predicateName: string
  isReadOnly: boolean
  onCommitPredicates: (
    nextPredicates: PredicatesMap,
  ) => void
}) => {
  const body = isPlainObject(predicates[predicateName])
    ? (predicates[predicateName] as Record<string, string>)
    : {}
  const [draftName, setDraftName] = useState(predicateName)

  return (
    <div className="border border-slate-700/60 rounded px-2 py-1.5 mt-2 bg-slate-900/30">
      <div className="flex items-center gap-2 mb-1">
        <input
          type="text"
          value={draftName}
          placeholder="predicateName"
          readOnly={isReadOnly}
          onChange={(event) => {
            setDraftName(event.target.value)
          }}
          onBlur={() => {
            onCommitPredicates(
              renamePredicate({
                predicates,
                oldName: predicateName,
                newName: draftName,
              }),
            )
          }}
          className="flex-1 min-w-0 bg-slate-700 text-blue-300 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
        />
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => {
              onCommitPredicates(
                removePredicate({
                  predicates,
                  predicateName,
                }),
              )
            }}
            className="text-xs text-slate-500 hover:text-red-400 px-1"
          >
            ✕
          </button>
        )}
      </div>
      {Object.entries(body).map(
        ([entryKey, entryValue]) => (
          <PredicateEntryRow
            key={entryKey}
            predicates={predicates}
            predicateName={predicateName}
            entryKey={entryKey}
            entryValue={entryValue}
            isReadOnly={isReadOnly}
            onCommitPredicates={onCommitPredicates}
          />
        ),
      )}
      {!isReadOnly && (
        <button
          type="button"
          onClick={() => {
            onCommitPredicates(
              addPredicateEntry({
                predicates,
                predicateName,
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
}

// ─── PredicatesManager (exported) ────────────────────────────────────────────

type PredicatesManagerProps = {
  predicates: PredicatesMap
  isReadOnly: boolean
  stepId: string
  openDetailsKeys: OpenDetailsKeys
  onToggleDetails: (
    detailsKey: string,
    isOpen: boolean,
  ) => void
  onCommitPredicates: (
    nextPredicates: PredicatesMap,
  ) => void
}

export const PredicatesManager = ({
  predicates,
  isReadOnly,
  stepId,
  openDetailsKeys,
  onToggleDetails,
  onCommitPredicates,
}: PredicatesManagerProps) => {
  const detailsKey = `${stepId}:predicates`
  const isOpen =
    !isReadOnly && openDetailsKeys.has(detailsKey)
  const predicateNames = Object.keys(predicates)

  return (
    <details
      open={isOpen}
      className="mt-3 border border-slate-700/60 rounded"
      onToggle={(event) => {
        onToggleDetails(
          detailsKey,
          (event.target as HTMLDetailsElement).open,
        )
      }}
    >
      <summary className="cursor-pointer text-xs text-slate-400 px-2 py-1 select-none">
        Predicates ({predicateNames.length})
      </summary>
      <div className="px-2 py-1.5">
        {predicateNames.map((predicateName) => (
          <PredicateCard
            key={predicateName}
            predicates={predicates}
            predicateName={predicateName}
            isReadOnly={isReadOnly}
            onCommitPredicates={onCommitPredicates}
          />
        ))}
        {predicateNames.length === 0 && (
          <p className="text-xs text-slate-500 italic">
            No predicates. Define reusable match sets here
            to reference via $ref.
          </p>
        )}
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => {
              onCommitPredicates(
                addPredicate({ predicates }),
              )
            }}
            className="text-xs text-slate-400 hover:text-blue-400 mt-2"
          >
            + predicate
          </button>
        )}
      </div>
    </details>
  )
}
