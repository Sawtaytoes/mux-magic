import { describe, expect, test } from "vitest"

import {
  scanMakemkvFields,
  scanMakemkvLine,
} from "./scanFields.js"

describe(scanMakemkvFields.name, () => {
  test("splits plain unquoted fields", () => {
    expect(scanMakemkvFields("1,2,3")).toEqual([
      "1",
      "2",
      "3",
    ])
  })

  test("treats a trailing separator as a real empty field", () => {
    expect(scanMakemkvFields("1,")).toEqual(["1", ""])
  })

  test("returns a single empty field for an empty payload", () => {
    expect(scanMakemkvFields("")).toEqual([""])
  })

  test("keeps commas inside a quoted field", () => {
    expect(
      scanMakemkvFields('1,"Alien, Aliens & Alien 3",2'),
    ).toEqual(["1", "Alien, Aliens & Alien 3", "2"])
  })

  test("does not invent a trailing empty field after a final quoted field", () => {
    // A spurious 7th field silently turned a 6-field DRV into an
    // apparently-valid 7-field one and shifted the disc name into the
    // device path.
    expect(scanMakemkvFields('0,1,2,"name"')).toEqual([
      "0",
      "1",
      "2",
      "name",
    ])
  })

  test("unescapes CSV-style doubled quotes", () => {
    expect(scanMakemkvFields('"say ""hi"" now"')).toEqual([
      'say "hi" now',
    ])
  })

  test("unescapes C-style backslash quotes — the MSG:5072 case", () => {
    // Every backup emits this shape. Handling only `""` ends the field at
    // the first `\"`, undercounts the fields, and drops the message.
    expect(
      scanMakemkvFields(
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
    expect(scanMakemkvFields('"C:\\\\Users"')).toEqual([
      "C:\\Users",
    ])
  })

  test("leaves an unknown backslash escape alone", () => {
    // Inventing escape sequences MakeMKV does not emit would corrupt
    // Windows-style paths, which are full of lone backslashes.
    expect(
      scanMakemkvFields('"C:\\Users\\example"'),
    ).toEqual(["C:\\Users\\example"])
  })

  test("keeps a bare quote inside an unquoted field", () => {
    // Disc volume labels routinely carry one.
    expect(scanMakemkvFields('0,MY"DISC,2')).toEqual([
      "0",
      'MY"DISC',
      "2",
    ])
  })

  test("tolerates an unterminated quote rather than throwing", () => {
    expect(
      scanMakemkvFields('1,"truncated mid-wri'),
    ).toEqual(["1", "truncated mid-wri"])
  })

  test("handles an empty quoted field", () => {
    expect(scanMakemkvFields('"",x')).toEqual(["", "x"])
  })
})

describe(scanMakemkvLine.name, () => {
  test("splits on the first colon only", () => {
    expect(
      scanMakemkvLine('MSG:1005,0,1,"Error: nope"'),
    ).toEqual({
      fields: ["1005", "0", "1", "Error: nope"],
      prefix: "MSG",
    })
  })

  test("returns null for prose that happens to contain a colon", () => {
    expect(
      scanMakemkvLine("Some sentence: with a colon"),
    ).toBeNull()
  })

  test("returns null when there is no colon at all", () => {
    expect(scanMakemkvLine("no colon here")).toBeNull()
  })

  test("strips a trailing carriage return", () => {
    expect(scanMakemkvLine("TCOUNT:10\r")).toEqual({
      fields: ["10"],
      prefix: "TCOUNT",
    })
  })
})

// The cases below came from rip-deck's own scanner suites. Every payload is
// real `makemkvcon` output captured on its tower, or a doctest line from
// ARM's parser — never a shape invented to make the scanner pass.
describe(`${scanMakemkvFields.name} — rip-deck captures`, () => {
  test("handles the backslash-escaped quotes of a real MSG:5072", () => {
    // The single malformed line in a 57,483-line real capture.
    const fields = scanMakemkvFields(
      '5072,131072,1,"Backing up disc into folder \\"file:///out\\"",' +
        '"Backing up disc into folder \\"%1\\"","file:///out"',
    )

    expect(fields).toHaveLength(6)
    expect(fields[3]).toBe(
      'Backing up disc into folder "file:///out"',
    )
    expect(fields[5]).toBe("file:///out")
  })

  test("still handles CSV-style doubled quotes beside the backslash form", () => {
    expect(
      scanMakemkvFields('1,"say ""what"" now",2'),
    ).toEqual(["1", 'say "what" now', "2"])
  })

  test("reads an escaped quote as content, leaving the field open", () => {
    // `"ends with \"` has no closing quote once `\"` is read as a literal
    // quote, so the field runs to end-of-line. Treating a trailing `\"` as
    // a terminator is the tempting wrong fix.
    expect(scanMakemkvFields('1,"ends with \\",2')).toEqual(
      ["1", 'ends with ",2'],
    )
  })

  test("keeps commas inside a quoted TINFO segment map", () => {
    // ARM's own doctest.
    expect(
      scanMakemkvFields('1,26,0,"155,156,157"'),
    ).toEqual(["1", "26", "0", "155,156,157"])
  })

  test("keeps an apostrophe inside a quoted field", () => {
    // Real MSG:5074, which every run emits.
    const fields = scanMakemkvFields(
      '5074,0,0,"Automatic checking for updates is enabled, ' +
        "you may disable it in preferences if you don't want " +
        'MakeMKV to contact web server."',
    )

    expect(fields).toHaveLength(4)
    expect(fields[3]).toContain("don't")
    expect(fields[3]).toContain("enabled, you may")
  })

  test("keeps single quotes and colons inside a quoted field", () => {
    // Real MSG:2003 shape.
    const fields = scanMakemkvFields(
      "2003,0,3,\"Error 'Scsi error - NOT READY:MEDIUM NOT " +
        "PRESENT - TRAY OPEN' occurred while reading " +
        "'/BDMV/STREAM/00014.m2ts' at offset '0'\"",
    )

    expect(fields[3]).toContain(
      "NOT READY:MEDIUM NOT PRESENT",
    )
    expect(fields[3]).toContain("'/BDMV/STREAM/00014.m2ts'")
  })

  test("tolerates a bare quote in a disc volume label", () => {
    expect(scanMakemkvFields('1,THE "BURBS,2')).toEqual([
      "1",
      'THE "BURBS',
      "2",
    ])
  })

  test("does not invent a field after a trailing quoted one", () => {
    expect(scanMakemkvFields('0,1,"last"')).toHaveLength(3)
  })

  test("keeps a genuinely empty trailing field", () => {
    expect(scanMakemkvFields("0,1,")).toEqual([
      "0",
      "1",
      "",
    ])
  })

  test("preserves the empty quoted fields of a padding drive bay", () => {
    expect(
      scanMakemkvFields('9,256,999,0,"","",""'),
    ).toEqual(["9", "256", "999", "0", "", "", ""])
  })

  test("keeps text after a closing quote instead of dropping the rest of the line", () => {
    // rip-deck's scanner ended the line here; mux-magic's keeps the
    // trailing text. makemkvcon does not emit this shape, and silently
    // truncating a line is the worse failure of the two.
    expect(scanMakemkvFields('"a"b,c')).toEqual(["ab", "c"])
  })
})
