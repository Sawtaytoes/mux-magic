import type {
  ApplyIfCombinator,
  ApplyIfQuantifier,
  ApplyIfTarget,
} from "./applyIfCombinators"
import {
  APPLY_IF_QUANTIFIER_LABELS,
  APPLY_IF_QUANTIFIERS,
  APPLY_IF_TARGET_LABELS,
  APPLY_IF_TARGETS,
  toApplyIfCombinator,
  toApplyIfQuantifierAndTarget,
} from "./applyIfCombinators"
import { ListboxPicker } from "./ListboxPicker"

/**
 * `applyIf`'s combinator, shaped like `when`'s so the two read the same.
 *
 * The target list is not filtered here because `applyIf`'s grid is
 * complete — every quantifier takes every target. The two-picker split
 * still earns its place: it is what makes "ANY · of these groups"
 * (boolean OR over sub-groups) visibly different from "ANY · style rows"
 * (a quantifier over rows), which is the same distinction that made the
 * flat clause names ambiguous.
 */
export const ApplyIfCombinatorPickers = ({
  isDisabled = false,
  onChange,
  value,
}: {
  isDisabled?: boolean
  onChange: (combinator: ApplyIfCombinator) => void
  value: ApplyIfCombinator
}) => {
  const { quantifier, target } =
    toApplyIfQuantifierAndTarget(value)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-medium text-content-primary text-sm">
        Match
      </span>

      <div className="flex flex-wrap items-center gap-1.5">
        <ListboxPicker
          isDisabled={isDisabled}
          label="Quantifier"
          onChange={(nextQuantifier) => {
            onChange(
              toApplyIfCombinator({
                quantifier:
                  nextQuantifier as ApplyIfQuantifier,
                target,
              }),
            )
          }}
          options={APPLY_IF_QUANTIFIERS.map((option) => ({
            label: APPLY_IF_QUANTIFIER_LABELS[option],
            value: option,
          }))}
          value={quantifier}
        />

        <ListboxPicker
          isDisabled={isDisabled}
          label="Target"
          onChange={(nextTarget) => {
            onChange(
              toApplyIfCombinator({
                quantifier,
                target: nextTarget as ApplyIfTarget,
              }),
            )
          }}
          options={APPLY_IF_TARGETS.map((option) => ({
            label: APPLY_IF_TARGET_LABELS[option],
            value: option,
          }))}
          value={target}
        />
      </div>
    </div>
  )
}
