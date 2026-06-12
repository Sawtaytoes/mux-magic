import { createStore } from "jotai"
import { describe, expect, test } from "vitest"
import { variablesAtom } from "../state/variablesAtom"
import type { Step, Variable } from "../types"
import {
  getEffectiveValue,
  setEffectiveValue,
} from "./effectiveFieldValue"

const makeStep = (overrides?: Partial<Step>): Step => ({
  id: "step-1",
  alias: "",
  command: "nameAnimeEpisodes",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

const makeVariable = (
  overrides?: Partial<Variable>,
): Variable => ({
  id: "malIdVariable_abc123",
  label: "",
  value: "",
  type: "malId",
  ...overrides,
})

describe("getEffectiveValue", () => {
  test("returns step.params value when field is not linked", () => {
    const step = makeStep({ params: { malId: 5114 } })
    const result = getEffectiveValue(step, "malId", [])
    expect(result).toBe(5114)
  })

  test("returns undefined when field is not linked and params has no value", () => {
    const step = makeStep({ params: {} })
    const result = getEffectiveValue(step, "malId", [])
    expect(result).toBeUndefined()
  })

  test("returns parsed number from linked variable value", () => {
    const variable = makeVariable({ value: "5114" })
    const step = makeStep({
      links: { malId: variable.id },
      params: {},
    })
    const result = getEffectiveValue(step, "malId", [
      variable,
    ])
    expect(result).toBe(5114)
  })

  test("returns undefined when linked variable value is empty", () => {
    const variable = makeVariable({ value: "" })
    const step = makeStep({
      links: { malId: variable.id },
      params: {},
    })
    const result = getEffectiveValue(step, "malId", [
      variable,
    ])
    expect(result).toBeUndefined()
  })

  test("returns undefined (not NaN) when linked variable value is non-numeric text", () => {
    // dvdCompareId can be a slug — NaN falls through as undefined for display
    const variable = makeVariable({
      type: "dvdCompareId",
      value: "spider-man-2002",
    })
    const step = makeStep({
      links: { dvdCompareId: variable.id },
      params: {},
    })
    const result = getEffectiveValue(step, "dvdCompareId", [
      variable,
    ])
    expect(result).toBeUndefined()
  })

  test("returns undefined when linked variable id is not found in variables list", () => {
    const step = makeStep({
      links: { malId: "missingVariable_xyz" },
      params: {},
    })
    const result = getEffectiveValue(step, "malId", [])
    expect(result).toBeUndefined()
  })

  test("ignores object-form links (step output refs) for the linked-variable path", () => {
    const step = makeStep({
      links: {
        sourcePath: {
          linkedTo: "step-0",
          output: "folder",
        },
      },
      params: { sourcePath: "/fallback" },
    })
    // object-form links are NOT variable links — should fall through to params
    const result = getEffectiveValue(step, "sourcePath", [])
    expect(result).toBe("/fallback")
  })
})

describe("setEffectiveValue", () => {
  test("writes to variable when field is linked", () => {
    const store = createStore()
    const variable = makeVariable({ value: "" })
    store.set(variablesAtom, [variable])

    const step = makeStep({
      links: { malId: variable.id },
      params: {},
    })

    setEffectiveValue(store, step, "malId", 5114)

    const updated = store.get(variablesAtom)
    expect(updated[0].value).toBe("5114")
  })

  test("writes empty string to variable when value is undefined (clear)", () => {
    const store = createStore()
    const variable = makeVariable({ value: "5114" })
    store.set(variablesAtom, [variable])

    const step = makeStep({
      links: { malId: variable.id },
      params: {},
    })

    setEffectiveValue(store, step, "malId", undefined)

    const updated = store.get(variablesAtom)
    expect(updated[0].value).toBe("")
  })

  test("does not modify variable when field is not linked (setEffectiveValue is a no-op for params side)", () => {
    // setEffectiveValue only writes the variable side — callers handle
    // the setParam side separately (e.g. setLinkedOrParamValue in
    // useBuilderActions). This test confirms it is truly a no-op here.
    const store = createStore()
    const variable = makeVariable({ value: "initial" })
    store.set(variablesAtom, [variable])

    const step = makeStep({
      params: { malId: 1 },
      links: {},
    })

    setEffectiveValue(store, step, "malId", 9999)

    // Variable unchanged because field is not linked to it
    const updated = store.get(variablesAtom)
    expect(updated[0].value).toBe("initial")
  })

  test("writes to correct variable when multiple variables exist", () => {
    const store = createStore()
    const varA = makeVariable({
      id: "malIdVariable_aaa",
      value: "100",
    })
    const varB = makeVariable({
      id: "malIdVariable_bbb",
      value: "200",
      type: "anidbId",
    })
    store.set(variablesAtom, [varA, varB])

    const step = makeStep({
      links: { malId: varA.id },
      params: {},
    })

    setEffectiveValue(store, step, "malId", 5114)

    const updated = store.get(variablesAtom)
    expect(updated[0].value).toBe("5114") // varA updated
    expect(updated[1].value).toBe("200") // varB unchanged
  })
})
