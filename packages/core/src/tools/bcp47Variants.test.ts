import { describe, expect, test } from "vitest"
import {
  BCP47_VARIANTS,
  bcp47VariantTags,
  deriveIso6392FromBcp47Tag,
} from "./bcp47Variants.js"

describe("BCP47_VARIANTS", () => {
  test("contains at least one chi entry", () => {
    const chiVariants = BCP47_VARIANTS.filter(
      (variant) => variant.base === "chi",
    )
    expect(chiVariants.length).toBeGreaterThan(0)
  })

  test("contains zh-Hant-HK for chi", () => {
    const found = BCP47_VARIANTS.find(
      (variant) => variant.tag === "zh-Hant-HK",
    )
    expect(found).toBeDefined()
    expect(found?.base).toBe("chi")
  })

  test("contains pt-BR for por", () => {
    const found = BCP47_VARIANTS.find(
      (variant) => variant.tag === "pt-BR",
    )
    expect(found).toBeDefined()
    expect(found?.base).toBe("por")
  })
})

describe("bcp47VariantTags", () => {
  test("is a non-empty array", () => {
    expect(bcp47VariantTags.length).toBeGreaterThan(0)
  })

  test("includes zh-Hant-HK", () => {
    expect(bcp47VariantTags).toContain("zh-Hant-HK")
  })
})

describe("deriveIso6392FromBcp47Tag", () => {
  test("maps zh-Hant-HK to chi", () => {
    expect(deriveIso6392FromBcp47Tag("zh-Hant-HK")).toBe(
      "chi",
    )
  })

  test("maps zh-Hans-CN to chi", () => {
    expect(deriveIso6392FromBcp47Tag("zh-Hans-CN")).toBe(
      "chi",
    )
  })

  test("maps pt-BR to por", () => {
    expect(deriveIso6392FromBcp47Tag("pt-BR")).toBe("por")
  })

  test("maps en-US to eng via 2-letter fallback", () => {
    expect(deriveIso6392FromBcp47Tag("en-US")).toBe("eng")
  })

  test("maps en-GB to eng via 2-letter fallback", () => {
    expect(deriveIso6392FromBcp47Tag("en-GB")).toBe("eng")
  })
})
