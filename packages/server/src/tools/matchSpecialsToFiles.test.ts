import { firstValueFrom, of } from "rxjs"
import { toArray } from "rxjs/operators"
import { describe, expect, test, vi } from "vitest"

import type { AnidbEpisode } from "../types/anidb.js"

// matchSpecialsToFiles drives the per-file picker for AniDB specials.
// We cover the helper end-to-end through its public Observable: stub
// readMediaDurationMinutes to feed deterministic durations, stub
// getUserSearchInput to script the picker responses, then assert on
// the emitted MatchedSpecial[] (length-ranked candidates, no
// double-claims, skip + cancel handling).
//
// vi.mock calls are hoisted above the imports below so the imported
// references resolve to the mocked functions, not the real ones.

vi.mock("./readMediaDurationMinutes.js", () => ({
  readMediaDurationMinutes: vi.fn(),
}))

vi.mock("./getUserSearchInput.js", () => ({
  getUserSearchInput: vi.fn(),
}))

import { getUserSearchInput } from "./getUserSearchInput.js"
import { matchSpecialsToFiles } from "./matchSpecialsToFiles.js"
import { readMediaDurationMinutes } from "./readMediaDurationMinutes.js"

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

const stubFileMinutes = (
  filenameToMinutes: Record<string, number | null>,
) => {
  const mocked = vi.mocked(readMediaDurationMinutes)
  mocked.mockImplementation((filePath: string) => {
    const filename = filePath.split("/").pop() ?? filePath
    return of(filenameToMinutes[filename] ?? null)
  })
}

const stubPickerResponses = (responses: number[]) => {
  const mocked = vi.mocked(getUserSearchInput)
  let callIndex = 0
  mocked.mockImplementation(() => {
    const next = responses[callIndex] ?? -1
    callIndex += 1
    return of(next)
  })
  return () => callIndex // returns the count of prompts dispatched
}

describe("matchSpecialsToFiles", () => {
  test("ranks candidates by absolute minute delta", async () => {
    stubFileMinutes({ "ova01.mkv": 32 })
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
    stubFileMinutes({ "a.mkv": 30, "b.mkv": 30 })
    const specials: AnidbEpisode[] = [
      buildEpisode(2, "S20", 30, "Memory Snow"),
      buildEpisode(2, "S21", 30, "Frozen Bonds"),
    ]
    // Both responses pick option 0 — but "option 0" on the second
    // prompt should be S21, not S20 (which is already claimed).
    stubPickerResponses([0, 0])

    const matches = await firstValueFrom(
      matchSpecialsToFiles({
        fileInfos: [
          buildFileInfo("a.mkv"),
          buildFileInfo("b.mkv"),
        ],
        specials,
      }).pipe(toArray()),
    )

    expect(
      matches.map((match) => match.episode.epno),
    ).toEqual(["S20", "S21"])
  })

  test("skipping a file (selectedIndex=-1) drops it from the result", async () => {
    stubFileMinutes({ "junk.mkv": 5, "real.mkv": 32 })
    const specials: AnidbEpisode[] = [
      buildEpisode(2, "S20", 32, "Memory Snow"),
    ]
    // Skip first file, pick first candidate for the second.
    stubPickerResponses([-1, 0])

    const matches = await firstValueFrom(
      matchSpecialsToFiles({
        fileInfos: [
          buildFileInfo("junk.mkv"),
          buildFileInfo("real.mkv"),
        ],
        specials,
      }).pipe(toArray()),
    )

    expect(matches).toHaveLength(1)
    expect(matches[0].fileInfo.filename).toBe("real.mkv")
    expect(matches[0].episode.epno).toBe("S20")
  })

  test("cancel (selectedIndex=-2) keeps prior matches and stops prompting subsequent files", async () => {
    stubFileMinutes({
      "a.mkv": 32,
      "b.mkv": 32,
      "c.mkv": 32,
    })
    const specials: AnidbEpisode[] = [
      buildEpisode(2, "S20", 32, "Memory Snow"),
      buildEpisode(2, "S21", 32, "Frozen Bonds"),
      buildEpisode(2, "S22", 32, "The Frozen Sword"),
    ]
    // First file picks 0; second file cancels (-2); third file should
    // never be prompted.
    const promptCount = stubPickerResponses([0, -2])

    const matches = await firstValueFrom(
      matchSpecialsToFiles({
        fileInfos: [
          buildFileInfo("a.mkv"),
          buildFileInfo("b.mkv"),
          buildFileInfo("c.mkv"),
        ],
        specials,
      }).pipe(toArray()),
    )

    // Only the first file's match flows downstream.
    expect(
      matches.map((match) => match.fileInfo.filename),
    ).toEqual(["a.mkv"])
    expect(matches[0].episode.epno).toBe("S20")
    // Two prompts dispatched (for a.mkv and b.mkv); c.mkv is never
    // prompted because the cancel flag short-circuits the outer loop.
    expect(promptCount()).toBe(2)
  })

  test("returns nothing when the available specials run out mid-walk", async () => {
    stubFileMinutes({ "a.mkv": 30, "b.mkv": 30 })
    // Only one special to claim; the second file should silently drop
    // out (no prompt, no match) rather than throw.
    const specials: AnidbEpisode[] = [
      buildEpisode(2, "S20", 30, "Memory Snow"),
    ]
    stubPickerResponses([0])

    const matches = await firstValueFrom(
      matchSpecialsToFiles({
        fileInfos: [
          buildFileInfo("a.mkv"),
          buildFileInfo("b.mkv"),
        ],
        specials,
      }).pipe(toArray()),
    )

    expect(
      matches.map((match) => match.fileInfo.filename),
    ).toEqual(["a.mkv"])
  })
})
