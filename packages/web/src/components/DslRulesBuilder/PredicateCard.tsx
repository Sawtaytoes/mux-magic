import { useState } from "react"
import { isPlainObject } from "./clauseUtils"
import { PredicateEntryRow } from "./PredicateEntryRow"
import {
  addPredicateEntry,
  removePredicate,
  renamePredicate,
} from "./ruleMutations"
import type { PredicatesMap } from "./types"

export const PredicateCard = ({
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
    <div
      data-predicate-key={predicateName}
      className="border border-slate-700/60 rounded px-2 py-1.5 mt-2 bg-slate-900/30"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-slate-500 shrink-0">
          name
        </span>
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
            className="text-xs text-slate-500 hover:text-red-400 px-1 shrink-0"
          >
            ✕ Remove
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
