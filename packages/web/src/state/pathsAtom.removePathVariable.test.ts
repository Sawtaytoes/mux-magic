import { createStore } from "jotai"
import { describe, expect, test } from "vitest"
import type { Step } from "../types"
import {
  cancelPathVariableDeleteAtom,
  confirmPathVariableDeleteAtom,
  pathsAtom,
  pendingPathVariableDeleteAtom,
  removePathVariableAtom,
  setPathVariableResolutionAtom,
} from "./pathsAtom"
import { stepsAtom } from "./stepsAtom"

const makePathVariable = (
  id: string,
  value = "/mnt/media",
) => ({
  id,
  label: id,
  value,
  type: "path" as const,
})

const makeStep = (
  id: string,
  links: Record<string, string> = {},
): Step => ({
  id,
  alias: "",
  command: "encodeVideo",
  params: {},
  links,
  status: null,
  error: null,
  isCollapsed: false,
})

describe("removePathVariableAtom", () => {
  test("unused path var is deleted immediately", () => {
    const store = createStore()
    store.set(pathsAtom, [makePathVariable("basePath")])
    store.set(stepsAtom, [makeStep("step1")])

    store.set(removePathVariableAtom, "basePath")

    expect(store.get(pathsAtom)).toHaveLength(0)
    expect(
      store.get(pendingPathVariableDeleteAtom),
    ).toBeNull()
  })

  test("in-use path var sets pendingDelete instead of deleting", () => {
    const store = createStore()
    store.set(pathsAtom, [makePathVariable("basePath")])
    store.set(stepsAtom, [
      makeStep("step1", { inputPath: "basePath" }),
    ])

    store.set(removePathVariableAtom, "basePath")

    expect(store.get(pathsAtom)).toHaveLength(1)
    const pending = store.get(pendingPathVariableDeleteAtom)
    expect(pending).not.toBeNull()
    expect(pending?.variableId).toBe("basePath")
    expect(pending?.usages).toEqual([
      { stepId: "step1", fieldName: "inputPath" },
    ])
  })

  test("pendingDelete lists all affected fields across steps", () => {
    const store = createStore()
    store.set(pathsAtom, [makePathVariable("basePath")])
    store.set(stepsAtom, [
      makeStep("step1", {
        inputPath: "basePath",
        outputPath: "basePath",
      }),
      makeStep("step2", { sourcePath: "basePath" }),
    ])

    store.set(removePathVariableAtom, "basePath")

    const pending = store.get(pendingPathVariableDeleteAtom)
    expect(pending?.usages).toHaveLength(3)
    expect(pending?.usages).toContainEqual({
      stepId: "step1",
      fieldName: "inputPath",
    })
    expect(pending?.usages).toContainEqual({
      stepId: "step1",
      fieldName: "outputPath",
    })
    expect(pending?.usages).toContainEqual({
      stepId: "step2",
      fieldName: "sourcePath",
    })
  })

  test("object links (step output refs) are not counted as path var usages", () => {
    const store = createStore()
    store.set(pathsAtom, [makePathVariable("basePath")])
    store.set(stepsAtom, [
      makeStep("step1", {
        inputPath: {
          linkedTo: "step0",
          output: "outputFile",
        } as unknown as string,
      }),
    ])

    store.set(removePathVariableAtom, "basePath")

    expect(store.get(pathsAtom)).toHaveLength(0)
    expect(
      store.get(pendingPathVariableDeleteAtom),
    ).toBeNull()
  })
})

describe("setPathVariableResolutionAtom", () => {
  test("replace-with swaps the link reference in pendingDelete resolutions", () => {
    const store = createStore()
    store.set(pathsAtom, [
      makePathVariable("basePath"),
      makePathVariable("altPath"),
    ])
    store.set(stepsAtom, [
      makeStep("step1", { inputPath: "basePath" }),
    ])
    store.set(removePathVariableAtom, "basePath")

    store.set(setPathVariableResolutionAtom, {
      stepId: "step1",
      fieldName: "inputPath",
      resolution: { kind: "replace", targetId: "altPath" },
    })

    const pending = store.get(pendingPathVariableDeleteAtom)
    expect(pending?.resolutions["step1:inputPath"]).toEqual(
      {
        kind: "replace",
        targetId: "altPath",
      },
    )
  })

  test("unlink resolution is recorded", () => {
    const store = createStore()
    store.set(pathsAtom, [makePathVariable("basePath")])
    store.set(stepsAtom, [
      makeStep("step1", { inputPath: "basePath" }),
    ])
    store.set(removePathVariableAtom, "basePath")

    store.set(setPathVariableResolutionAtom, {
      stepId: "step1",
      fieldName: "inputPath",
      resolution: { kind: "unlink" },
    })

    const pending = store.get(pendingPathVariableDeleteAtom)
    expect(pending?.resolutions["step1:inputPath"]).toEqual(
      { kind: "unlink" },
    )
  })
})

describe("confirmPathVariableDeleteAtom", () => {
  test("replace-with swaps step link to new path var ID", () => {
    const store = createStore()
    store.set(pathsAtom, [
      makePathVariable("basePath"),
      makePathVariable("altPath"),
    ])
    store.set(stepsAtom, [
      makeStep("step1", { inputPath: "basePath" }),
    ])
    store.set(removePathVariableAtom, "basePath")
    store.set(setPathVariableResolutionAtom, {
      stepId: "step1",
      fieldName: "inputPath",
      resolution: { kind: "replace", targetId: "altPath" },
    })

    store.set(confirmPathVariableDeleteAtom)

    const steps = store.get(stepsAtom) as Step[]
    expect(steps[0].links.inputPath).toBe("altPath")
    expect(
      store
        .get(pathsAtom)
        .find((pv) => pv.id === "basePath"),
    ).toBeUndefined()
    expect(
      store.get(pendingPathVariableDeleteAtom),
    ).toBeNull()
  })

  test("unlink removes link and writes literal value to params", () => {
    const store = createStore()
    store.set(pathsAtom, [
      makePathVariable("basePath", "/mnt/media"),
    ])
    store.set(stepsAtom, [
      makeStep("step1", { inputPath: "basePath" }),
    ])
    store.set(removePathVariableAtom, "basePath")

    store.set(confirmPathVariableDeleteAtom)

    const steps = store.get(stepsAtom) as Step[]
    expect(steps[0].links.inputPath).toBeUndefined()
    expect(steps[0].params.inputPath).toBe("/mnt/media")
    expect(store.get(pathsAtom)).toHaveLength(0)
    expect(
      store.get(pendingPathVariableDeleteAtom),
    ).toBeNull()
  })

  test("multiple usages resolved independently in one atomic commit", () => {
    const store = createStore()
    store.set(pathsAtom, [
      makePathVariable("basePath", "/mnt/base"),
      makePathVariable("altPath"),
    ])
    store.set(stepsAtom, [
      makeStep("step1", {
        inputPath: "basePath",
        outputPath: "basePath",
      }),
    ])
    store.set(removePathVariableAtom, "basePath")
    store.set(setPathVariableResolutionAtom, {
      stepId: "step1",
      fieldName: "inputPath",
      resolution: { kind: "replace", targetId: "altPath" },
    })
    // outputPath left as default "unlink"

    store.set(confirmPathVariableDeleteAtom)

    const steps = store.get(stepsAtom) as Step[]
    expect(steps[0].links.inputPath).toBe("altPath")
    expect(steps[0].links.outputPath).toBeUndefined()
    expect(steps[0].params.outputPath).toBe("/mnt/base")
  })
})

describe("cancelPathVariableDeleteAtom", () => {
  test("cancel clears pendingDelete without modifying anything", () => {
    const store = createStore()
    store.set(pathsAtom, [makePathVariable("basePath")])
    store.set(stepsAtom, [
      makeStep("step1", { inputPath: "basePath" }),
    ])
    store.set(removePathVariableAtom, "basePath")

    store.set(cancelPathVariableDeleteAtom)

    expect(
      store.get(pendingPathVariableDeleteAtom),
    ).toBeNull()
    expect(store.get(pathsAtom)).toHaveLength(1)
    const steps = store.get(stepsAtom) as Step[]
    expect(steps[0].links.inputPath).toBe("basePath")
  })
})
