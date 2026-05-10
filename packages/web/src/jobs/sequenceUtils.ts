import type { Group, SequenceItem, Step } from "../types"

export const isGroup = (item: SequenceItem): item is Group =>
  "kind" in item && item.kind === "group"

export const findStepById = (
  steps: SequenceItem[],
  stepId: string,
): Step | undefined => {
  for (const item of steps) {
    if (isGroup(item)) {
      const found = item.steps.find((step) => step.id === stepId)
      if (found) return found
    } else if (item.id === stepId) {
      return item as Step
    }
  }
  return undefined
}
