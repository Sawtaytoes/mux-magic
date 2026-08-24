import { describe, expect, test } from "vitest"

import { sanitizePathSegment } from "./sanitizePathSegment.js"

describe(sanitizePathSegment.name, () => {
  test("leaves a clean segment alone", () => {
    expect(
      sanitizePathSegment({ segment: "Album Name" }),
    ).toBe("Album Name")
  })

  test("replaces a forward slash with an underscore", () => {
    expect(sanitizePathSegment({ segment: "AC/DC" })).toBe(
      "AC_DC",
    )
  })

  test("replaces a backslash with an underscore", () => {
    expect(sanitizePathSegment({ segment: "AC\\DC" })).toBe(
      "AC_DC",
    )
  })

  test("replaces each Windows-forbidden character one for one", () => {
    expect(
      sanitizePathSegment({ segment: '|?><:*"' }),
    ).toBe("_______")
  })

  test("keeps the Windows-forbidden characters when the option is off", () => {
    expect(
      sanitizePathSegment({
        segment: "Who? What: Why*",
        isWindowsCompatible: false,
      }),
    ).toBe("Who? What: Why*")
  })

  test("strips ASCII control characters", () => {
    expect(
      sanitizePathSegment({
        segment: "Track\u0000Title\u001fEnd\u007f",
      }),
    ).toBe("TrackTitleEnd")
  })

  test("trims trailing spaces and dots", () => {
    expect(
      sanitizePathSegment({ segment: "Track Title..." }),
    ).toBe("Track Title")
    expect(
      sanitizePathSegment({ segment: "Track Title . . " }),
    ).toBe("Track Title")
  })

  test("keeps a dot inside the segment", () => {
    expect(sanitizePathSegment({ segment: "S.O.S." })).toBe(
      "S.O.S",
    )
  })

  test("trims leading and trailing whitespace", () => {
    expect(
      sanitizePathSegment({ segment: "   Album Name   " }),
    ).toBe("Album Name")
  })

  test("never produces an empty segment", () => {
    expect(sanitizePathSegment({ segment: "" })).toBe("_")
    expect(sanitizePathSegment({ segment: "   " })).toBe(
      "_",
    )
    expect(sanitizePathSegment({ segment: "..." })).toBe(
      "_",
    )
  })

  test("leaves Japanese text unchanged, because ascii_filenames is false", () => {
    expect(
      sanitizePathSegment({ segment: "君の名は。" }),
    ).toBe("君の名は。")
  })

  test("leaves curly quotes and long dashes unchanged", () => {
    expect(
      sanitizePathSegment({ segment: "‘Heroes’ — Live" }),
    ).toBe("‘Heroes’ — Live")
  })

  test("transliterates only when isAsciiOnly is on", () => {
    expect(
      sanitizePathSegment({
        segment: "Björk",
        isAsciiOnly: true,
      }),
    ).toBe("Bjork")
    expect(sanitizePathSegment({ segment: "Björk" })).toBe(
      "Björk",
    )
  })

  test("replaces spaces only when isSpaceReplaced is on", () => {
    expect(
      sanitizePathSegment({
        segment: "Album Name",
        isSpaceReplaced: true,
      }),
    ).toBe("Album_Name")
    expect(
      sanitizePathSegment({ segment: "Album Name" }),
    ).toBe("Album Name")
  })
})
