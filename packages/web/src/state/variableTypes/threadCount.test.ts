import { describe, expect, test } from "vitest"
import {
  getVariableTypeDefinition,
  listVariableTypes,
} from "../../components/VariableCard/registry"
import { THREAD_COUNT_VARIABLE_DEFINITION } from "./threadCount"

describe("threadCount definition", () => {
  test("declares the expected metadata", () => {
    expect(THREAD_COUNT_VARIABLE_DEFINITION.type).toBe(
      "threadCount",
    )
    expect(THREAD_COUNT_VARIABLE_DEFINITION.label).toBe(
      "Max threads (per job)",
    )
    expect(
      THREAD_COUNT_VARIABLE_DEFINITION.cardinality,
    ).toBe("singleton")
    expect(
      THREAD_COUNT_VARIABLE_DEFINITION.isLinkable,
    ).toBe(false)
  })

  test('uses canonicalId "tc" for back-compat with worker 11 YAML', () => {
    // The on-disk envelope from worker 11 is
    // `variables: { tc: { type: "threadCount", value: "<N>" } }`. The
    // canonicalId field keeps that slot stable so already-saved YAML
    // loads with the same id.
    expect(
      THREAD_COUNT_VARIABLE_DEFINITION.canonicalId,
    ).toBe("tc")
  })

  test("is registered in the variable-type registry on registry import", () => {
    // Importing the registry registers the type as a side effect.
    const registered =
      getVariableTypeDefinition("threadCount")
    expect(registered).toBeDefined()
    expect(registered?.type).toBe("threadCount")
    expect(registered?.cardinality).toBe("singleton")
  })

  test("listVariableTypes includes threadCount alongside path and dvdCompareId", () => {
    const types = listVariableTypes().map(
      (definition) => definition.type,
    )
    expect(types).toEqual(
      expect.arrayContaining([
        "path",
        "dvdCompareId",
        "threadCount",
      ]),
    )
  })
})
