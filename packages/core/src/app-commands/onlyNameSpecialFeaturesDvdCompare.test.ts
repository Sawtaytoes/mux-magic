import { access } from "node:fs/promises"
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

// External I/O mocked at the module boundary. The real rxjs pipeline,
// getSpecialFeatureFromTimecode, reorderForDuplicatePrompts, and
// renameFile run against memfs so filesystem assertions work.
vi.mock("../tools/searchDvdCompare.js", () => ({
  searchDvdCompare: vi.fn(),
}))
vi.mock("../tools/parseSpecialFeatures.js", () => ({
  parseSpecialFeatures: vi.fn(),
}))
vi.mock("../tools/getMediaInfo.js", () => ({
  getMediaInfo: vi.fn(),
}))
// Mock getUserSearchInput so tests run without an interactive prompt.
vi.mock("../tools/getUserSearchInput.js", () => ({
  getUserSearchInput: vi.fn(),
}))

const { searchDvdCompare } = await import(
  "../tools/searchDvdCompare.js"
)
const { parseSpecialFeatures } = await import(
  "../tools/parseSpecialFeatures.js"
)
const { getMediaInfo } = await import(
  "../tools/getMediaInfo.js"
)
const { getUserSearchInput } = await import(
  "../tools/getUserSearchInput.js"
)

const { onlyNameSpecialFeaturesDvdCompare } = await import(
  "./onlyNameSpecialFeaturesDvdCompare.js"
)

// Build a minimal MediaInfo whose General track carries the given duration
// in seconds — sufficient for `getFileDuration`.
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

describe(onlyNameSpecialFeaturesDvdCompare.name, () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(searchDvdCompare).mockReturnValue(
      of({
        extras:
          "raw-extras-string-ignored-by-mocked-parser",
        // No filmTitle — this command doesn't use TMDB.
        filmTitle: null,
      }),
    )

    vi.mocked(parseSpecialFeatures).mockReturnValue(
      of({
        extras: [
          {
            text: "Theatrical Trailer",
            timecode: "2:34",
            type: "trailer" as const,
            parentType: "unknown" as const,
            children: [],
          },
          {
            text: "Making of the Film",
            timecode: "15:10",
            type: "featurette" as const,
            parentType: "unknown" as const,
            children: [],
          },
        ],
        cuts: [],
        possibleNames: [],
      }),
    )
  })

  test("matched file renames to <base>-<plex-suffix>.<ext>", async () => {
    vol.fromJSON({
      "/rips/feature.mkv": "stream-1",
    })

    // feature.mkv duration is 2:34 (154s) — matches "Theatrical Trailer"
    vi.mocked(getMediaInfo).mockReturnValue(
      of(buildFakeMediaInfo(154)),
    )

    const results = await firstValueFrom(
      onlyNameSpecialFeaturesDvdCompare({
        sourcePath: "/rips",
        url: "https://www.dvdcompare.net/comparisons/film.php?fid=12345#1",
      }).pipe(toArray()),
    )

    const renames = results.filter(
      (result) => "oldName" in result,
    )

    expect(renames).toHaveLength(1)
    expect(renames[0]).toMatchObject({
      oldName: "feature",
      newName: "Theatrical Trailer -trailer",
    })
  })

  test("unmatched file emits skippedFilename event", async () => {
    vol.fromJSON({
      "/rips/mystery.mkv": "stream-1",
    })

    // mystery.mkv duration 600s — matches no listed extra (2:34 or 15:10
    // with default 2s padding window).
    vi.mocked(getMediaInfo).mockReturnValue(
      of(buildFakeMediaInfo(600)),
    )

    const results = await firstValueFrom(
      onlyNameSpecialFeaturesDvdCompare({
        sourcePath: "/rips",
        url: "https://www.dvdcompare.net/comparisons/film.php?fid=12345#1",
      }).pipe(toArray()),
    )

    const skips = results.filter(
      (result) => "skippedFilename" in result,
    )

    expect(skips).toEqual([
      {
        skippedFilename: "mystery",
        reason: "no_extra_match",
      },
    ])

    // File is untouched on disk.
    await expect(
      access("/rips/mystery.mkv"),
    ).resolves.toBeUndefined()
  })

  test("integration: 3 files — 2 matched + 1 unmatched → 2 renames + 1 skip", async () => {
    vol.fromJSON({
      "/rips/trailer.mkv": "stream-1",
      "/rips/making-of.mkv": "stream-2",
      "/rips/unknown.mkv": "stream-3",
    })

    vi.mocked(getMediaInfo).mockImplementation(
      (filePath) => {
        if (filePath.includes("trailer"))
          return of(buildFakeMediaInfo(154)) // 2:34 → matches "Theatrical Trailer"
        if (filePath.includes("making-of"))
          return of(buildFakeMediaInfo(910)) // 15:10 → matches "Making of the Film"
        return of(buildFakeMediaInfo(3600)) // 1:00:00 → no match
      },
    )

    const results = await firstValueFrom(
      onlyNameSpecialFeaturesDvdCompare({
        sourcePath: "/rips",
        url: "https://www.dvdcompare.net/comparisons/film.php?fid=12345#1",
      }).pipe(toArray()),
    )

    const renames = results.filter(
      (result) => "oldName" in result,
    )
    const skips = results.filter(
      (result) => "skippedFilename" in result,
    )

    expect(renames).toHaveLength(2)
    expect(skips).toHaveLength(1)
    expect(skips[0]).toMatchObject({
      reason: "no_extra_match",
    })

    // Renamed files no longer at original paths.
    await expect(
      access("/rips/trailer.mkv"),
    ).rejects.toThrow()
    await expect(
      access("/rips/making-of.mkv"),
    ).rejects.toThrow()
    // Unmatched file left alone.
    await expect(
      access("/rips/unknown.mkv"),
    ).resolves.toBeUndefined()
  })

  test("duplicate target names trigger shared duplicate-handling prompt", async () => {
    vol.fromJSON({
      "/rips/fileA.mkv": "stream-1",
      "/rips/fileB.mkv": "stream-2",
    })

    // Both files match the same extra timecode.
    vi.mocked(getMediaInfo).mockReturnValue(
      of(buildFakeMediaInfo(154)),
    )
    // getUserSearchInput (from reorderForDuplicatePrompts) returns index 0
    // — fileA is chosen as the real match; fileB is dropped from renames
    // (treated as if skipped). This verifies the prompt fires.
    vi.mocked(getUserSearchInput).mockReturnValue(of(0))

    const results = await firstValueFrom(
      onlyNameSpecialFeaturesDvdCompare({
        sourcePath: "/rips",
        url: "https://www.dvdcompare.net/comparisons/film.php?fid=12345#1",
        isAutoNamingDuplicates: false,
      }).pipe(toArray()),
    )

    // One file gets the un-suffixed name; the other was dropped by the
    // prompt (user explicitly chose fileA as the real match).
    const renames = results.filter(
      (result) => "oldName" in result,
    )
    expect(renames).toHaveLength(1)
    const newNames = renames.map((result) =>
      "newName" in result ? result.newName : "",
    )
    expect(newNames).toContain(
      "Theatrical Trailer -trailer",
    )
  })

  test("Zod schema rejects requests with no DVD Compare identifier", async () => {
    const {
      onlyNameSpecialFeaturesDvdCompareRequestSchema,
    } = await import(
      "./onlyNameSpecialFeaturesDvdCompare.js"
    )

    const result =
      onlyNameSpecialFeaturesDvdCompareRequestSchema.safeParse(
        {
          sourcePath: "/rips",
          // No dvdCompareId, url, or searchTerm
        },
      )

    expect(result.success).toBe(false)
  })

  test("errors when neither url, dvdCompareId, nor searchTerm is provided", async () => {
    vol.fromJSON({ "/rips/dummy.mkv": "stream-1" })
    vi.mocked(getMediaInfo).mockReturnValue(
      of(buildFakeMediaInfo(154)),
    )

    await expect(
      firstValueFrom(
        onlyNameSpecialFeaturesDvdCompare({
          sourcePath: "/rips",
        }).pipe(toArray()),
      ),
    ).rejects.toThrow(
      /Provide url, dvdCompareId, or searchTerm/u,
    )
  })
})
