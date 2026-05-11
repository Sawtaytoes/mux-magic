import { createStore } from "jotai"
import { describe, expect, test } from "vitest"
import { isGroup } from "../../jobs/sequenceUtils"
import { dragReorderAtom } from "../../state/sequenceAtoms"
import { stepsAtom } from "../../state/stepsAtom"
import type { Group, SequenceItem, Step } from "../../types"

const makeStep = (id: string): Step => ({
  id,
  alias: "",
  command: "encode",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
})

const makeGroup = (
  id: string,
  stepIds: string[],
): Group => ({
  kind: "group",
  id,
  label: "",
  isParallel: false,
  isCollapsed: false,
  steps: stepIds.map(makeStep),
})

type DragReorderArgs = {
  activeId: string
  overId: string
  sourceContainerId: string
  targetContainerId: string
}

const applyDragReorder = (
  initialItems: SequenceItem[],
  args: DragReorderArgs,
): SequenceItem[] => {
  const store = createStore()
  store.set(stepsAtom, initialItems)
  store.set(dragReorderAtom, args)
  return store.get(stepsAtom)
}

describe("dragReorderAtom — top-level reorder", () => {
  test("moves step from index 0 to index 2", () => {
    const stepA = makeStep("step_a")
    const stepB = makeStep("step_b")
    const stepC = makeStep("step_c")
    const result = applyDragReorder([stepA, stepB, stepC], {
      activeId: "step_a",
      overId: "step_c",
      sourceContainerId: "top-level",
      targetContainerId: "top-level",
    })
    expect(result.map((item) => item.id)).toEqual([
      "step_b",
      "step_c",
      "step_a",
    ])
  })

  test("no-op when activeId equals overId", () => {
    const stepA = makeStep("step_a")
    const stepB = makeStep("step_b")
    const result = applyDragReorder([stepA, stepB], {
      activeId: "step_a",
      overId: "step_a",
      sourceContainerId: "top-level",
      targetContainerId: "top-level",
    })
    expect(result.map((item) => item.id)).toEqual([
      "step_a",
      "step_b",
    ])
  })

  test("moves group from first to last position", () => {
    const groupA = makeGroup("group_a", ["step_1"])
    const stepB = makeStep("step_b")
    const result = applyDragReorder([groupA, stepB], {
      activeId: "group_a",
      overId: "step_b",
      sourceContainerId: "top-level",
      targetContainerId: "top-level",
    })
    expect(result.map((item) => item.id)).toEqual([
      "step_b",
      "group_a",
    ])
  })
})

describe("dragReorderAtom — within-group reorder", () => {
  test("reorders steps inside a group", () => {
    const group = makeGroup("group_1", [
      "step_a",
      "step_b",
      "step_c",
    ])
    const result = applyDragReorder([group], {
      activeId: "step_a",
      overId: "step_c",
      sourceContainerId: "group_1",
      targetContainerId: "group_1",
    })
    const resultGroup = result[0] as Group
    expect(
      resultGroup.steps.map((step) => step.id),
    ).toEqual(["step_b", "step_c", "step_a"])
  })
})

describe("dragReorderAtom — cross-container", () => {
  test("moves step from top-level into a group", () => {
    const stepA = makeStep("step_a")
    const group = makeGroup("group_1", ["step_b"])
    const result = applyDragReorder([stepA, group], {
      activeId: "step_a",
      overId: "step_b",
      sourceContainerId: "top-level",
      targetContainerId: "group_1",
    })
    expect(
      result.filter((item) => !isGroup(item)),
    ).toHaveLength(0)
    const resultGroup = result.find(
      (item) => item.id === "group_1",
    ) as Group
    expect(
      resultGroup.steps.map((step) => step.id),
    ).toEqual(["step_a", "step_b"])
  })

  test("moves step out of a group to top-level", () => {
    const group = makeGroup("group_1", ["step_a", "step_b"])
    const stepC = makeStep("step_c")
    const result = applyDragReorder([group, stepC], {
      activeId: "step_a",
      overId: "step_c",
      sourceContainerId: "group_1",
      targetContainerId: "top-level",
    })
    const topLevelSteps = result.filter(
      (item) => !isGroup(item),
    )
    expect(topLevelSteps.map((item) => item.id)).toEqual([
      "step_a",
      "step_c",
    ])
    const resultGroup = result.find(
      (item) => item.id === "group_1",
    ) as Group
    expect(
      resultGroup.steps.map((step) => step.id),
    ).toEqual(["step_b"])
  })

  test("drops empty group when last step leaves it", () => {
    const group = makeGroup("group_1", ["step_a"])
    const stepB = makeStep("step_b")
    const result = applyDragReorder([group, stepB], {
      activeId: "step_a",
      overId: "step_b",
      sourceContainerId: "group_1",
      targetContainerId: "top-level",
    })
    expect(result).toHaveLength(2)
    expect(result.every((item) => !isGroup(item))).toBe(
      true,
    )
  })

  test("prevents group from being dragged into another group", () => {
    const groupA = makeGroup("group_a", ["step_1"])
    const groupB = makeGroup("group_b", ["step_2"])
    const result = applyDragReorder([groupA, groupB], {
      activeId: "group_a",
      overId: "step_2",
      sourceContainerId: "top-level",
      targetContainerId: "group_b",
    })
    expect(result.map((item) => item.id)).toEqual([
      "group_a",
      "group_b",
    ])
  })
})
