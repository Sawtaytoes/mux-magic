import { describe, expect, test } from "vitest"

import { scanFields, scanLine } from "./scanFields.js"

describe(scanFields.name, () => {
  test("splits plain unquoted fields", () => {
    expect(scanFields("1,2,3")).toEqual(["1", "2", "3"])
  })

  test("treats a trailing separator as a real empty field", () => {
    expect(scanFields("1,")).toEqual(["1", ""])
  })

  test("returns a single empty field for an empty payload", () => {
    expect(scanFields("")).toEqual([""])
  })

  test("keeps commas inside a quoted field", () => {
    expect(
      scanFields('1,"Alien, Aliens & Alien 3",2'),
    ).toEqual(["1", "Alien, Aliens & Alien 3", "2"])
  })

  test("does not invent a trailing empty field after a final quoted field", () => {
    // A spurious 7th field silently turned a 6-field DRV into an
    // apparently-valid 7-field one and shifted the disc name into the
    // device path.
    expect(scanFields('0,1,2,"name"')).toEqual([
      "0",
      "1",
      "2",
      "name",
    ])
  })

  test("unescapes CSV-style doubled quotes", () => {
    expect(scanFields('"say ""hi"" now"')).toEqual([
      'say "hi" now',
    ])
  })

  test("unescapes C-style backslash quotes — the MSG:5072 case", () => {
    // Every backup emits this shape. Handling only `""` ends the field at
    // the first `\"`, undercounts the fields, and drops the message.
    expect(
      scanFields(
        '5072,0,1,"Backing up disc into folder \\"file:///media\\"",x',
      ),
    ).toEqual([
      "5072",
      "0",
      "1",
      'Backing up disc into folder "file:///media"',
      "x",
    ])
  })

  test("unescapes a doubled backslash", () => {
    expect(scanFields('"C:\\\\Users"')).toEqual([
      "C:\\Users",
    ])
  })

  test("leaves an unknown backslash escape alone", () => {
    // Inventing escape sequences MakeMKV does not emit would corrupt
    // Windows-style paths, which are full of lone backslashes.
    expect(scanFields('"C:\\Users\\kevin"')).toEqual([
      "C:\\Users\\kevin",
    ])
  })

  test("keeps a bare quote inside an unquoted field", () => {
    // Disc volume labels routinely carry one.
    expect(scanFields('0,MY"DISC,2')).toEqual([
      "0",
      'MY"DISC',
      "2",
    ])
  })

  test("tolerates an unterminated quote rather than throwing", () => {
    expect(scanFields('1,"truncated mid-wri')).toEqual([
      "1",
      "truncated mid-wri",
    ])
  })

  test("handles an empty quoted field", () => {
    expect(scanFields('"",x')).toEqual(["", "x"])
  })
})

describe(scanLine.name, () => {
  test("splits on the first colon only", () => {
    expect(scanLine('MSG:1005,0,1,"Error: nope"')).toEqual({
      fields: ["1005", "0", "1", "Error: nope"],
      prefix: "MSG",
    })
  })

  test("returns null for prose that happens to contain a colon", () => {
    expect(
      scanLine("Some sentence: with a colon"),
    ).toBeNull()
  })

  test("returns null when there is no colon at all", () => {
    expect(scanLine("no colon here")).toBeNull()
  })

  test("strips a trailing carriage return", () => {
    expect(scanLine("TCOUNT:10\r")).toEqual({
      fields: ["10"],
      prefix: "TCOUNT",
    })
  })
})
