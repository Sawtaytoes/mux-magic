import { createStore } from "jotai"
import { describe, expect, test } from "vitest"
import type { Step } from "../types"
import { pathsAtom } from "./pathsAtom"
import { stepsAtom } from "./stepsAtom"
import {
  addVariableAtom,
  removeVariableAtom,
  setVariableValueAtom,
  variablesAtom,
} from "./variablesAtom"

const makeStep = (
  id: string,
  links: Record<string, string> = {},
): Step => ({
  id,
  alias: "",
  command: "copyFiles",
  params: {},
  links,
  status: null,
  error: null,
  isCollapsed: false,
})

describe("variablesAtom", () => {
  test("starts empty", () => {
    const store = createStore()
    expect(store.get(variablesAtom)).toEqual([])
  })

  test("addVariableAtom creates a path variable", () => {
    const store = createStore()
    store.set(addVariableAtom, {
      type: "path",
      label: "Base",
      value: "/mnt/media",
    })
    const variables = store.get(variablesAtom)
    expect(variables).toHaveLength(1)
    expect(variables[0].type).toBe("path")
    expect(variables[0].label).toBe("Base")
    expect(variables[0].value).toBe("/mnt/media")
    expect(typeof variables[0].id).toBe("string")
  })

  test("setVariableValueAtom updates the value", () => {
    const store = createStore()
    store.set(addVariableAtom, {
      type: "path",
      label: "Base",
      value: "/old",
    })
    const [variable] = store.get(variablesAtom)
    store.set(setVariableValueAtom, {
      variableId: variable.id,
      value: "/new",
    })
    expect(store.get(variablesAtom)[0].value).toBe("/new")
  })

  test("removeVariableAtom deletes unused variable immediately", () => {
    const store = createStore()
    store.set(addVariableAtom, {
      type: "path",
      label: "Base",
      value: "/mnt/media",
    })
    const [variable] = store.get(variablesAtom)
    store.set(removeVariableAtom, variable.id)
    expect(store.get(variablesAtom)).toHaveLength(0)
  })

  test("removeVariableAtom keeps variable when used by a step link", () => {
    const store = createStore()
    store.set(addVariableAtom, {
      type: "path",
      label: "Base",
      value: "/mnt/media",
    })
    const [variable] = store.get(variablesAtom)
    store.set(stepsAtom, [makeStep("step1", { source: variable.id })])
    store.set(removeVariableAtom, variable.id)
    expect(store.get(variablesAtom)).toHaveLength(1)
  })
})

describe("pathsAtom back-compat alias", () => {
  test("returns only path-typed variables", () => {
    const store = createStore()
    store.set(variablesAtom, [
      { id: "v1", label: "Path A", value: "/a", type: "path" },
    ])
    const paths = store.get(pathsAtom)
    expect(paths).toHaveLength(1)
    expect(paths[0].id).toBe("v1")
  })

  test("returns empty array when no path variables exist", () => {
    const store = createStore()
    store.set(variablesAtom, [])
    expect(store.get(pathsAtom)).toEqual([])
  })
})
