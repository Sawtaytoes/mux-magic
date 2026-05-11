import { describe, expect, test } from "vitest"

import { decodeSeqParam } from "./decodeSeqParam"
import { encodeSeqParam } from "./encodeSeqParam"

describe("encodeSeqParam", () => {
  test("round-trips plain ASCII YAML", () => {
    const original = "paths:\n  basePath:\n    value: /tmp"
    expect(decodeSeqParam(encodeSeqParam(original))).toBe(
      original,
    )
  })

  test("round-trips Unicode YAML (label with accents)", () => {
    const original = "label: läbel: yés"
    expect(decodeSeqParam(encodeSeqParam(original))).toBe(
      original,
    )
  })

  test("produces stable base64 output (no padding surprises)", () => {
    // btoa(unescape(encodeURIComponent("paths: {}\n"))) === "cGF0aHM6IHt9Cg=="
    expect(encodeSeqParam("paths: {}\n")).toBe(
      "cGF0aHM6IHt9Cg==",
    )
  })

  test("encodes empty string to empty base64", () => {
    expect(encodeSeqParam("")).toBe("")
  })
})
