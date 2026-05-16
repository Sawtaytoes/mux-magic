import { describe, expect, test } from "vitest"

import { decodeSeqJsonParam } from "./decodeSeqJsonParam"
import { encodeSeqJsonParam } from "./encodeSeqJsonParam"

const BASE64URL_NO_PADDING = /^[A-Za-z0-9_-]*$/

describe("encodeSeqJsonParam", () => {
  test("output uses only the base64url alphabet (no padding, no + or /)", () => {
    const encoded = encodeSeqJsonParam(
      '{"steps":[],"paths":{}}',
    )
    expect(encoded).toMatch(BASE64URL_NO_PADDING)
  })

  test("known vector: '{\"a\":1}' encodes to 'eyJhIjoxfQ'", () => {
    // btoa('{"a":1}') === "eyJhIjoxfQ==" → base64url no padding === "eyJhIjoxfQ"
    expect(encodeSeqJsonParam('{"a":1}')).toBe("eyJhIjoxfQ")
  })

  test("round-trips ASCII payload through encode → decode", () => {
    const original =
      '{"steps":[{"id":"step1","command":"x"}]}'
    expect(
      decodeSeqJsonParam(encodeSeqJsonParam(original)),
    ).toBe(original)
  })

  test("encodes empty string to empty string", () => {
    // Empty in → empty out is the only sensible degenerate. The decoder
    // deliberately returns null for empty (so callers can fall back to
    // ?seq=), so a true round-trip isn't expressible here.
    expect(encodeSeqJsonParam("")).toBe("")
  })

  test("round-trips Unicode payload (accents, CJK)", () => {
    const original = '{"label":"läbel: yés 日本語"}'
    expect(
      decodeSeqJsonParam(encodeSeqJsonParam(original)),
    ).toBe(original)
  })

  test("round-trips emoji payload (surrogate pairs)", () => {
    const original = '{"label":"hello 👋 world 🌍"}'
    expect(
      decodeSeqJsonParam(encodeSeqJsonParam(original)),
    ).toBe(original)
  })
})
