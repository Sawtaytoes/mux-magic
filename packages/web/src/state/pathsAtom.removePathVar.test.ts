import { createStore } from "jotai"
import { describe, expect, test } from "vitest"
import type { Step } from "../types"
import {
  cancelPathVarDeleteAtom,
  confirmPathVarDeleteAtom,
  pathsAtom,
  pendingPathVarDeleteAtom,
  removePathVarAtom,
  setPathVarResolutionAtom,
} from "./pathsAtom"
import { stepsAtom } from "./stepsAtom"

const makePathVar = (id: string, value = "/mnt/media") => ({
  id,
  label: id,
  value,
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

describe("removePathVarAtom", () => {
  test("unused path var is deleted immediately", () => {
    const store = createStore()
    store.set(pathsAtom, [makePathVar("basePath")])
    store.set(stepsAtom, [makeStep("step1")])

    store.set(removePathVarAtom, "basePath")

    expect(store.get(pathsAtom)).toHaveLength(0)
    expect(store.get(pendingPathVarDeleteAtom)).toBeNull()
  })

  test("in-use path var sets pendingDelete instead of deleting", () => {
    const store = createStore()
    store.set(pathsAtom, [makePathVar("basePath")])
    store.set(stepsAtom, [
      makeStep("step1", { inputPath: "basePath" }),
    ])

    store.set(removePathVarAtom, "basePath")

    expect(store.get(pathsAtom)).toHaveLength(1)
    const pending = store.get(pendingPathVarDeleteAtom)
    expect(pending).not.toBeNull()
    expect(pending?.pathVarId).toBe("basePath")
    expect(pending?.usages).toEqual([
      { stepId: "step1", fieldName: "inputPath" },
    ])
  })

  test("pendingDelete lists all affected fields across steps", () => {
    const store = createStore()
    store.set(pathsAtom, [makePathVar("basePath")])
    store.set(stepsAtom, [
      makeStep("step1", {
        inputPath: "basePath",
        outputPath: "basePath",
      }),
      makeStep("step2", { sourcePath: "basePath" }),
    ])

    store.set(removePathVarAtom, "basePath")

    const pending = store.get(pendingPathVarDeleteAtom)
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
    store.set(pathsAtom, [makePathVar("basePath")])
    store.set(stepsAtom, [
      makeStep("step1", {
        inputPath: {
          linkedTo: "step0",
          output: "outputFile",
        } as unknown as string,
      }),
    ])

    store.set(removePathVarAtom, "basePath")

    expect(store.get(pathsAtom)).toHaveLength(0)
    expect(store.get(pendingPathVarDeleteAtom)).toBeNull()
  })
})

describe("setPathVarResolutionAtom", () => {
  test("replace-with swaps the link reference in pendingDelete resolutions", () => {
    const store = createStore()
    store.set(pathsAtom, [
      makePathVar("basePath"),
      makePathVar("altPath"),
    ])
    store.set(stepsAtom, [
      makeStep("step1", { inputPath: "basePath" }),
    ])
    store.set(removePathVarAtom, "basePath")

    store.set(setPathVarResolutionAtom, {
      stepId: "step1",
      fieldName: "inputPath",
      resolution: { kind: "replace", targetId: "altPath" },
    })

    const pending = store.get(pendingPathVarDeleteAtom)
    expect(pending?.resolutions["step1:inputPath"]).toEqual(
      {
        kind: "replace",
        targetId: "altPath",
      },
    )
  })

  test("unlink resolution is recorded", () => {
    const store = createStore()
    store.set(pathsAtom, [makePathVar("basePath")])
    store.set(stepsAtom, [
      makeStep("step1", { inputPath: "basePath" }),
    ])
    store.set(removePathVarAtom, "basePath")

    store.set(setPathVarResolutionAtom, {
      stepId: "step1",
      fieldName: "inputPath",
      resolution: { kind: "unlink" },
    })

    const pending = store.get(pendingPathVarDeleteAtom)
    expect(pending?.resolutions["step1:inputPath"]).toEqual(
      { kind: "unlink" },
    )
  })
})

describe("confirmPathVarDeleteAtom", () => {
  test("replace-with swaps step link to new path var ID", () => {
    const store = createStore()
    store.set(pathsAtom, [
      makePathVar("basePath"),
      makePathVar("altPath"),
    ])
    store.set(stepsAtom, [
      makeStep("step1", { inputPath: "basePath" }),
    ])
    store.set(removePathVarAtom, "basePath")
    store.set(setPathVarResolutionAtom, {
      stepId: "step1",
      fieldName: "inputPath",
      resolution: { kind: "replace", targetId: "altPath" },
    })

    store.set(confirmPathVarDeleteAtom)

    const steps = store.get(stepsAtom) as Step[]
    expect(steps[0].links.inputPath).toBe("altPath")
    expect(
      store
        .get(pathsAtom)
        .find((pv) => pv.id === "basePath"),
    ).toBeUndefined()
    expect(store.get(pendingPathVarDeleteAtom)).toBeNull()
  })

  test("unlink removes link and writes literal value to params", () => {
    const store = createStore()
    store.set(pathsAtom, [
      makePathVar("basePath", "/mnt/media"),
    ])
    store.set(stepsAtom, [
      makeStep("step1", { inputPath: "basePath" }),
    ])
    store.set(removePathVarAtom, "basePath")

    store.set(confirmPathVarDeleteAtom)

    const steps = store.get(stepsAtom) as Step[]
    expect(steps[0].links.inputPath).toBeUndefined()
    expect(steps[0].params.inputPath).toBe("/mnt/media")
    expect(store.get(pathsAtom)).toHaveLength(0)
    expect(store.get(pendingPathVarDeleteAtom)).toBeNull()
  })

  test("multiple usages resolved independently in one atomic commit", () => {
    const store = createStore()
    store.set(pathsAtom, [
      makePathVar("basePath", "/mnt/base"),
      makePathVar("altPath"),
    ])
    store.set(stepsAtom, [
      makeStep("step1", {
        inputPath: "basePath",
        outputPath: "basePath",
      }),
    ])
    store.set(removePathVarAtom, "basePath")
    store.set(setPathVarResolutionAtom, {
      stepId: "step1",
      fieldName: "inputPath",
      resolution: { kind: "replace", targetId: "altPath" },
    })
    // outputPath left as default "unlink"

    store.set(confirmPathVarDeleteAtom)

    const steps = store.get(stepsAtom) as Step[]
    expect(steps[0].links.inputPath).toBe("altPath")
    expect(steps[0].links.outputPath).toBeUndefined()
    expect(steps[0].params.outputPath).toBe("/mnt/base")
  })
})

describe("cancelPathVarDeleteAtom", () => {
  test("cancel clears pendingDelete without modifying anything", () => {
    const store = createStore()
    store.set(pathsAtom, [makePathVar("basePath")])
    store.set(stepsAtom, [
      makeStep("step1", { inputPath: "basePath" }),
    ])
    store.set(removePathVarAtom, "basePath")

    store.set(cancelPathVarDeleteAtom)

    expect(store.get(pendingPathVarDeleteAtom)).toBeNull()
    expect(store.get(pathsAtom)).toHaveLength(1)
    const steps = store.get(stepsAtom) as Step[]
    expect(steps[0].links.inputPath).toBe("basePath")
  })
})
