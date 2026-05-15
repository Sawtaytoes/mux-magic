import { useStore } from "jotai"
import { useEffect } from "react"
import { isGroup } from "../jobs/sequenceUtils"
import {
  scrollSeqAtom,
  scrollToStepAtom,
} from "../state/historyAtoms"
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
      // Bump the seq so async producers (e.g. paste, which sets
      // scrollToStepAtom only after its view transition resolves) can
      // detect that the viewport has been moved by another action and
      // skip their now-stale scroll. See scrollSeqAtom doc.
      store.set(
        scrollSeqAtom,
        store.get(scrollSeqAtom) + 1,
      )

      // Defer to the next frame so callers that set scrollToStepAtom
      // synchronously after creating a step (insertStep, insertGroup,
      // addStepToGroup) give React a chance to commit before we query
      // the DOM. Undo/redo defer naturally via runWithViewTransition.
      requestAnimationFrame(() => {
        const behavior = isReducedMotion()
          ? "auto"
          : "smooth"
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
    })
  }, [store])
}
