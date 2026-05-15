import { describe, expect, test } from "vitest"
import { getVariableTypeDefinition } from "../../components/VariableCard/registry"
import { DVD_COMPARE_ID_VARIABLE_DEFINITION } from "./dvdCompareId"

describe("dvdCompareId definition", () => {
  test("declares the expected metadata", () => {
    expect(DVD_COMPARE_ID_VARIABLE_DEFINITION.type).toBe(
      "dvdCompareId",
    )
    expect(DVD_COMPARE_ID_VARIABLE_DEFINITION.label).toBe(
      "DVD Compare ID",
    )
    expect(
      DVD_COMPARE_ID_VARIABLE_DEFINITION.cardinality,
    ).toBe("multi")
    expect(
      DVD_COMPARE_ID_VARIABLE_DEFINITION.isLinkable,
    ).toBe(true)
  })

  test("is registered in the variable-type registry on registry import", () => {
    // Importing the registry registers the type as a side effect.
    const registered =
      getVariableTypeDefinition("dvdCompareId")
    expect(registered).toBeDefined()
    expect(registered?.type).toBe("dvdCompareId")
  })

  test("validate rejects an empty value", () => {
    const result =
      DVD_COMPARE_ID_VARIABLE_DEFINITION.validate?.("")
    expect(result?.isValid).toBe(false)
    expect(result?.message).toMatch(/required/i)
  })

  test("validate rejects a whitespace-only value", () => {
    expect(
      DVD_COMPARE_ID_VARIABLE_DEFINITION.validate?.("   ")
        ?.isValid,
    ).toBe(false)
  })

  test("validate accepts a slug-style id", () => {
    expect(
      DVD_COMPARE_ID_VARIABLE_DEFINITION.validate?.(
        "spider-man-2002",
      )?.isValid,
    ).toBe(true)
  })

  test("validate accepts a numeric id", () => {
    expect(
      DVD_COMPARE_ID_VARIABLE_DEFINITION.validate?.("74759")
        ?.isValid,
    ).toBe(true)
  })

  test("validate accepts a full dvdcompare.net URL", () => {
    const result =
      DVD_COMPARE_ID_VARIABLE_DEFINITION.validate?.(
        "https://dvdcompare.net/comparisons/film.php?fid=74759",
      )
    expect(result?.isValid).toBe(true)
  })

  test("validate rejects a string with spaces (neither slug nor URL)", () => {
    const result =
      DVD_COMPARE_ID_VARIABLE_DEFINITION.validate?.(
        "not a slug",
      )
    expect(result?.isValid).toBe(false)
    expect(result?.message).toMatch(/slug|url/i)
  })
})
