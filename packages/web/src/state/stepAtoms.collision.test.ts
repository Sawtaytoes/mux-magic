import { createStore } from "jotai"
import { describe, expect, test } from "vitest"
import { isGroup } from "../jobs/sequenceUtils"
import type { SequenceItem, Step } from "../types"
import { insertGroupAtom } from "./groupAtoms"
import {
  addStepToGroupAtom,
  insertStepAtom,
  removeStepAtom,
} from "./stepAtoms"
import { stepsAtom } from "./stepsAtom"

// Stress test: drive 200 random insert/remove operations and assert
// that every id in stepsAtom is unique at every step. Random ids
// (~1.68M space) plus regen-on-collision should make duplicates
// impossible by construction.

const collectIds = (items: SequenceItem[]): string[] => {
  const ids: string[] = []
  for (const item of items) {
    ids.push(item.id)
    if (isGroup(item)) {
      for (const child of item.steps) ids.push(child.id)
    }
  }
  return ids
}

const assertAllUnique = (items: SequenceItem[]) => {
  const ids = collectIds(items)
  expect(new Set(ids).size).toBe(ids.length)
}

describe("step id allocation — uniqueness under churn", () => {
  test("200 random insert/remove operations never produce duplicate ids", () => {
    const store = createStore()

    for (let i = 0; i < 200; i++) {
      const items = store.get(stepsAtom)
      const action = Math.random()

      if (items.length > 0 && action < 0.3) {
        // Remove a random top-level step (skip groups for simplicity).
        const stepItems = items.filter((it) => !isGroup(it)) as Step[]
        if (stepItems.length > 0) {
          const target =
            stepItems[
              Math.floor(Math.random() * stepItems.length)
            ]
          store.set(removeStepAtom, target.id)
        }
      } else if (action < 0.6) {
        store.set(insertStepAtom, { index: items.length })
      } else if (action < 0.8) {
        store.set(insertGroupAtom, {
          index: items.length,
          isParallel: false,
        })
      } else {
        const groupItem = items.find(isGroup)
        if (groupItem) {
          store.set(addStepToGroupAtom, groupItem.id)
        } else {
          store.set(insertStepAtom, { index: items.length })
        }
      }

      assertAllUnique(store.get(stepsAtom))
    }
  })

  test("inserting onto a sequence pre-seeded with thousands of ids still produces a unique id", () => {
    const store = createStore()
    // Seed thousands of pre-existing ids so the random space is
    // densely populated and the regen-on-collision loop has work to do.
    const seeded: SequenceItem[] = []
    for (let i = 0; i < 5000; i++) {
      seeded.push({
        id: `step_${i.toString(36).padStart(4, "0")}`,
        alias: "",
        command: "",
        params: {},
        links: {},
        status: null,
        error: null,
        isCollapsed: false,
      })
    }
    store.set(stepsAtom, seeded)

    const newId = store.set(insertStepAtom, {
      index: seeded.length,
    })
    expect(newId).toMatch(/^step_[a-z0-9]{4}$/)
    assertAllUnique(store.get(stepsAtom))
  })
})
