import { describe, expect, test } from "vitest"
import { getVariableTypeDefinition } from "../../components/VariableCard/registry"
import { TMDB_ID_VARIABLE_DEFINITION } from "./tmdbId"

describe("tmdbId definition", () => {
  test("declares the expected metadata", () => {
    expect(TMDB_ID_VARIABLE_DEFINITION.type).toBe("tmdbId")
    expect(TMDB_ID_VARIABLE_DEFINITION.label).toBe(
      "TMDB ID",
    )
    expect(TMDB_ID_VARIABLE_DEFINITION.cardinality).toBe(
      "multi",
    )
    expect(TMDB_ID_VARIABLE_DEFINITION.isLinkable).toBe(
      true,
    )
    expect(
      TMDB_ID_VARIABLE_DEFINITION.runtimeValueType,
    ).toBe("number")
  })

  test("is registered in the variable-type registry on registry import", () => {
    const registered = getVariableTypeDefinition("tmdbId")
    expect(registered).toBeDefined()
    expect(registered?.type).toBe("tmdbId")
  })

  test("validate rejects an empty value", () => {
    const result =
      TMDB_ID_VARIABLE_DEFINITION.validate?.("")
    expect(result?.isValid).toBe(false)
    expect(result?.message).toMatch(/required/i)
  })

  test("validate rejects a whitespace-only value", () => {
    expect(
      TMDB_ID_VARIABLE_DEFINITION.validate?.("   ")
        ?.isValid,
    ).toBe(false)
  })

  test("validate accepts a numeric id", () => {
    expect(
      TMDB_ID_VARIABLE_DEFINITION.validate?.("157336")
        ?.isValid,
    ).toBe(true)
  })

  test("validate accepts a themoviedb.org URL", () => {
    const result = TMDB_ID_VARIABLE_DEFINITION.validate?.(
      "https://www.themoviedb.org/movie/157336",
    )
    expect(result?.isValid).toBe(true)
  })

  test("validate rejects free-text (neither numeric nor URL)", () => {
    const result = TMDB_ID_VARIABLE_DEFINITION.validate?.(
      "Interstellar 2014",
    )
    expect(result?.isValid).toBe(false)
    expect(result?.message).toMatch(/numeric|url/i)
  })
})
