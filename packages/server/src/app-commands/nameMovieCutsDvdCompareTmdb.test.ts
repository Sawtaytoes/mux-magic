import { access } from "node:fs/promises"
import { join } from "node:path"
import { vol } from "memfs"
import { firstValueFrom, of, toArray } from "rxjs"
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import type { MediaInfo } from "../tools/getMediaInfo.js"

// External dependencies are mocked at the module boundary so the test
// drives the real rxjs pipeline against memfs. Everything past the
// network/spawn boundary (findMatchingCut, buildMovieFeatureName,
// renameFile, moveFileToEditionFolder, getFilesAtDepth) runs for real.
vi.mock("../tools/searchDvdCompare.js", () => ({
  searchDvdCompare: vi.fn(),
}))
vi.mock("../tools/parseSpecialFeatures.js", () => ({
  parseSpecialFeatures: vi.fn(),
}))
vi.mock("../tools/canonicalizeMovieTitle.js", () => ({
  canonicalizeMovieTitle: vi.fn(),
}))
vi.mock("../tools/getMediaInfo.js", () => ({
  getMediaInfo: vi.fn(),
}))

const { searchDvdCompare } = await import(
  "../tools/searchDvdCompare.js"
)
const { parseSpecialFeatures } = await import(
  "../tools/parseSpecialFeatures.js"
)
const { canonicalizeMovieTitle } = await import(
  "../tools/canonicalizeMovieTitle.js"
)
const { getMediaInfo } = await import(
  "../tools/getMediaInfo.js"
)

const { nameMovieCutsDvdCompareTmdb } = await import(
  "./nameMovieCutsDvdCompareTmdb.js"
)

// Build a fake MediaInfo whose only `General` track carries the given
// duration in seconds — matches the shape `getFileDuration` actually
// reads from in the production path. Cast through `unknown` because
// the real MediaInfo type has many more fields than `getFileDuration`
// reads; populating all of them would just be noise for this test.
const buildFakeMediaInfo = (
  durationInSeconds: number,
): MediaInfo =>
  ({
    media: {
      track: [
        {
          "@type": "General",
          Duration: String(durationInSeconds),
        },
      ],
    },
  }) as unknown as MediaInfo

describe(nameMovieCutsDvdCompareTmdb.name, () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(searchDvdCompare).mockReturnValue(
      of({
        extras:
          "raw-extras-string-ignored-by-mocked-parser",
        filmTitle: {
          baseTitle: "Dragon Lord",
          id: 12345,
          variant: "DVD" as const,
          year: "1982",
        },
      }),
    )

    vi.mocked(parseSpecialFeatures).mockReturnValue(
      of({
        extras: [],
        cuts: [
          {
            name: "Hong Kong Version",
            timecode: "1:36:06",
          },
          { name: "Extended Version", timecode: "1:43:02" },
        ],
        possibleNames: [],
      }),
    )

    vi.mocked(canonicalizeMovieTitle).mockReturnValue(
      of({ title: "Dragon Lord", year: "1982" }),
    )

    // Each fixture's duration is set so two files match cuts and one
    // does not. `findMatchingCut` has a 15-second built-in floor for
    // movie-cut matching. Hong Kong cut is 1:36:06 (5766s) so 5770s
    // (1:36:10) is 4s past — match. Extended cut is 1:43:02 (6182s) so
    // 6180s (1:43:00) is 2s before — match. 1800s (0:30:00) is nowhere
    // near a listed cut.
    vi.mocked(getMediaInfo).mockImplementation(
      (filePath) => {
        if (filePath.includes("hong-kong"))
          return of(buildFakeMediaInfo(5770))
        if (filePath.includes("extended"))
          return of(buildFakeMediaInfo(6180))
        return of(buildFakeMediaInfo(1800))
      },
    )
  })

  test("emits rename+move events for files matching cuts and a skip event for the unmatched file", async () => {
    vol.fromJSON({
      "/rips/hong-kong.mkv": "stream-1",
      "/rips/extended.mkv": "stream-2",
      "/rips/mystery.mkv": "stream-3",
    })

    const results = await firstValueFrom(
      nameMovieCutsDvdCompareTmdb({
        sourcePath: "/rips",
        url: "https://www.dvdcompare.net/comparisons/film.php?fid=12345#1",
      }).pipe(toArray()),
    )

    const skips = results.filter(
      (result) => "skippedFilename" in result,
    )
    const renames = results.filter(
      (result) => "oldName" in result,
    )

    expect(skips).toEqual([
      {
        skippedFilename: "mystery.mkv",
        reason: "no_cut_match",
      },
    ])

    // Filenames carry the canonicalized title + year + edition tag.
    expect(
      renames.map((result) => result.newName).sort(),
    ).toEqual([
      "Dragon Lord (1982) {edition-Extended Version}.mkv",
      "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
    ])

    // Each rename's destination is the Plex edition-folder layout:
    //   <sourceParent>/<Title (Year)>/<Title (Year) {edition-<Cut>}>/<file>
    // — i.e. one level UP from /rips, not nested inside it.
    const hongKongRename = renames.find((result) =>
      result.newName.includes("Hong Kong Version"),
    )
    expect(hongKongRename?.destinationPath).toBe(
      join(
        "/",
        "Dragon Lord (1982)",
        "Dragon Lord (1982) {edition-Hong Kong Version}",
        "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
      ),
    )

    // The unmatched file is left in place on disk.
    await expect(
      access("/rips/mystery.mkv"),
    ).resolves.toBeUndefined()

    // The matched files no longer live at their original path.
    await expect(
      access("/rips/hong-kong.mkv"),
    ).rejects.toThrow()
    await expect(
      access("/rips/extended.mkv"),
    ).rejects.toThrow()
  })

  test("does not invoke renameFile or move when no cut matches — purely a logged skip", async () => {
    vol.fromJSON({
      "/rips/mystery.mkv": "stream-1",
    })

    const results = await firstValueFrom(
      nameMovieCutsDvdCompareTmdb({
        sourcePath: "/rips",
        url: "https://www.dvdcompare.net/comparisons/film.php?fid=12345#1",
      }).pipe(toArray()),
    )

    expect(results).toEqual([
      {
        skippedFilename: "mystery.mkv",
        reason: "no_cut_match",
      },
    ])
    // File is untouched on disk.
    await expect(
      access("/rips/mystery.mkv"),
    ).resolves.toBeUndefined()
  })

  test("errors when neither url, dvdCompareId, nor searchTerm is provided (mirrors resolveUrl)", async () => {
    vol.fromJSON({
      "/rips/dummy.mkv": "stream-1",
    })

    await expect(
      firstValueFrom(
        nameMovieCutsDvdCompareTmdb({
          sourcePath: "/rips",
        }).pipe(toArray()),
      ),
    ).rejects.toThrow(
      /Provide url, dvdCompareId, or searchTerm/u,
    )
  })
})
