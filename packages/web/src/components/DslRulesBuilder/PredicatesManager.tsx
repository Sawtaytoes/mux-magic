import { useState } from "react"

import { CollapseChevron } from "../../icons/CollapseChevron/CollapseChevron"
import { PredicateCard } from "./PredicateCard"
import { addPredicate } from "./ruleMutations"
import type {
  OpenDetailsKeys,
  PredicatesMap,
} from "./types"

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
  const [isOpen, setIsOpen] = useState(
    !isReadOnly && openDetailsKeys.has(detailsKey),
  )
  const predicateNames = Object.keys(predicates)

  return (
    <div
      data-details-key={detailsKey}
      className="mt-3 border border-slate-700/60 rounded"
    >
      <button
        type="button"
        onClick={() => {
          const isNextOpen = !isOpen
          setIsOpen(isNextOpen)
          onToggleDetails(detailsKey, isNextOpen)
        }}
        className="flex items-center gap-1 cursor-pointer text-xs text-slate-400 px-2 py-1 select-none w-full text-left"
      >
        <CollapseChevron isCollapsed={!isOpen} />
        Predicates ({predicateNames.length})
      </button>
      {isOpen && (
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
              + Add predicate
            </button>
          )}
        </div>
      )}
    </div>
  )
}
