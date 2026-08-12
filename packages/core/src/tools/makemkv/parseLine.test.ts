import { describe, expect, test } from "vitest"

import { parseMakemkvLine } from "./parseLine.js"

describe(parseMakemkvLine.name, () => {
  test("parses a DRV line, including the seventh field the docs omit", () => {
    expect(
      parseMakemkvLine(
        'DRV:0,2,999,12,"BD-RE HL-DT-ST","DESK_SET","/dev/sr0"',
      ),
    ).toEqual({
      devicePath: "/dev/sr0",
      discName: "DESK_SET",
      driveName: "BD-RE HL-DT-ST",
      enabled: 999,
      flags: 12,
      index: 0,
      type: "DRV",
      visible: 2,
    })
  })

  test("parses a MSG line and keeps every trailing param", () => {
    expect(
      parseMakemkvLine(
        'MSG:3307,0,2,"File 00850.mpls was added as title #2","File %1 was added as title #%2","00850.mpls","2"',
      ),
    ).toEqual({
      code: 3307,
      count: 2,
      flags: 0,
      format: "File %1 was added as title #%2",
      message: "File 00850.mpls was added as title #2",
      params: ["00850.mpls", "2"],
      type: "MSG",
    })
  })

  test("trusts the real field count over MSG's declared count", () => {
    // `count` has been seen disagreeing with reality.
    const parsed = parseMakemkvLine(
      'MSG:5,0,9,"m","f","a","b"',
    )
    expect(parsed).toMatchObject({ params: ["a", "b"] })
  })

  test("parses TCOUNT", () => {
    expect(parseMakemkvLine("TCOUNT:61")).toEqual({
      count: 61,
      type: "TCOUNT",
    })
  })

  test("parses a CINFO disc attribute", () => {
    expect(
      parseMakemkvLine('CINFO:2,0,"Desk Set"'),
    ).toEqual({
      attributeId: 2,
      code: 0,
      type: "CINFO",
      value: "Desk Set",
    })
  })

  test("parses a TINFO line with its leading title index", () => {
    // Dropping the title index is the classic MakeMKV "global index"
    // parsing bug — every attribute lands on the wrong title.
    expect(parseMakemkvLine('TINFO:2,26,0,"800"')).toEqual({
      attributeId: 26,
      code: 0,
      titleIndex: 2,
      type: "TINFO",
      value: "800",
    })
  })

  test("parses a SINFO line with title and stream indices", () => {
    expect(
      parseMakemkvLine('SINFO:2,1,5,0,"A_DTS"'),
    ).toEqual({
      attributeId: 5,
      code: 0,
      streamIndex: 1,
      titleIndex: 2,
      type: "SINFO",
      value: "A_DTS",
    })
  })

  test("parses PRGC / PRGT / PRGV", () => {
    expect(
      parseMakemkvLine('PRGC:5018,1,"Analyzing seamless"'),
    ).toMatchObject({ operationId: 1, type: "PRGC" })
    expect(
      parseMakemkvLine('PRGT:5018,1,"Saving titles"'),
    ).toMatchObject({ operationId: 1, type: "PRGT" })
    expect(parseMakemkvLine("PRGV:100,200,65536")).toEqual({
      current: 100,
      max: 65536,
      total: 200,
      type: "PRGV",
    })
  })

  test("returns UNKNOWN rather than throwing for an unrecognised prefix", () => {
    expect(parseMakemkvLine("hello world")).toEqual({
      raw: "hello world",
      type: "UNKNOWN",
    })
  })

  test("returns MALFORMED when a line is short of its field count", () => {
    // One weird line must not kill a 3-hour analysis.
    expect(parseMakemkvLine("TINFO:2,26")).toMatchObject({
      prefix: "TINFO",
      reason: "TINFO needs 4 fields, got 2",
      type: "MALFORMED",
    })
  })

  test("returns MALFORMED when an id field is not numeric", () => {
    expect(
      parseMakemkvLine('TINFO:x,26,0,"800"'),
    ).toMatchObject({
      reason: "TINFO ids not numeric",
      type: "MALFORMED",
    })
  })

  test("never throws on a line truncated mid-write", () => {
    expect(() =>
      parseMakemkvLine(
        'MSG:5072,0,1,"Backing up disc into',
      ),
    ).not.toThrow()
  })
})
