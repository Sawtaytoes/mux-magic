import type {
  Cut,
  PossibleName,
  SpecialFeature,
} from "../tools/parseSpecialFeatures.js"

// Flatten the parser's structured `extras` + `cuts` + standalone
// `possibleNames` (the untimed-suggestions list) into a single ordered
// array of every label the user might want to pick from. Order matches
// the DVDCompare scrape order: parents and children appear in their
// nested position, cut labels follow, and the untimed-suggestion list
// brings up the rear (most of which already appear in `extras`, but the
// final `Array.from(new Set(...))` dedupes while preserving first-seen
// order). The UI dropdown is driven off this list.
export const flattenAllKnownNames = ({
  cuts,
  extras,
  possibleNames,
}: {
  cuts: Cut[]
  extras: SpecialFeature[]
  possibleNames: PossibleName[]
}): string[] => {
  const fromExtras = extras.flatMap((extra) => {
    const children = (extra.children ?? []).map(
      (child) => child.text,
    )
    return [extra.text, ...children]
  })
  const fromCuts = cuts
    .map((cut) => cut.name)
    .filter(Boolean)
  const fromPossibleNames = possibleNames.map(
    (entry) => entry.name,
  )
  const combined = [
    ...fromExtras,
    ...fromCuts,
    ...fromPossibleNames,
  ]
    .map((label) => label.trim())
    .filter(Boolean)
  return Array.from(new Set(combined))
}
