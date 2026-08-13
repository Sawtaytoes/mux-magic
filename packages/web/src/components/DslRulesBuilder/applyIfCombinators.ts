// The `applyIf` combinator, modelled the same way `when`'s is: a
// quantifier crossed with a target.
//
// Simpler than `when` on both axes — every `applyIf` clause is
// style-scoped, so the target is only "these groups" or "style rows",
// and there is no NOT ALL. The shape is kept identical anyway, because
// two rule predicates that read differently in the same editor would be
// the trap the symmetry in `packages/core` exists to avoid.

export type ApplyIfQuantifier = "all" | "any" | "none"

export type ApplyIfTarget = "group" | "style"

export type ApplyIfCombinator =
  | "all"
  | "allStyleMatches"
  | "any"
  | "anyStyleMatches"
  | "none"
  | "noneStyleMatches"

export const APPLY_IF_QUANTIFIER_LABELS = {
  all: "ALL",
  any: "ANY",
  none: "NO",
} as const satisfies Record<ApplyIfQuantifier, string>

export const APPLY_IF_TARGET_LABELS = {
  group: "of these groups",
  style: "style rows",
} as const satisfies Record<ApplyIfTarget, string>

const COMBINATOR_BY_PAIR = {
  "all:group": "all",
  "all:style": "allStyleMatches",
  "any:group": "any",
  "any:style": "anyStyleMatches",
  "none:group": "none",
  "none:style": "noneStyleMatches",
} as const satisfies Record<
  `${ApplyIfQuantifier}:${ApplyIfTarget}`,
  ApplyIfCombinator
>

type ApplyIfPair = keyof typeof COMBINATOR_BY_PAIR

const PAIR_BY_COMBINATOR = Object.fromEntries(
  Object.entries(COMBINATOR_BY_PAIR).map(
    ([pair, combinator]) => [combinator, pair],
  ),
) as Record<ApplyIfCombinator, ApplyIfPair>

export const toApplyIfCombinator = ({
  quantifier,
  target,
}: {
  quantifier: ApplyIfQuantifier
  target: ApplyIfTarget
}): ApplyIfCombinator =>
  COMBINATOR_BY_PAIR[`${quantifier}:${target}`]

export const toApplyIfQuantifierAndTarget = (
  combinator: ApplyIfCombinator,
): {
  quantifier: ApplyIfQuantifier
  target: ApplyIfTarget
} => {
  const [quantifier, target] =
    PAIR_BY_COMBINATOR[combinator].split(":")

  return {
    quantifier: quantifier as ApplyIfQuantifier,
    target: target as ApplyIfTarget,
  }
}

export const APPLY_IF_QUANTIFIERS = [
  "all",
  "any",
  "none",
] as const satisfies readonly ApplyIfQuantifier[]

export const APPLY_IF_TARGETS = [
  "group",
  "style",
] as const satisfies readonly ApplyIfTarget[]

export const getIsBooleanApplyIfCombinator = (
  combinator: ApplyIfCombinator,
) =>
  toApplyIfQuantifierAndTarget(combinator).target ===
  "group"

export const APPLY_IF_COMBINATOR_OPTIONS = Object.values(
  COMBINATOR_BY_PAIR,
).map((combinator) => {
  const { quantifier, target } =
    toApplyIfQuantifierAndTarget(combinator)

  return {
    label: `${APPLY_IF_QUANTIFIER_LABELS[quantifier]} ${APPLY_IF_TARGET_LABELS[target]}`,
    value: combinator,
  }
})
