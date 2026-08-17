import { join } from "node:path"

import { describe, expect, test, vi } from "vitest"

import {
  getSavedTitleCount,
  makemkvMessageCode,
} from "./makemkvEvents.js"
import { parseMakemkvLine } from "./parseLine.js"

// vitest.setup.ts swaps node:fs for memfs, so the fixtures need the real one.
const realFs =
  await vi.importActual<typeof import("node:fs")>("node:fs")

const loadEvents = (fixtureName: string) =>
  realFs
    .readFileSync(
      join(
        import.meta.dirname,
        "__fixtures__",
        fixtureName,
      ),
      "utf8",
    )
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map(parseMakemkvLine)

describe(getSavedTitleCount.name, () => {
  test("reads the count off a real `mkv` extraction", () => {
    expect(
      getSavedTitleCount(
        loadEvents(
          "desk-set-bluray-extract-title.robot.log",
        ),
      ),
    ).toBe(1)
  })

  test("the capture carries 5036/5005 and no 5004 at all", () => {
    // rip-deck's contracts call 5004 COPY_COMPLETE, from the docs. It
    // never runs `mkv` mode, so that code has never been exercised —
    // MakeMKV v1.18.4 emits 5036 and 5005 here. Guarding on 5004 would
    // fail every successful extraction.
    const messageCodes = loadEvents(
      "desk-set-bluray-extract-title.robot.log",
    )
      .filter((event) => event.type === "MSG")
      .map((event) => event.code)

    expect(messageCodes).toContain(
      makemkvMessageCode.COPY_COMPLETE,
    )
    expect(messageCodes).toContain(
      makemkvMessageCode.TITLES_SAVED,
    )
    expect(messageCodes).not.toContain(5004)
  })

  test("returns null when nothing reported a count", () => {
    expect(
      getSavedTitleCount(
        loadEvents("desk-set-bluray.robot.log"),
      ),
    ).toBeNull()
  })

  test("the same disc numbers titles differently per --minlength", () => {
    // MSG:3307 is `File %1 was added as title #%2`. In the 60-second
    // capture the trailer is title #1; it only got that index because 59
    // shorter titles were filtered out first.
    const titleAddedParams = loadEvents(
      "desk-set-bluray-extract-title.robot.log",
    )
      .filter(
        (event) =>
          event.type === "MSG" &&
          event.code === makemkvMessageCode.TITLE_ADDED,
      )
      .map((event) =>
        event.type === "MSG" ? event.params : [],
      )

    expect(titleAddedParams).toEqual([
      ["00850.mpls", "0"],
      ["01395.m2ts", "1"],
    ])
  })
})
