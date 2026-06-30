import { describe, expect, test } from "vitest"

import {
  decodeBufferWithEncodingFallback,
  decodeResponseText,
} from "./decodeBufferWithEncodingFallback.js"

// Windows-1252 byte values for the punctuation DVDCompare's legacy listings
// use and that broke as U+FFFD when decoded strictly as UTF-8.
const LDQUO = 0x93 // " U+201C
const RDQUO = 0x94 // " U+201D
const RSQUO = 0x92 // ' U+2019

describe(decodeBufferWithEncodingFallback.name, () => {
  test("decodes plain ASCII UTF-8 unchanged", () => {
    const buf = Buffer.from("Bowling for Beaker", "utf8")
    expect(decodeBufferWithEncodingFallback(buf)).toBe(
      "Bowling for Beaker",
    )
  })

  test("decodes multi-byte UTF-8 (curly quotes already encoded as UTF-8)", () => {
    const buf = Buffer.from("“Bowling for Beaker”", "utf8")
    expect(decodeBufferWithEncodingFallback(buf)).toBe(
      "“Bowling for Beaker”",
    )
  })

  test("recovers Windows-1252 smart quotes that strict UTF-8 would have turned into U+FFFD", () => {
    // The exact failure that corrupted the Muppets filenames: a title wrapped
    // in 1252 smart quotes, served as (mislabeled) UTF-8.
    const buf = Buffer.from([
      LDQUO,
      ...Buffer.from("Bowling for Beaker", "latin1"),
      RDQUO,
    ])
    const decoded = decodeBufferWithEncodingFallback(buf)
    expect(decoded).toBe("“Bowling for Beaker”")
    expect(decoded).not.toContain("�")
  })

  test("recovers a Windows-1252 curly apostrophe (Walter's)", () => {
    const buf = Buffer.from([
      ...Buffer.from("Walter", "latin1"),
      RSQUO,
      ...Buffer.from("s Extended Nightmare", "latin1"),
    ])
    expect(decodeBufferWithEncodingFallback(buf)).toBe(
      "Walter’s Extended Nightmare",
    )
  })

  test("reports the chosen charset via the onFallback callback only when it falls back", () => {
    const utf8Charsets: string[] = []
    decodeBufferWithEncodingFallback(
      Buffer.from("plain ascii", "utf8"),
      (charset) => utf8Charsets.push(charset),
    )
    expect(utf8Charsets).toEqual([])

    const fallbackCharsets: string[] = []
    decodeBufferWithEncodingFallback(
      Buffer.from([LDQUO, 0x41, RDQUO]),
      (charset) => fallbackCharsets.push(charset),
    )
    expect(fallbackCharsets).toEqual(["windows-1252"])
  })

  test("does not throw on a garbage byte buffer", () => {
    const garbage = Buffer.from([
      0xff, 0xfe, 0xab, 0xcd, 0x00, 0x7f, 0x80,
    ])
    expect(() =>
      decodeBufferWithEncodingFallback(garbage),
    ).not.toThrow()
  })
})

describe(decodeResponseText.name, () => {
  test("reads raw bytes from arrayBuffer and recovers mislabeled Windows-1252", async () => {
    // Back the stub with a typed array so .buffer is an exact ArrayBuffer,
    // matching what a real fetch Response.arrayBuffer() returns (a plain
    // Buffer's .buffer would expose Node's whole shared pool instead).
    const bytes = new Uint8Array([
      LDQUO,
      ...Buffer.from("A Hero In Hollywood", "latin1"),
      RDQUO,
    ])
    const response = {
      arrayBuffer: async () => bytes.buffer,
    }
    expect(await decodeResponseText(response)).toBe(
      "“A Hero In Hollywood”",
    )
  })

  test("passes clean UTF-8 bytes through untouched", async () => {
    const response = {
      arrayBuffer: async () =>
        new TextEncoder().encode("Soldier (1998)").buffer,
    }
    expect(await decodeResponseText(response)).toBe(
      "Soldier (1998)",
    )
  })
})
