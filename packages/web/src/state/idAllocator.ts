import { isGroup } from "../jobs/sequenceUtils"
import type { SequenceItem } from "../types"

// Random short id allocator for steps. We picked 4 base36 chars
// after the `step_` prefix to keep `?seq=` URL footprints tiny —
// at that size the birthday-paradox collision in a 100-step
// sequence is ~1 in 335, so the regen-on-collision loop in
// makeStepId is mandatory rather than optional.

export const collectExistingIds = (
  items: SequenceItem[],
): Set<string> => {
  const taken = new Set<string>()
  for (const item of items) {
    if (isGroup(item)) {
      taken.add(item.id)
      for (const step of item.steps) taken.add(step.id)
    } else {
      taken.add(item.id)
    }
  }
  return taken
}

export const makeStepId = (
  existing: Set<string>,
): string => {
  // Loop is bounded in practice — base36^4 = ~1.68M ids vs.
  // a sequence in the hundreds — but we still loop rather
  // than retry-once so collision bugs surface as slowness
  // rather than silent id reuse.
  while (true) {
    const id = `step_${Math.random().toString(36).slice(2, 6)}`
    if (!existing.has(id)) return id
  }
}
