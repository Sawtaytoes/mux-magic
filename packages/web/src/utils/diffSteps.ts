import { isGroup } from "../jobs/sequenceUtils"
import type { Group, SequenceItem, Step } from "../types"

const flatStepIds = (steps: SequenceItem[]): string[] =>
  steps.flatMap((item) =>
    isGroup(item)
      ? (item as Group).steps.map((step) => step.id)
      : [(item as Step).id],
  )

export const findFirstChangedStepId = (
  nextSteps: SequenceItem[],
  prevSteps: SequenceItem[],
): string | null => {
  const prevIds = new Set(flatStepIds(prevSteps))
  const restoredId = flatStepIds(nextSteps).find(
    (id) => !prevIds.has(id),
  )
  return restoredId ?? null
}
