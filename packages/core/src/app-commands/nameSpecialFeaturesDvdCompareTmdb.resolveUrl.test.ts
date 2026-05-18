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
}))

vi.mock("../tools/getUserSearchInput.js", () => ({
  getUserSearchInput: vi.fn(),
}))

const { findDvdCompareResults } = await import(
  "../tools/searchDvdCompare.js"
)
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
  })

  test("builds the canonical film-page URL from a dvdCompareId + default release hash of 1", async () => {
    const result = await firstValueFrom(
      resolveUrl({ dvdCompareId: 1234 }),
    )
    expect(result).toBe(
      "https://www.dvdcompare.net/comparisons/film.php?fid=1234#1",
    )
  })

  test("uses the provided dvdCompareReleaseHash when picking the URL fragment", async () => {
    const result = await firstValueFrom(
      resolveUrl({
        dvdCompareId: 1234,
        dvdCompareReleaseHash: 5,
      }),
    )
    expect(result).toBe(
      "https://www.dvdcompare.net/comparisons/film.php?fid=1234#5",
    )
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
