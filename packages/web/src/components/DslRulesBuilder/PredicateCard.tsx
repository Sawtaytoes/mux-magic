import { Button } from "@charcuterie/ui"
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
      className="border border-border-subtle rounded px-2 py-1.5 mt-2 bg-surface-raised"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-content-muted shrink-0">
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
          className="flex-1 min-w-0 bg-surface-sunken text-intent-accent-content text-xs rounded px-2 py-1 border border-border-default focus:outline-none focus:border-border-focus font-mono"
        />
        {!isReadOnly && (
          <Button
            intent="danger"
            appearance="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => {
              onCommitPredicates(
                removePredicate({
                  predicates,
                  predicateName,
                }),
              )
            }}
          >
            ✕ Remove
          </Button>
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
        <Button
          intent="neutral"
          appearance="ghost"
          size="sm"
          className="mt-1"
          onClick={() => {
            onCommitPredicates(
              addPredicateEntry({
                predicates,
                predicateName,
              }),
            )
          }}
        >
          + entry
        </Button>
      )}
    </div>
  )
}
