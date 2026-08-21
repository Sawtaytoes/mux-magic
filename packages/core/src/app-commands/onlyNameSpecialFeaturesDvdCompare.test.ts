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
// Only `parseSpecialFeatures` is stubbed. The command also imports
// `dedupePossibleNames` / `flattenExtrasAsPossibleNames` from this module
// to build its summary trailer — a bare factory would leave those
// undefined and the pipeline would throw, so spread the real module.
vi.mock(
  "../tools/parseSpecialFeatures.js",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../tools/parseSpecialFeatures.js")
    >()),
    parseSpecialFeatures: vi.fn(),
  }),
)
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

    // Not renamed — but not left loose either. Smart Match builds its
    // rename oldPath against UNNAMED-FEATURES/, so the file has to be
    // there or Apply fails ENOENT.
    await expect(
      access("/rips/mystery.mkv"),
    ).rejects.toThrow()
    await expect(
      access("/rips/UNNAMED-FEATURES/mystery.mkv"),
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
    // Unmatched file routed to the bucket rather than left loose.
    await expect(
      access("/rips/unknown.mkv"),
    ).rejects.toThrow()
    await expect(
      access("/rips/UNNAMED-FEATURES/unknown.mkv"),
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

  test("summary trailer lists unrenamed files with ranked DVDCompare candidates", async () => {
    vol.fromJSON({
      "/rips/trailer.mkv": "stream-1",
      "/rips/unknown.mkv": "stream-2",
    })

    vi.mocked(getMediaInfo).mockImplementation((filePath) =>
      of(
        buildFakeMediaInfo(
          filePath.includes("trailer") ? 154 : 3600,
        ),
      ),
    )

    const results = await firstValueFrom(
      onlyNameSpecialFeaturesDvdCompare({
        sourcePath: "/rips",
        url: "https://www.dvdcompare.net/comparisons/film.php?fid=12345#1",
      }).pipe(toArray()),
    )

    const summary = results.find(
      (result) => "unrenamedFilenames" in result,
    )

    expect(summary).toBeDefined()
    expect(summary).toMatchObject({
      unrenamedFilenames: ["unknown"],
    })
  })

  test("summary trailer carries the extension so Smart Match can rebuild the on-disk path", async () => {
    vol.fromJSON({
      "/rips/unknown.mp4": "stream-1",
    })

    vi.mocked(getMediaInfo).mockReturnValue(
      of(buildFakeMediaInfo(3600)),
    )

    const results = await firstValueFrom(
      onlyNameSpecialFeaturesDvdCompare({
        sourcePath: "/rips",
        url: "https://www.dvdcompare.net/comparisons/film.php?fid=12345#1",
      }).pipe(toArray()),
    )

    const summary = results.find(
      (result) => "unnamedFileCandidates" in result,
    )

    expect(summary).toMatchObject({
      unnamedFileCandidates: [
        {
          durationSeconds: 3600,
          extension: ".mp4",
          filename: "unknown",
        },
      ],
    })
  })

  test("summary trailer offers every published extra as a candidate, including out-of-tolerance timed ones", async () => {
    vol.fromJSON({
      "/rips/unknown.mkv": "stream-1",
    })

    vi.mocked(getMediaInfo).mockReturnValue(
      of(buildFakeMediaInfo(3600)),
    )

    const results = await firstValueFrom(
      onlyNameSpecialFeaturesDvdCompare({
        sourcePath: "/rips",
        url: "https://www.dvdcompare.net/comparisons/film.php?fid=12345#1",
      }).pipe(toArray()),
    )

    const summary = results.find(
      (result) => "possibleNames" in result,
    )
    const candidateNames =
      summary && "possibleNames" in summary
        ? summary.possibleNames.map((entry) => entry.name)
        : []

    // Both fixture extras carry timecodes the strict matcher rejected —
    // they still belong in the Smart Match pool.
    expect(candidateNames).toEqual(
      expect.arrayContaining([
        "Theatrical Trailer",
        "Making of the Film",
      ]),
    )
  })

  test("summary trailer is empty-but-present when every file was renamed", async () => {
    vol.fromJSON({
      "/rips/trailer.mkv": "stream-1",
    })

    vi.mocked(getMediaInfo).mockReturnValue(
      of(buildFakeMediaInfo(154)),
    )

    const results = await firstValueFrom(
      onlyNameSpecialFeaturesDvdCompare({
        sourcePath: "/rips",
        url: "https://www.dvdcompare.net/comparisons/film.php?fid=12345#1",
      }).pipe(toArray()),
    )

    const summary = results.find(
      (result) => "unrenamedFilenames" in result,
    )

    // Present so the UI can render "Renamed 1. Files not renamed: 0.",
    // but with nothing for the ✨ Fix Unnamed button to act on — the
    // button gates on a non-empty candidate list.
    expect(summary).toMatchObject({
      possibleNames: [],
      unnamedFileCandidates: [],
      unrenamedFilenames: [],
    })
  })

  test("summary trailer is emitted last, after every rename and skip event", async () => {
    vol.fromJSON({
      "/rips/trailer.mkv": "stream-1",
      "/rips/unknown.mkv": "stream-2",
    })

    vi.mocked(getMediaInfo).mockImplementation((filePath) =>
      of(
        buildFakeMediaInfo(
          filePath.includes("trailer") ? 154 : 3600,
        ),
      ),
    )

    const results = await firstValueFrom(
      onlyNameSpecialFeaturesDvdCompare({
        sourcePath: "/rips",
        url: "https://www.dvdcompare.net/comparisons/film.php?fid=12345#1",
      }).pipe(toArray()),
    )

    const summaryIndex = results.findIndex(
      (result) => "unrenamedFilenames" in result,
    )

    // The web reads the trailer once the job is done; emitting it early
    // would mean a summary that predates the renames it summarizes.
    expect(summaryIndex).toBe(results.length - 1)
  })

  test("a fully-matched run leaves no bucket folder behind", async () => {
    vol.fromJSON({
      "/rips/trailer.mkv": "stream-1",
    })

    vi.mocked(getMediaInfo).mockReturnValue(
      of(buildFakeMediaInfo(154)),
    )

    await firstValueFrom(
      onlyNameSpecialFeaturesDvdCompare({
        sourcePath: "/rips",
        url: "https://www.dvdcompare.net/comparisons/film.php?fid=12345#1",
      }).pipe(toArray()),
    )

    // The bucket is created lazily, so a clean run should not litter the
    // disc folder with an empty UNNAMED-FEATURES/.
    await expect(
      access("/rips/UNNAMED-FEATURES"),
    ).rejects.toThrow()
  })

  test("a prior run's bucketed files are read back into the summary", async () => {
    vol.fromJSON({
      "/rips/trailer.mkv": "stream-1",
      "/rips/UNNAMED-FEATURES/leftover-from-before.mkv":
        "stream-old",
    })

    vi.mocked(getMediaInfo).mockImplementation((filePath) =>
      of(
        buildFakeMediaInfo(
          filePath.includes("trailer") ? 154 : 777,
        ),
      ),
    )

    const results = await firstValueFrom(
      onlyNameSpecialFeaturesDvdCompare({
        sourcePath: "/rips",
        url: "https://www.dvdcompare.net/comparisons/film.php?fid=12345#1",
      }).pipe(toArray()),
    )

    const summary = results.find(
      (result) => "unrenamedFilenames" in result,
    )

    // Without the read-back the file would vanish from the report on a
    // re-run — the top-level enumeration never recurses into the bucket —
    // and Smart Match would never reopen on it.
    expect(summary).toMatchObject({
      unrenamedFilenames: ["leftover-from-before"],
    })
  })

  test("bucketed files are read back without being renamed or re-bucketed", async () => {
    vol.fromJSON({
      "/rips/UNNAMED-FEATURES/leftover-from-before.mkv":
        "stream-old",
    })

    vi.mocked(getMediaInfo).mockReturnValue(
      of(buildFakeMediaInfo(777)),
    )

    await firstValueFrom(
      onlyNameSpecialFeaturesDvdCompare({
        sourcePath: "/rips",
        url: "https://www.dvdcompare.net/comparisons/film.php?fid=12345#1",
      }).pipe(toArray()),
    )

    // Surface-only: the read-back reports, it does not move.
    await expect(
      access(
        "/rips/UNNAMED-FEATURES/leftover-from-before.mkv",
      ),
    ).resolves.toBeUndefined()
    await expect(
      access(
        "/rips/UNNAMED-FEATURES/UNNAMED-FEATURES/leftover-from-before.mkv",
      ),
    ).rejects.toThrow()
  })

  test("duplicate-prompt losers are bucketed and reported, not left loose", async () => {
    vol.fromJSON({
      "/rips/fileA.mkv": "stream-1",
      "/rips/fileB.mkv": "stream-2",
    })

    // Both files match the same extra timecode; the prompt keeps fileA.
    vi.mocked(getMediaInfo).mockReturnValue(
      of(buildFakeMediaInfo(154)),
    )
    vi.mocked(getUserSearchInput).mockReturnValue(of(0))

    const results = await firstValueFrom(
      onlyNameSpecialFeaturesDvdCompare({
        sourcePath: "/rips",
        url: "https://www.dvdcompare.net/comparisons/film.php?fid=12345#1",
        isAutoNamingDuplicates: false,
      }).pipe(toArray()),
    )

    const summary = results.find(
      (result) => "unrenamedFilenames" in result,
    )

    // The dropped duplicate used to stay loose in sourcePath with no
    // summary entry at all — the only way to find it was to browse the
    // disc folder.
    expect(summary).toMatchObject({
      unrenamedFilenames: ["fileB"],
    })
    await expect(
      access("/rips/UNNAMED-FEATURES/fileB.mkv"),
    ).resolves.toBeUndefined()
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
