import { ListboxPicker } from "./ListboxPicker"
import type {
  Quantifier,
  Target,
  WhenCombinator,
} from "./whenCombinators"
import {
  QUANTIFIER_LABELS,
  QUANTIFIERS,
  TARGET_LABELS,
  targetsForQuantifier,
  toQuantifierAndTarget,
  toWhenCombinator,
} from "./whenCombinators"

/**
 * A group's combinator, as the two choices it really is: *how many*, and
 * *of what*. Handed to `QueryBuilder` through `renderCombinator`.
 *
 * The second list is filtered by the first, and that is the point rather
 * than a nicety — `NOT ALL` has only one legal target because the DSL
 * declares `notAllScriptInfo` and no `notAllStyle`. A single flat list
 * could only express that by quietly omitting an entry.
 */
export const WhenCombinatorPickers = ({
  isDisabled = false,
  onChange,
  value,
}: {
  isDisabled?: boolean
  onChange: (combinator: WhenCombinator) => void
  value: WhenCombinator
}) => {
  const { quantifier, target } =
    toQuantifierAndTarget(value)

  const availableTargets = targetsForQuantifier(quantifier)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-medium text-content-primary text-sm">
        Match
      </span>

      <div className="flex flex-wrap items-center gap-1.5">
        <ListboxPicker
          isDisabled={isDisabled}
          label="Quantifier"
          onChange={(nextValue) => {
            const nextQuantifier = nextValue as Quantifier

            const legalTargets =
              targetsForQuantifier(nextQuantifier)

            // Choosing NOT ALL while the target is "style rows" would
            // name a clause that does not exist. Fall back to a legal
            // target rather than holding an unrepresentable pair — the
            // tree would otherwise carry a combinator the adapter has no
            // way to write out.
            const nextTarget = legalTargets.includes(target)
              ? target
              : legalTargets[0]

            const nextCombinator =
              nextTarget === undefined
                ? undefined
                : toWhenCombinator({
                    quantifier: nextQuantifier,
                    target: nextTarget,
                  })

            if (nextCombinator) {
              onChange(nextCombinator)
            }
          }}
          options={QUANTIFIERS.map((option) => ({
            label: QUANTIFIER_LABELS[option],
            value: option,
          }))}
          value={quantifier}
        />

        <ListboxPicker
          isDisabled={isDisabled}
          label="Target"
          onChange={(nextTarget) => {
            const nextCombinator = toWhenCombinator({
              quantifier,
              target: nextTarget as Target,
            })

            if (nextCombinator) {
              onChange(nextCombinator)
            }
          }}
          options={availableTargets.map((option) => ({
            label: TARGET_LABELS[option],
            value: option,
          }))}
          value={target}
        />
      </div>
    </div>
  )
}
