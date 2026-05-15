import type { Group, SequenceItem, Step } from "../types"

export const isGroup = (
  item: SequenceItem,
): item is Group => "kind" in item && item.kind === "group"

export const findStepById = (
  steps: SequenceItem[],
  stepId: string,
): Step | undefined =>
  steps.reduce<Step | undefined>((found, item) => {
    if (found) return found
    if (isGroup(item)) {
      return item.steps.find((step) => step.id === stepId)
    }
    return (item as Step).id === stepId
      ? (item as Step)
      : undefined
  }, undefined)

// eslint-disable-next-line no-restricted-syntax -- UI helper type for flattening the step tree; not an API shape
export type FlatEntry = { step: Step; flatIndex: number }

// Returns the set of every id used by an item in the sequence —
// top-level steps, groups, and group children. Used by the insertion
// atoms to skip suffixes that would collide with an existing item
// when stepCounterAtom has fallen behind reality (e.g. after paste
// or load from a sparsely-numbered template).
export const collectStepAndGroupIds = (
  items: SequenceItem[],
): Set<string> => {
  const taken = new Set<string>()
  for (const item of items) {
    if (isGroup(item)) {
      taken.add(item.id)
      for (const step of (item as Group).steps)
        taken.add(step.id)
    } else {
      taken.add((item as Step).id)
    }
  }
  return taken
}

// Flattens top-level steps + group children into a single numbered list.
// Groups don't occupy a flat index slot; only their inner steps do.
export const flattenSteps = (
  items: SequenceItem[],
): FlatEntry[] => {
  const entries: FlatEntry[] = []
  items.forEach((item) => {
    const stepsInItem = isGroup(item)
      ? (item as Group).steps
      : [item as Step]
    stepsInItem.forEach((step) => {
      entries.push({ step, flatIndex: entries.length })
    })
  })
  return entries
}
