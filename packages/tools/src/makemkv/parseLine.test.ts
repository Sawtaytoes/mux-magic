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

// The cases below came from rip-deck's parser suite. Every line is real
// output captured from its tower, or a doctest line from ARM's own parser.
describe(`${parseMakemkvLine.name} — rip-deck captures`, () => {
  test("parses a real attached drive with 7 fields", () => {
    expect(
      parseMakemkvLine(
        'DRV:1,0,999,0,"BD-RE PIONEER BD-RW   BDR-211M 1.53 ' +
          'EXAMPLE00007","","/dev/sr2"',
      ),
    ).toEqual({
      devicePath: "/dev/sr2",
      discName: "",
      driveName:
        "BD-RE PIONEER BD-RW   BDR-211M 1.53 EXAMPLE00007",
      enabled: 999,
      flags: 0,
      index: 1,
      type: "DRV",
      visible: 0,
    })
  })

  test("parses the unattached padding bays", () => {
    // MakeMKV always pads its drive list to 16 entries.
    expect(
      parseMakemkvLine('DRV:9,256,999,0,"","",""'),
    ).toMatchObject({
      devicePath: "",
      type: "DRV",
      visible: 256,
    })
  })

  test("flags a 6-field DRV as malformed, not a partial drive", () => {
    // The docs imply 6 fields. Real output has 7. Silently accepting 6
    // would put the disc name in the device path.
    expect(
      parseMakemkvLine(
        'DRV:6,256,999,0,"BD-Drive","THE TITLE"',
      ),
    ).toMatchObject({ type: "MALFORMED" })
  })

  test("parses the startup banner with its params", () => {
    expect(
      parseMakemkvLine(
        'MSG:1005,0,1,"MakeMKV v1.18.4 linux(x64-release) ' +
          'started","%1 started","MakeMKV v1.18.4 ' +
          'linux(x64-release)"',
      ),
    ).toMatchObject({
      code: 1005,
      format: "%1 started",
      params: ["MakeMKV v1.18.4 linux(x64-release)"],
      type: "MSG",
    })
  })

  test("parses a message with a comma in its text", () => {
    const event = parseMakemkvLine(
      'MSG:5074,0,0,"Automatic checking for updates is ' +
        "enabled, you may disable it in preferences if you " +
        'don\'t want MakeMKV to contact web server.","x"',
    )

    expect(event).toMatchObject({ code: 5074, type: "MSG" })
    expect(
      event.type === "MSG" ? event.message : "",
    ).toContain("enabled, you may disable")
  })

  test("parses PRGV with max 65536", () => {
    expect(
      parseMakemkvLine("PRGV:65294,140,65536"),
    ).toEqual({
      current: 65294,
      max: 65536,
      total: 140,
      type: "PRGV",
    })
  })

  test("parses PRGC with an incrementing file id", () => {
    expect(
      parseMakemkvLine('PRGC:5046,134,"Copying file"'),
    ).toEqual({
      code: 5046,
      name: "Copying file",
      operationId: 134,
      type: "PRGC",
    })
  })

  test("parses PRGT", () => {
    expect(
      parseMakemkvLine('PRGT:5047,0,"Copying all files"'),
    ).toEqual({
      code: 5047,
      name: "Copying all files",
      operationId: 0,
      type: "PRGT",
    })
  })

  test("parses TINFO including its leading title index", () => {
    expect(
      parseMakemkvLine('TINFO:1,26,0,"155,156,157"'),
    ).toEqual({
      attributeId: 26,
      code: 0,
      titleIndex: 1,
      type: "TINFO",
      value: "155,156,157",
    })
  })

  test("parses SINFO with five fields, not three", () => {
    // ARM's own docstring says `id,code,value`; its code parses five.
    // Real output has five.
    expect(
      parseMakemkvLine('SINFO:0,0,28,0,"ger"'),
    ).toEqual({
      attributeId: 28,
      code: 0,
      streamIndex: 0,
      titleIndex: 0,
      type: "SINFO",
      value: "ger",
    })
  })

  test("parses CINFO", () => {
    expect(
      parseMakemkvLine('CINFO:1,6209,"Blu-ray disc"'),
    ).toEqual({
      attributeId: 1,
      code: 6209,
      type: "CINFO",
      value: "Blu-ray disc",
    })
  })

  test("parses TCOUNT of zero", () => {
    expect(parseMakemkvLine("TCOUNT:0")).toEqual({
      count: 0,
      type: "TCOUNT",
    })
  })

  test.each([
    "",
    "DRV",
    "DRV:",
    "PRGV:1,2",
    'MSG:5004,0,2,"x"',
    "TINFO:not,a,number,x",
    ":::",
  ])("never throws on the truncated line %j", (line) => {
    expect(() => parseMakemkvLine(line)).not.toThrow()
  })

  test("classifies prose as UNKNOWN, not MALFORMED", () => {
    // A colon in prose must not look like a robot prefix.
    expect(
      parseMakemkvLine("Error: something went wrong"),
    ).toMatchObject({ type: "UNKNOWN" })
  })
})
