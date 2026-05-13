import { useStore } from "jotai"
import { useEffect } from "react"
import { isGroup } from "../jobs/sequenceUtils"
import { scrollToStepAtom } from "../state/historyAtoms"
import { stepsAtom } from "../state/stepsAtom"
import type { Group } from "../types"

const isReducedMotion = (): boolean =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)")
    .matches ?? false

export const useScrollToAffectedStep = (): void => {
  const store = useStore()

  useEffect(() => {
    return store.sub(scrollToStepAtom, () => {
      const stepId = store.get(scrollToStepAtom)
      if (!stepId) return

      store.set(scrollToStepAtom, null)

      const behavior = isReducedMotion() ? "auto" : "smooth"
      const el = document.getElementById(`step-${stepId}`)

      if (el) {
        el.scrollIntoView({ behavior, block: "center" })
        return
      }

      // Step is inside a collapsed group — scroll to the group instead
      const steps = store.get(stepsAtom)
      const parentGroup = steps.find(
        (item) =>
          isGroup(item) &&
          (item as Group).steps.some(
            (step) => step.id === stepId,
          ),
      ) as Group | undefined
      if (!parentGroup) return

      const groupEl = document.querySelector(
        `[data-group="${parentGroup.id}"]`,
      )
      if (groupEl instanceof HTMLElement) {
        groupEl.scrollIntoView({
          behavior,
          block: "center",
        })
      }
    })
  }, [store])
}
