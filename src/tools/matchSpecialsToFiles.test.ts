import { firstValueFrom, of } from "rxjs"
import { toArray } from "rxjs/operators"
import { describe, expect, test, vi } from "vitest"

import type { AnidbEpisode } from "../types/anidb.js"

// matchSpecialsToFiles drives the per-file picker for AniDB specials.
// We cover the helper end-to-end through its public Observable: stub
// getMediaInfo to feed deterministic durations, stub
// getUserSearchInput to script the picker responses, then assert on
// the emitted MatchedSpecial[] (length-ranked candidates, no
// double-claims, skip handling).
//
// vi.mock calls are hoisted above the import below so the imported
// references resolve to the mocked functions, not the real ones.

vi.mock("./getMediaInfo.js", () => ({
  getMediaInfo: vi.fn(),
}))

vi.mock("./getUserSearchInput.js", () => ({
  getUserSearchInput: vi.fn(),
}))

import { getMediaInfo } from "./getMediaInfo.js"
import { getUserSearchInput } from "./getUserSearchInput.js"
import { matchSpecialsToFiles } from "./matchSpecialsToFiles.js"

const buildFileInfo = (filename: string) => ({
  filename,
  fullPath: `/work/${filename}`,
  renameFile: vi.fn(),
})

const buildEpisode = (
  type: AnidbEpisode["type"],
  epno: string,
  length: number | undefined,
  englishTitle: string,
): AnidbEpisode => ({
  airdate: undefined,
  epno,
  length,
  titles: [{ lang: "en", value: englishTitle }],
  type,
})

const stubMediaInfoSeconds = (filenameToSeconds: Record<string, number>) => {
  const mockedGetMediaInfo = vi.mocked(getMediaInfo)
  mockedGetMediaInfo.mockImplementation((filePath: string) => {
    const filename = filePath.split("/").pop() ?? filePath
    const seconds = filenameToSeconds[filename] ?? 0
    return of({
      creatingLibrary: { name: "stub", url: "", version: "0" },
      media: {
        "@ref": filePath,
        track: [
          { "@type": "General", Duration: String(seconds) } as never,
        ],
      },
    })
  })
}

const stubPickerResponses = (responses: number[]) => {
  const mockedGetUserSearchInput = vi.mocked(getUserSearchInput)
  let callIndex = 0
  mockedGetUserSearchInput.mockImplementation(() => {
    const next = responses[callIndex] ?? -1
    callIndex += 1
    return of(next)
  })
}

describe("matchSpecialsToFiles", () => {
  test("ranks candidates by absolute minute delta", async () => {
    stubMediaInfoSeconds({ "ova01.mkv": 32 * 60 })
    // Episodes with varied lengths; closest to 32m is S20 (32m), then
    // S21 (35m, Δ3), then S22 (28m, Δ4), then S23 (45m, Δ13).
    const specials: AnidbEpisode[] = [
      buildEpisode(2, "S23", 45, "Episode S23"),
      buildEpisode(2, "S20", 32, "Episode S20"),
      buildEpisode(2, "S22", 28, "Episode S22"),
      buildEpisode(2, "S21", 35, "Episode S21"),
    ]
    // Pick option 0 (the best-ranked candidate).
    stubPickerResponses([0])

    const matches = await firstValueFrom(
      matchSpecialsToFiles({
        fileInfos: [buildFileInfo("ova01.mkv")],
        specials,
      }).pipe(toArray()),
    )

    expect(matches).toHaveLength(1)
    expect(matches[0].episode.epno).toBe("S20")
    expect(matches[0].fileInfo.filename).toBe("ova01.mkv")
  })

  test("does not re-offer an already-claimed episode on subsequent files", async () => {
    // Both files are 30m. The picker should offer the same set on the
    // first prompt, but after the user picks S20 it must drop out of
    // the second prompt's candidate list.
    stubMediaInfoSeconds({ "a.mkv": 30 * 60, "b.mkv": 30 * 60 })
    const specials: AnidbEpisode[] = [
      buildEpisode(2, "S20", 30, "Memory Snow"),
      buildEpisode(2, "S21", 30, "Frozen Bonds"),
    ]
    // Both responses pick option 0 — but "option 0" on the second
    // prompt should be S21, not S20 (which is already claimed).
    stubPickerResponses([0, 0])

    const matches = await firstValueFrom(
      matchSpecialsToFiles({
        fileInfos: [buildFileInfo("a.mkv"), buildFileInfo("b.mkv")],
        specials,
      }).pipe(toArray()),
    )

    expect(matches.map((match) => match.episode.epno)).toEqual(["S20", "S21"])
  })

  test("skipping a file (selectedIndex=-1) drops it from the result", async () => {
    stubMediaInfoSeconds({ "junk.mkv": 5 * 60, "real.mkv": 32 * 60 })
    const specials: AnidbEpisode[] = [buildEpisode(2, "S20", 32, "Memory Snow")]
    // Skip first file, pick first candidate for the second.
    stubPickerResponses([-1, 0])

    const matches = await firstValueFrom(
      matchSpecialsToFiles({
        fileInfos: [buildFileInfo("junk.mkv"), buildFileInfo("real.mkv")],
        specials,
      }).pipe(toArray()),
    )

    expect(matches).toHaveLength(1)
    expect(matches[0].fileInfo.filename).toBe("real.mkv")
    expect(matches[0].episode.epno).toBe("S20")
  })

  test("returns nothing when the available specials run out mid-walk", async () => {
    stubMediaInfoSeconds({ "a.mkv": 30 * 60, "b.mkv": 30 * 60 })
    // Only one special to claim; the second file should silently drop
    // out (no prompt, no match) rather than throw.
    const specials: AnidbEpisode[] = [buildEpisode(2, "S20", 30, "Memory Snow")]
    stubPickerResponses([0])

    const matches = await firstValueFrom(
      matchSpecialsToFiles({
        fileInfos: [buildFileInfo("a.mkv"), buildFileInfo("b.mkv")],
        specials,
      }).pipe(toArray()),
    )

    expect(matches.map((match) => match.fileInfo.filename)).toEqual(["a.mkv"])
  })
})
