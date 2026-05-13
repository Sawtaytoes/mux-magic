import { useState } from "react"
import {
  removePredicateEntry,
  setPredicateEntryKey,
  setPredicateEntryValue,
} from "./ruleMutations"
import type { PredicatesMap } from "./types"

export const PredicateEntryRow = ({
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
