import { describe, expect, test } from "vitest"
import { getVariableTypeDefinition } from "../../components/VariableCard/registry"
import { MAL_ID_VARIABLE_DEFINITION } from "./malId"

describe("malId definition", () => {
  test("declares the expected metadata", () => {
    expect(MAL_ID_VARIABLE_DEFINITION.type).toBe("malId")
    expect(MAL_ID_VARIABLE_DEFINITION.label).toBe("MAL ID")
    expect(MAL_ID_VARIABLE_DEFINITION.cardinality).toBe(
      "multi",
    )
    expect(MAL_ID_VARIABLE_DEFINITION.isLinkable).toBe(true)
    expect(
      MAL_ID_VARIABLE_DEFINITION.runtimeValueType,
    ).toBe("number")
  })

  test("is registered in the variable-type registry on registry import", () => {
    const registered = getVariableTypeDefinition("malId")
    expect(registered).toBeDefined()
    expect(registered?.type).toBe("malId")
  })

  test("validate rejects an empty value", () => {
    const result = MAL_ID_VARIABLE_DEFINITION.validate?.("")
    expect(result?.isValid).toBe(false)
    expect(result?.message).toMatch(/required/i)
  })

  test("validate rejects a whitespace-only value", () => {
    expect(
      MAL_ID_VARIABLE_DEFINITION.validate?.("   ")?.isValid,
    ).toBe(false)
  })

  test("validate accepts a numeric id", () => {
    expect(
      MAL_ID_VARIABLE_DEFINITION.validate?.("5114")
        ?.isValid,
    ).toBe(true)
  })

  test("validate accepts a myanimelist.net URL", () => {
    const result = MAL_ID_VARIABLE_DEFINITION.validate?.(
      "https://myanimelist.net/anime/5114",
    )
    expect(result?.isValid).toBe(true)
  })

  test("validate rejects free-text (neither numeric nor URL)", () => {
    const result = MAL_ID_VARIABLE_DEFINITION.validate?.(
      "Fullmetal Alchemist Brotherhood",
    )
    expect(result?.isValid).toBe(false)
    expect(result?.message).toMatch(/numeric|url/i)
  })
})
