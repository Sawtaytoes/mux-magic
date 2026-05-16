import { describe, expect, test } from "vitest"

import { fromBase64Url, toBase64Url } from "./base64url"

describe("base64url", () => {
  test("encodes 1-byte input with no padding (standard base64 + → -, / → _)", () => {
    // 0xfb → standard base64 "+w==" → base64url "-w" (no padding, + swapped to -)
    expect(toBase64Url(new Uint8Array([0xfb]))).toBe("-w")
  })

  test("encodes 1-byte input that exercises the / → _ swap", () => {
    // 0xff → standard base64 "/w==" → base64url "_w"
    expect(toBase64Url(new Uint8Array([0xff]))).toBe("_w")
  })

  test("encodes 2-byte input with no padding", () => {
    // [0xff, 0xff] → standard base64 "//8=" → base64url "__8"
    expect(toBase64Url(new Uint8Array([0xff, 0xff]))).toBe(
      "__8",
    )
  })

  test("encodes 3-byte input (no padding even in standard base64)", () => {
    // [0xff, 0xff, 0xff] → "////" → "____"
    expect(
      toBase64Url(new Uint8Array([0xff, 0xff, 0xff])),
    ).toBe("____")
  })

  test("encodes empty input to empty string", () => {
    expect(toBase64Url(new Uint8Array())).toBe("")
  })

  test("round-trips arbitrary byte sequences", () => {
    const original = new Uint8Array([
      0x00, 0x01, 0x7f, 0x80, 0xfe, 0xff, 0x42, 0x10,
    ])
    const decoded = fromBase64Url(toBase64Url(original))
    expect(decoded).not.toBeNull()
    expect(Array.from(decoded as Uint8Array)).toEqual(
      Array.from(original),
    )
  })

  test("decode returns empty Uint8Array for empty input", () => {
    const decoded = fromBase64Url("")
    expect(decoded).not.toBeNull()
    expect((decoded as Uint8Array).length).toBe(0)
  })

  test("decode rejects characters outside the base64url alphabet", () => {
    // '+' and '/' are valid in standard base64 but not in base64url.
    expect(fromBase64Url("ab+c")).toBeNull()
    expect(fromBase64Url("ab/c")).toBeNull()
    // '=' padding is not used in base64url
    expect(fromBase64Url("ab==")).toBeNull()
    // Outright invalid chars
    expect(fromBase64Url("not!valid")).toBeNull()
  })
})
