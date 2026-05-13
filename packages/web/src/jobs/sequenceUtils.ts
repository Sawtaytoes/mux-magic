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
