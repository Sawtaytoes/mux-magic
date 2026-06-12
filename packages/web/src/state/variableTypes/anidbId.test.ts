import { describe, expect, test } from "vitest"
import { getVariableTypeDefinition } from "../../components/VariableCard/registry"
import { ANIDB_ID_VARIABLE_DEFINITION } from "./anidbId"

describe("anidbId definition", () => {
  test("declares the expected metadata", () => {
    expect(ANIDB_ID_VARIABLE_DEFINITION.type).toBe(
      "anidbId",
    )
    expect(ANIDB_ID_VARIABLE_DEFINITION.label).toBe(
      "AniDB ID",
    )
    expect(ANIDB_ID_VARIABLE_DEFINITION.cardinality).toBe(
      "multi",
    )
    expect(ANIDB_ID_VARIABLE_DEFINITION.isLinkable).toBe(
      true,
    )
    expect(
      ANIDB_ID_VARIABLE_DEFINITION.runtimeValueType,
    ).toBe("number")
  })

  test("is registered in the variable-type registry on registry import", () => {
    const registered = getVariableTypeDefinition("anidbId")
    expect(registered).toBeDefined()
    expect(registered?.type).toBe("anidbId")
  })

  test("validate rejects an empty value", () => {
    const result =
      ANIDB_ID_VARIABLE_DEFINITION.validate?.("")
    expect(result?.isValid).toBe(false)
    expect(result?.message).toMatch(/required/i)
  })

  test("validate rejects a whitespace-only value", () => {
    expect(
      ANIDB_ID_VARIABLE_DEFINITION.validate?.("   ")
        ?.isValid,
    ).toBe(false)
  })

  test("validate accepts a numeric id", () => {
    expect(
      ANIDB_ID_VARIABLE_DEFINITION.validate?.("8160")
        ?.isValid,
    ).toBe(true)
  })

  test("validate accepts an anidb.net URL", () => {
    const result = ANIDB_ID_VARIABLE_DEFINITION.validate?.(
      "https://anidb.net/anime/8160",
    )
    expect(result?.isValid).toBe(true)
  })

  test("validate rejects free-text (neither numeric nor URL)", () => {
    const result = ANIDB_ID_VARIABLE_DEFINITION.validate?.(
      "Fullmetal Alchemist",
    )
    expect(result?.isValid).toBe(false)
    expect(result?.message).toMatch(/numeric|url/i)
  })
})
