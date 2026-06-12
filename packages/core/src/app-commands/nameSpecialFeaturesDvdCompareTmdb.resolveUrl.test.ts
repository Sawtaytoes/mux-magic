import { firstValueFrom, of } from "rxjs"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

vi.mock("../tools/searchDvdCompare.js", () => ({
  findDvdCompareResults: vi.fn(),
  displayDvdCompareVariant: vi.fn(
    (variant: string) => variant,
  ),
  getReleaseHashesByDvdCompareId: vi.fn(),
}))

vi.mock("../tools/getUserSearchInput.js", () => ({
  getUserSearchInput: vi.fn(),
}))

const {
  findDvdCompareResults,
  getReleaseHashesByDvdCompareId,
} = await import("../tools/searchDvdCompare.js")
const { getUserSearchInput } = await import(
  "../tools/getUserSearchInput.js"
)

const { resolveUrl } = await import(
  "./nameSpecialFeaturesDvdCompareTmdb.resolveUrl.js"
)

describe(resolveUrl.name, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("returns the URL verbatim when one is provided", async () => {
    const result = await firstValueFrom(
      resolveUrl({
        url: "https://www.dvdcompare.net/comparisons/film.php?fid=55539#1",
      }),
    )
    expect(result).toBe(
      "https://www.dvdcompare.net/comparisons/film.php?fid=55539#1",
    )
    // Should not have invoked any search-resolving paths.
    expect(findDvdCompareResults).not.toHaveBeenCalled()
    expect(
      getReleaseHashesByDvdCompareId,
    ).not.toHaveBeenCalled()
  })

  test("fetches the release list when only dvdCompareId is provided (no hash pinned) and auto-selects the single result", async () => {
    vi.mocked(
      getReleaseHashesByDvdCompareId,
    ).mockReturnValue(
      of([
        {
          hash: "1",
          label: "Blu-ray ALL America - Arrow Films [2026]",
        },
      ]),
    )

    const result = await firstValueFrom(
      resolveUrl({ dvdCompareId: 1234 }),
    )
    expect(result).toBe(
      "https://www.dvdcompare.net/comparisons/film.php?fid=1234#1",
    )
    expect(
      getReleaseHashesByDvdCompareId,
    ).toHaveBeenCalledWith(1234)
    expect(getUserSearchInput).not.toHaveBeenCalled()
  })

  test("uses the provided dvdCompareReleaseHash directly without fetching the release list", async () => {
    const result = await firstValueFrom(
      resolveUrl({
        dvdCompareId: 1234,
        dvdCompareReleaseHash: 5,
      }),
    )
    expect(result).toBe(
      "https://www.dvdcompare.net/comparisons/film.php?fid=1234#5",
    )
    expect(
      getReleaseHashesByDvdCompareId,
    ).not.toHaveBeenCalled()
  })

  test("auto-selects the direct-listing result when search redirects straight to a film page", async () => {
    vi.mocked(findDvdCompareResults).mockReturnValue(
      of({
        isDirectListing: true,
        results: [
          {
            id: 7777,
            baseTitle: "Dragon Lord",
            variant: "DVD",
            year: "1982",
          },
        ],
      }),
    )
    const result = await firstValueFrom(
      resolveUrl({ searchTerm: "Dragon Lord" }),
    )
    expect(result).toBe(
      "https://www.dvdcompare.net/comparisons/film.php?fid=7777#1",
    )
    // Direct-listing path should NOT prompt the user.
    expect(getUserSearchInput).not.toHaveBeenCalled()
    expect(
      getReleaseHashesByDvdCompareId,
    ).not.toHaveBeenCalled()
  })

  test("throws when the search returns zero results", async () => {
    vi.mocked(findDvdCompareResults).mockReturnValue(
      of({ isDirectListing: false, results: [] }),
    )
    await expect(
      firstValueFrom(
        resolveUrl({ searchTerm: "Nonexistent Title" }),
      ),
    ).rejects.toThrow(/No DVDCompare results found/)
  })

  test("errors when given no input at all (no url, no id, no searchTerm)", async () => {
    await expect(
      firstValueFrom(resolveUrl({})),
    ).rejects.toThrow(
      /Provide url, dvdCompareId, or searchTerm/,
    )
  })
})
