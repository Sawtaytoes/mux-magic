import { describe, expect, test } from "vitest"
import {
  getVariableTypeDefinition,
  registerVariableType,
} from "./registry"

describe("variable type registry", () => {
  test("registers and retrieves a type definition", () => {
    registerVariableType({
      type: "path",
      label: "Path",
      cardinality: "multi",
      isLinkable: true,
      renderValueInput: () => {
        throw new Error("not implemented")
      },
    })
    const definition = getVariableTypeDefinition("path")
    expect(definition).toBeDefined()
    expect(definition?.type).toBe("path")
    expect(definition?.isLinkable).toBe(true)
    expect(definition?.cardinality).toBe("multi")
  })

  test("path type is pre-registered by this module", () => {
    const definition = getVariableTypeDefinition("path")
    expect(definition?.type).toBe("path")
    expect(definition?.cardinality).toBe("multi")
    expect(definition?.isLinkable).toBe(true)
    expect(definition?.label).toBeTruthy()
  })
})

describe("getVariableTypeDefinition", () => {
  test("returns undefined for unregistered type", () => {
    expect(
      getVariableTypeDefinition("nonExistentType"),
    ).toBeUndefined()
  })
})
