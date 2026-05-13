import { atom } from "jotai"
import { isGroup } from "../jobs/sequenceUtils"
import { stepsAtom } from "./stepsAtom"

// ─── Sequence-wide mutations ─────────────────────────────────────────────────
//
// This file holds atoms that act on the entire sequence (both groups and
// every step within them). Per-step mutations live in stepAtoms.ts,
// per-group mutations in groupAtoms.ts, drag-and-drop in dragAtoms.ts,
// and run/cancel logic in runAtoms.ts.

export const setAllCollapsedAtom = atom(
  null,
  (_get, set, isCollapsed: boolean) => {
    set(stepsAtom, (items) =>
      items.map((item) => {
        if (isGroup(item)) {
          return {
            ...item,
            isCollapsed,
            steps: item.steps.map((step) => ({
              ...step,
              isCollapsed,
            })),
          }
        }
        return { ...item, isCollapsed }
      }),
    )
  },
)
