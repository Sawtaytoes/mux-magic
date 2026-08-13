// The `when:` combinator, modelled as the PRODUCT it actually is.
//
// A group's combinator answers two questions at once: *how many* (ANY /
// ALL / NO / NOT ALL) and *of what* (these sub-groups, style rows,
// script-info blocks). Flattened into one ten-entry list those read as
// arbitrary vocabulary; split in two they are two small choices, and the
// second list filters on the first.
//
// The filtering is not tidiness. `WhenPredicate` in `packages/core`
// declares `notAllScriptInfo` and **no `notAllStyle`**, so one cell of
// the grid does not exist. A single flat list can only express that by
// silently omitting an entry; two pickers can shorten the second list and
// say why.

export type Quantifier = "all" | "any" | "none" | "notAll"

export type Target = "group" | "scriptInfo" | "style"

/**
 * The opaque `Combinator` the tree carries. Boolean joiners over
 * sub-groups (`all`/`any`/`none`, matching `WhenBooleanNode`) plus the
 * seven clause names the DSL already had — so a tree that never nests
 * still serializes to today's `WhenPredicate`.
 */
export type WhenCombinator =
  | "all"
  | "allScriptInfo"
  | "allStyle"
  | "any"
  | "anyScriptInfo"
  | "anyStyle"
  | "none"
  | "noneScriptInfo"
  | "noneStyle"
  | "notAllScriptInfo"

export const QUANTIFIER_LABELS = {
  all: "ALL",
  any: "ANY",
  none: "NO",
  notAll: "NOT ALL",
} as const satisfies Record<Quantifier, string>

export const TARGET_LABELS = {
  group: "of these groups",
  scriptInfo: "script info",
  style: "style rows",
} as const satisfies Record<Target, string>

const COMBINATOR_BY_PAIR = {
  "all:group": "all",
  "all:scriptInfo": "allScriptInfo",
  "all:style": "allStyle",
  "any:group": "any",
  "any:scriptInfo": "anyScriptInfo",
  "any:style": "anyStyle",
  "none:group": "none",
  "none:scriptInfo": "noneScriptInfo",
  "none:style": "noneStyle",
  // No `notAll:group` (the evaluator has never meant a boolean NAND) and
  // no `notAll:style` (the DSL has no such clause). Neither is invented
  // here to square the table.
  "notAll:scriptInfo": "notAllScriptInfo",
} as const satisfies Partial<
  Record<`${Quantifier}:${Target}`, WhenCombinator>
>

type CombinatorPair = keyof typeof COMBINATOR_BY_PAIR

const PAIR_BY_COMBINATOR = Object.fromEntries(
  Object.entries(COMBINATOR_BY_PAIR).map(
    ([pair, combinator]) => [combinator, pair],
  ),
) as Record<WhenCombinator, CombinatorPair>

export const toWhenCombinator = ({
  quantifier,
  target,
}: {
  quantifier: Quantifier
  target: Target
}): WhenCombinator | undefined =>
  COMBINATOR_BY_PAIR[
    `${quantifier}:${target}` as CombinatorPair
  ]

export const toQuantifierAndTarget = (
  combinator: WhenCombinator,
): { quantifier: Quantifier; target: Target } => {
  const [quantifier, target] =
    PAIR_BY_COMBINATOR[combinator].split(":")

  return {
    quantifier: quantifier as Quantifier,
    target: target as Target,
  }
}

export const QUANTIFIERS = [
  "all",
  "any",
  "none",
  "notAll",
] as const satisfies readonly Quantifier[]

/** The dynamic half: the targets this quantifier can legally take. */
export const targetsForQuantifier = (
  quantifier: Quantifier,
): readonly Target[] =>
  (["group", "style", "scriptInfo"] as const).filter(
    (target) =>
      toWhenCombinator({ quantifier, target }) !==
      undefined,
  )

/** A boolean joiner combines child nodes; anything else quantifies rows. */
export const getIsBooleanCombinator = (
  combinator: WhenCombinator,
) => toQuantifierAndTarget(combinator).target === "group"

/**
 * The flat list `QueryBuilder` still wants for its default picker. The
 * builder overrides that picker with `renderCombinator`, so this is the
 * fallback rendering and the source of truth for what is legal.
 */
export const WHEN_COMBINATOR_OPTIONS = Object.values(
  COMBINATOR_BY_PAIR,
).map((combinator) => {
  const { quantifier, target } =
    toQuantifierAndTarget(combinator)

  return {
    label: `${QUANTIFIER_LABELS[quantifier]} ${TARGET_LABELS[target]}`,
    value: combinator,
  }
})
