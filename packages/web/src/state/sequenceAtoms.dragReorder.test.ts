import { createStore } from "jotai"
import { describe, expect, test } from "vitest"
import type { Group, Step } from "../types"
import { dragReorderAtom } from "./sequenceAtoms"
import { stepsAtom } from "./stepsAtom"

const makeStep = (id: string, command = "encodeVideo"): Step => ({
  id,
  alias: "",
  command,
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
})

const makeGroup = (
  id: string,
  steps: Step[],
  isParallel = false,
): Group => ({
  kind: "group",
  id,
  label: id,
  isParallel,
  isCollapsed: false,
  steps,
})

const reorder = (
  store: ReturnType<typeof createStore>,
  args: {
    activeId: string
    overId: string
    sourceContainerId: string
    targetContainerId: string
  },
) => store.set(dragReorderAtom, args)

describe("dragReorderAtom", () => {
  test("top-level reorder: drag A to after C", () => {
    const stepA = makeStep("a")
    const stepB = makeStep("b")
    const stepC = makeStep("c")
    const store = createStore()
    store.set(stepsAtom, [stepA, stepB, stepC])

    reorder(store, {
      activeId: "a",
      overId: "c",
      sourceContainerId: "top-level",
      targetContainerId: "top-level",
    })

    const result = store.get(stepsAtom)
    expect(result.map((item) => (item as Step).id)).toEqual([
      "b",
      "c",
      "a",
    ])
  })

  test("intra-group reorder: drag s1 to index 2", () => {
    const step1 = makeStep("s1")
    const step2 = makeStep("s2")
    const step3 = makeStep("s3")
    const group = makeGroup("group1", [step1, step2, step3])
    const store = createStore()
    store.set(stepsAtom, [group])

    reorder(store, {
      activeId: "s1",
      overId: "s3",
      sourceContainerId: "group1",
      targetContainerId: "group1",
    })

    const result = store.get(stepsAtom)
    const resultGroup = result[0] as Group
    expect(resultGroup.steps.map((step) => step.id)).toEqual([
      "s2",
      "s3",
      "s1",
    ])
  })

  test("cross-container: drag top-level step into group before existing step", () => {
    const stepX = makeStep("stepX")
    const step1 = makeStep("s1")
    const group1 = makeGroup("group1", [step1])
    const store = createStore()
    store.set(stepsAtom, [stepX, group1])

    reorder(store, {
      activeId: "stepX",
      overId: "s1",
      sourceContainerId: "top-level",
      targetContainerId: "group1",
    })

    const result = store.get(stepsAtom)
    expect(result).toHaveLength(1)
    const resultGroup = result[0] as Group
    expect(resultGroup.id).toBe("group1")
    expect(resultGroup.steps.map((step) => step.id)).toEqual([
      "stepX",
      "s1",
    ])
  })

  test("cross-container: drag step OUT of group to top-level", () => {
    const step1 = makeStep("s1")
    const step2 = makeStep("s2")
    const stepY = makeStep("stepY")
    const group1 = makeGroup("group1", [step1, step2])
    const store = createStore()
    store.set(stepsAtom, [group1, stepY])

    reorder(store, {
      activeId: "s1",
      overId: "stepY",
      sourceContainerId: "group1",
      targetContainerId: "top-level",
    })

    const result = store.get(stepsAtom)
    expect(result).toHaveLength(3)
    expect((result[0] as Group).id).toBe("group1")
    expect((result[0] as Group).steps.map((step) => step.id)).toEqual(["s2"])
    expect((result[1] as Step).id).toBe("s1")
    expect((result[2] as Step).id).toBe("stepY")
  })

  test("append to group: overId='' appends to end of group", () => {
    const stepX = makeStep("stepX")
    const step1 = makeStep("s1")
    const group1 = makeGroup("group1", [step1])
    const store = createStore()
    store.set(stepsAtom, [stepX, group1])

    reorder(store, {
      activeId: "stepX",
      overId: "",
      sourceContainerId: "top-level",
      targetContainerId: "group1",
    })

    const result = store.get(stepsAtom)
    expect(result).toHaveLength(1)
    const resultGroup = result[0] as Group
    expect(resultGroup.steps.map((step) => step.id)).toEqual([
      "s1",
      "stepX",
    ])
  })

  test("guard: group cannot be dragged into another group", () => {
    const stepA = makeStep("sA")
    const stepB = makeStep("sB")
    const group1 = makeGroup("group1", [stepA])
    const group2 = makeGroup("group2", [stepB])
    const store = createStore()
    store.set(stepsAtom, [group1, group2])

    reorder(store, {
      activeId: "group1",
      overId: "sB",
      sourceContainerId: "top-level",
      targetContainerId: "group2",
    })

    const result = store.get(stepsAtom)
    expect(result).toHaveLength(2)
    expect((result[0] as Group).id).toBe("group1")
    expect((result[1] as Group).id).toBe("group2")
    expect((result[1] as Group).steps).toHaveLength(1)
  })
})
