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

describe("resolveUrl — dvdCompareId shortcut (worker 49)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── single release → auto-select, no prompt ───────────────────────────────

  test("auto-selects the sole release when dvdCompareId is set and exactly one release exists", async () => {
    vi.mocked(
      getReleaseHashesByDvdCompareId,
    ).mockReturnValue(
      of([
        { hash: "1", label: "Blu-ray ALL America [2023]" },
      ]),
    )

    const result = await firstValueFrom(
      resolveUrl({ dvdCompareId: 42 }),
    )

    expect(result).toBe(
      "https://www.dvdcompare.net/comparisons/film.php?fid=42#1",
    )
    // Must NOT prompt the user for a single release.
    expect(getUserSearchInput).not.toHaveBeenCalled()
    // Must NOT call the movie-search stage.
    expect(findDvdCompareResults).not.toHaveBeenCalled()
  })

  // ── multiple releases → single getUserSearchInput prompt ─────────────────

  test("fires one getUserSearchInput prompt when dvdCompareId is set and multiple releases exist", async () => {
    vi.mocked(
      getReleaseHashesByDvdCompareId,
    ).mockReturnValue(
      of([
        { hash: "1", label: "Blu-ray ALL America [2026]" },
        { hash: "2", label: "Blu-ray ALL Canada [2026]" },
        { hash: "3", label: "Blu-ray ALL UK [2026]" },
      ]),
    )
    vi.mocked(getUserSearchInput).mockReturnValue(of(1))

    const result = await firstValueFrom(
      resolveUrl({ dvdCompareId: 99 }),
    )

    expect(result).toBe(
      "https://www.dvdcompare.net/comparisons/film.php?fid=99#2",
    )
    // Exactly one prompt fired; no movie-search invoked.
    expect(getUserSearchInput).toHaveBeenCalledTimes(1)
    expect(findDvdCompareResults).not.toHaveBeenCalled()
  })

  // ── dvdCompareReleaseHash already set → no prompt, no fetch ───────────────

  test("skips getReleaseHashesByDvdCompareId when dvdCompareReleaseHash is already set", async () => {
    const result = await firstValueFrom(
      resolveUrl({
        dvdCompareId: 55,
        dvdCompareReleaseHash: 3,
      }),
    )

    expect(result).toBe(
      "https://www.dvdcompare.net/comparisons/film.php?fid=55#3",
    )
    expect(
      getReleaseHashesByDvdCompareId,
    ).not.toHaveBeenCalled()
    expect(getUserSearchInput).not.toHaveBeenCalled()
    expect(findDvdCompareResults).not.toHaveBeenCalled()
  })

  // ── zero releases → error, no silent fallback ─────────────────────────────

  test("errors when getReleaseHashesByDvdCompareId returns an empty list", async () => {
    vi.mocked(
      getReleaseHashesByDvdCompareId,
    ).mockReturnValue(of([]))

    await expect(
      firstValueFrom(resolveUrl({ dvdCompareId: 77 })),
    ).rejects.toThrow(/no releases found/i)

    expect(getUserSearchInput).not.toHaveBeenCalled()
  })

  // ── non-interactive + multiple releases → error ───────────────────────────

  test("errors in non-interactive mode when dvdCompareId is set and multiple releases exist", async () => {
    vi.mocked(
      getReleaseHashesByDvdCompareId,
    ).mockReturnValue(
      of([
        { hash: "1", label: "Release A" },
        { hash: "2", label: "Release B" },
      ]),
    )

    await expect(
      firstValueFrom(
        resolveUrl({
          dvdCompareId: 88,
          isNonInteractive: true,
        }),
      ),
    ).rejects.toThrow(/multiple releases/i)

    expect(getUserSearchInput).not.toHaveBeenCalled()
  })

  // ── back-compat: omitting dvdCompareId still walks the search flow ─────────

  test("invokes findDvdCompareResults and does NOT call getReleaseHashesByDvdCompareId when only searchTerm is given", async () => {
    vi.mocked(findDvdCompareResults).mockReturnValue(
      of({
        isDirectListing: true,
        results: [
          {
            id: 7777,
            baseTitle: "Dragon Lord",
            variant: "DVD" as const,
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
    expect(
      getReleaseHashesByDvdCompareId,
    ).not.toHaveBeenCalled()
  })
})
