import { describe, expect, test } from "vitest"

import { decodeSeqJsonParam } from "./decodeSeqJsonParam"

describe("decodeSeqJsonParam", () => {
  test("returns null for null input", () => {
    expect(decodeSeqJsonParam(null)).toBeNull()
  })

  test("returns null for undefined input", () => {
    expect(decodeSeqJsonParam(undefined)).toBeNull()
  })

  test("returns null for empty input", () => {
    expect(decodeSeqJsonParam("")).toBeNull()
  })

  test("decodes a known base64url payload to JSON text", () => {
    expect(decodeSeqJsonParam("eyJhIjoxfQ")).toBe('{"a":1}')
  })

  test("returns null for malformed base64url", () => {
    expect(
      decodeSeqJsonParam("not!valid base64url"),
    ).toBeNull()
  })

  test("returns null for legacy base64 containing '+' (refuses mixed alphabet)", () => {
    // Standard base64 for some payloads contains '+' or '/'. The legacy
    // ?seq= reader handles those; ?seqJson= deliberately refuses them so
    // dispatch stays unambiguous.
    expect(decodeSeqJsonParam("ab+c")).toBeNull()
  })

  test("returns null for legacy base64 containing '/'", () => {
    expect(decodeSeqJsonParam("ab/c")).toBeNull()
  })

  test("returns null for input with '=' padding", () => {
    // base64url drops padding; presence of '=' indicates legacy or malformed.
    expect(decodeSeqJsonParam("eyJhIjoxfQ==")).toBeNull()
  })
})
