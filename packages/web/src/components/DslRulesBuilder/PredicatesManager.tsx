import { Accordion, Button } from "@charcuterie/ui"

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
  const predicateNames = Object.keys(predicates)

  /*
    The eleventh disclosure, and the one the M6b brief did not list — it is
    the only one that was NOT a `<details>`, so a grep for `<details>` misses
    it entirely. Its trigger was a plain `<button>` with a chevron icon and
    **no `aria-expanded`**, beside a conditionally rendered `<div>`: exactly
    `ErrorRow`'s defect, rendering perfectly.

    `data-details-key` went with it. It was a `data-testid` under another
    name; `e2e/dsl-rules.spec.ts` finds this by the trigger's accessible
    name now.
  */
  return (
    <Accordion
      className="mt-3"
      expandedKeys={
        !isReadOnly && openDetailsKeys.has(detailsKey)
          ? [detailsKey]
          : []
      }
      items={[
        {
          content: (
            <>
              {predicateNames.map((predicateName) => (
                <PredicateCard
                  isReadOnly={isReadOnly}
                  key={predicateName}
                  onCommitPredicates={onCommitPredicates}
                  predicateName={predicateName}
                  predicates={predicates}
                />
              ))}

              {predicateNames.length === 0 && (
                <p className="text-xs text-content-muted italic">
                  No predicates. Define reusable match sets
                  here to reference via $ref.
                </p>
              )}

              {!isReadOnly && (
                <Button
                  intent="neutral"
                  appearance="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    onCommitPredicates(
                      addPredicate({ predicates }),
                    )
                  }}
                >
                  + Add predicate
                </Button>
              )}
            </>
          ),
          key: detailsKey,
          label: `Predicates (${predicateNames.length})`,
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
