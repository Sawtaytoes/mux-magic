import { describe, expect, test } from "vitest"

import { decodeSeqParam } from "./decodeSeqParam"

describe("decodeSeqParam", () => {
  test("returns null for null input", () => {
    expect(decodeSeqParam(null)).toBe(null)
  })

  test("returns null for undefined input", () => {
    expect(decodeSeqParam(undefined)).toBe(null)
  })

  test("returns null for empty string", () => {
    expect(decodeSeqParam("")).toBe(null)
  })

  test("decodes plain ASCII base64 round-trip", () => {
    // btoa("paths:\n  basePath:\n    value: /tmp") === "cGF0aHM6CiAgYmFzZVBhdGg6CiAgICB2YWx1ZTogL3RtcA=="
    expect(
      decodeSeqParam(
        "cGF0aHM6CiAgYmFzZVBhdGg6CiAgICB2YWx1ZTogL3RtcA==",
      ),
    ).toBe("paths:\n  basePath:\n    value: /tmp")
  })

  test("decodes JSON payload (current React writer format)", () => {
    // The current buildBuilderUrl.ts produces JSON, not YAML.
    // btoa(unescape(encodeURIComponent('{"paths":{},"steps":[]}'))) === "eyJwYXRocyI6e30sInN0ZXBzIjpbXX0="
    expect(
      decodeSeqParam("eyJwYXRocyI6e30sInN0ZXBzIjpbXX0="),
    ).toBe('{"paths":{},"steps":[]}')
  })

  test("decodes Unicode payload (escape+decodeURIComponent round-trip)", () => {
    // btoa(unescape(encodeURIComponent("läbel: yés"))) === "bMOkYmVsOiB5w6lz"
    expect(decodeSeqParam("bMOkYmVsOiB5w6lz")).toBe(
      "läbel: yés",
    )
  })

  test("returns null for invalid base64", () => {
    expect(decodeSeqParam("not!valid!base64!@#$")).toBe(
      null,
    )
  })

  test("returns null when decoded bytes aren't valid URI-encoded UTF-8", () => {
    // Base64 for a raw byte that escape/decodeURIComponent rejects:
    // atob("/w==") === "\xff" → escape("\xff") === "%FF" → decodeURIComponent("%FF") throws (lone continuation byte)
    expect(decodeSeqParam("/w==")).toBe(null)
  })
})
