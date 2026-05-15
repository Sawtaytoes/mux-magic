import { describe, expect, test } from "vitest"

import { validateTemplateYaml } from "./templateYamlValidator.js"

describe("validateTemplateYaml", () => {
  test("accepts a minimal object with a steps array", () => {
    const result = validateTemplateYaml(
      "steps:\n  - id: a\n    command: ''\n    params: {}\n",
    )
    expect(result.isValid).toBe(true)
  })

  test("accepts an object with variables + steps", () => {
    const result = validateTemplateYaml(
      "variables:\n  basePath:\n    label: basePath\n    value: ''\n    type: path\nsteps: []\n",
    )
    expect(result.isValid).toBe(true)
  })

  test("accepts a top-level array (oldest legacy format)", () => {
    const result = validateTemplateYaml(
      "- id: a\n  command: ''\n  params: {}\n",
    )
    expect(result.isValid).toBe(true)
  })

  test("rejects syntactically invalid YAML and surfaces the parser error", () => {
    const result = validateTemplateYaml(
      "steps:\n  - command: foo\n  bad: indent\n",
    )
    expect(result.isValid).toBe(false)
    if (!result.isValid) {
      expect(result.error).toBe("invalid yaml")
      expect(typeof result.details).toBe("string")
      expect(
        (result.details as string).length,
      ).toBeGreaterThan(0)
    }
  })

  test("rejects empty / whitespace-only input", () => {
    expect(validateTemplateYaml("").isValid).toBe(false)
    expect(validateTemplateYaml("   \n\n  ").isValid).toBe(
      false,
    )
  })

  test("rejects a scalar (string / number / boolean)", () => {
    expect(
      validateTemplateYaml("just a string").isValid,
    ).toBe(false)
    expect(validateTemplateYaml("42").isValid).toBe(false)
    expect(validateTemplateYaml("true").isValid).toBe(false)
  })

  test("rejects an object missing the steps key", () => {
    const result = validateTemplateYaml("variables: {}\n")
    expect(result.isValid).toBe(false)
    if (!result.isValid) {
      expect(result.error).toBe("invalid yaml")
    }
  })

  test("rejects an object whose steps is not an array", () => {
    const result = validateTemplateYaml("steps: nope\n")
    expect(result.isValid).toBe(false)
  })

  test("treats steps: null (explicit YAML null) as an empty array", () => {
    const result = validateTemplateYaml("steps: ~\n")
    expect(result.isValid).toBe(true)
  })

  test("rejects payloads exceeding the size cap", () => {
    const huge = "x".repeat(2_000_000)
    const result = validateTemplateYaml(huge)
    expect(result.isValid).toBe(false)
    if (!result.isValid) {
      expect(result.details).toContain("too large")
    }
  })
})
