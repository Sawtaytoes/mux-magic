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
import type { NameSpecialFeaturesResult } from "./nameSpecialFeaturesDvdCompareTmdb.events.js"

// Regression guard for docs/audits/nsf-unnamed-rerun-regression.md.
//
// Before Worker 25, unmatched files stayed in `sourcePath`, so a re-run
// re-enumerated them and re-offered Smart Match. Worker 25 moved them
// into `UNNAMED-FEATURES/` and skipped that folder on re-run, so a
// second run found nothing and the Smart Match modal never opened. The
// read-back half (scan the bucket back into the summary) was never built.
//
// This test asserts the read-back: a run against a `sourcePath` whose
// only files live in `UNNAMED-FEATURES/` must surface those files in the
// summary's `unnamedFileCandidates` (and `unrenamedFilenames`) so the
// modal repopulates and auto-opens.
vi.mock("../tools/searchDvdCompare.js", () => ({
  searchDvdCompare: vi.fn(),
}))
vi.mock("../tools/parseSpecialFeatures.js", async () => {
  const actual = await vi.importActual<
    typeof import("../tools/parseSpecialFeatures.js")
  >("../tools/parseSpecialFeatures.js")
  return { ...actual, parseSpecialFeatures: vi.fn() }
})
vi.mock("../tools/getMediaInfo.js", () => ({
  getMediaInfo: vi.fn(),
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
const { nameSpecialFeaturesDvdCompareTmdb } = await import(
  "./nameSpecialFeaturesDvdCompareTmdb.js"
)

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

const findSummary = (
  results: NameSpecialFeaturesResult[],
) =>
  results.find(
    (
      result,
    ): result is Extract<
      NameSpecialFeaturesResult,
      { unrenamedFilenames: string[] }
    > => "unrenamedFilenames" in result,
  )

describe("NSF bucket read-back on re-run", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vol.reset()

    vi.mocked(searchDvdCompare).mockReturnValue(
      of({
        extras: "raw-extras-ignored-by-mocked-parser",
        // filmTitle null → canonicalizeMovieTitle (TMDB) is skipped.
        filmTitle: null,
      }),
    )
    vi.mocked(parseSpecialFeatures).mockReturnValue(
      of({
        extras: [
          {
            text: "Audio Commentary",
            timecode: undefined,
            type: "unknown" as const,
            parentType: "unknown" as const,
            children: [],
          },
        ],
        cuts: [],
        possibleNames: [
          { name: "Audio Commentary" },
          { name: "Behind the Scenes" },
        ],
      }),
    )
    // Any file resolves to a duration — exact value irrelevant here.
    vi.mocked(getMediaInfo).mockReturnValue(
      of(buildFakeMediaInfo(600)),
    )
  })

  test("surfaces files already in UNNAMED-FEATURES/ when sourcePath has no loose files", async () => {
    // The regression scenario: no loose files at top level; the leftovers
    // from a prior run sit inside the bucket.
    vol.fromJSON({
      "/rips/Movie - Blu-ray/UNNAMED-FEATURES/title_t01.mkv":
        "stream-1",
      "/rips/Movie - Blu-ray/UNNAMED-FEATURES/title_t02.mkv":
        "stream-2",
    })

    const results = await firstValueFrom(
      nameSpecialFeaturesDvdCompareTmdb({
        sourcePath: "/rips/Movie - Blu-ray",
        url: "https://www.dvdcompare.net/comparisons/film.php?fid=12345#1",
        isNonInteractive: true,
      }).pipe(toArray()),
    )

    const summary = findSummary(results)
    expect(summary).toBeDefined()
    expect(summary?.unrenamedFilenames.sort()).toEqual([
      "title_t01",
      "title_t02",
    ])
    expect(
      summary?.unnamedFileCandidates
        ?.map((candidate) => candidate.filename)
        .sort(),
    ).toEqual(["title_t01", "title_t02"])
    // Extension recovered so the modal can rebuild the on-disk path.
    expect(
      summary?.unnamedFileCandidates?.every(
        (candidate) => candidate.extension === ".mkv",
      ),
    ).toBe(true)
  })

  test("empty/absent UNNAMED-FEATURES/ leaves the summary unaffected", async () => {
    // Top level has no loose files and no bucket — only an unrelated
    // subfolder (depth-0 enumeration ignores it).
    vol.fromJSON({
      "/rips/Movie - Blu-ray/OTHER/ignore.mkv": "x",
    })

    const results = await firstValueFrom(
      nameSpecialFeaturesDvdCompareTmdb({
        sourcePath: "/rips/Movie - Blu-ray",
        url: "https://www.dvdcompare.net/comparisons/film.php?fid=12345#1",
        isNonInteractive: true,
      }).pipe(toArray()),
    )

    const summary = findSummary(results)
    expect(summary?.unrenamedFilenames).toEqual([])
    expect(summary?.unnamedFileCandidates).toBeUndefined()
  })
})
