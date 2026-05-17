import { describe, expect, test, vi } from "vitest"
import type { SequenceItem } from "../types"
import {
  collectExistingIds,
  makeStepId,
} from "./idAllocator"

describe("makeStepId", () => {
  test("returns an id matching `step_<4 base36 chars>`", () => {
    const id = makeStepId(new Set())
    expect(id).toMatch(/^step_[a-z0-9]{4}$/)
  })

  test("returns a non-colliding id when given a saturated existing set", () => {
    // Pre-populate a large existing set; then assert that makeStepId
    // still returns something not in it. The regen-on-collision loop
    // is the only thing keeping this from being flaky.
    const existing = new Set<string>()
    for (let index = 0; index < 5000; index++) {
      existing.add(
        `step_${index.toString(36).padStart(4, "0")}`,
      )
    }
    const id = makeStepId(existing)
    expect(existing.has(id)).toBe(false)
    expect(id).toMatch(/^step_[a-z0-9]{4}$/)
  })

  test("regen loop terminates even when the first random pick is taken", () => {
    // Force Math.random to return the same value twice, then a
    // different value. The loop must NOT short-circuit on the first
    // picked id when it is already in the set.
    const existing = new Set<string>()
    // Match what `step_${(0.1).toString(36).slice(2,6)}` produces.
    const seedId = `step_${(0.1).toString(36).slice(2, 6)}`
    existing.add(seedId)
    const randomSpy = vi
      .spyOn(Math, "random")
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.2)
    try {
      const id = makeStepId(existing)
      expect(id).not.toBe(seedId)
      expect(randomSpy).toHaveBeenCalledTimes(2)
    } finally {
      randomSpy.mockRestore()
    }
  })
})

describe("collectExistingIds", () => {
  test("walks top-level steps, groups, and group children", () => {
    const items: SequenceItem[] = [
      {
        id: "step_top",
        alias: "",
        command: "",
        params: {},
        links: {},
        status: null,
        error: null,
        isCollapsed: false,
      },
      {
        kind: "group",
        id: "group_g1",
        label: "",
        isParallel: false,
        isCollapsed: false,
        steps: [
          {
            id: "step_inner_a",
            alias: "",
            command: "",
            params: {},
            links: {},
            status: null,
            error: null,
            isCollapsed: false,
          },
          {
            id: "step_inner_b",
            alias: "",
            command: "",
            params: {},
            links: {},
            status: null,
            error: null,
            isCollapsed: false,
          },
        ],
      },
    ]
    const ids = collectExistingIds(items)
    expect(ids).toEqual(
      new Set([
        "step_top",
        "group_g1",
        "step_inner_a",
        "step_inner_b",
      ]),
    )
  })
})
