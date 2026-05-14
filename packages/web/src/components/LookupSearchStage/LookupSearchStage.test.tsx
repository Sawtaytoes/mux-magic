import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import type { LookupState } from "../LookupModal/types"
import { LookupSearchStage } from "./LookupSearchStage"

const setParamMock = vi.fn()
vi.mock("../../hooks/useBuilderActions", () => ({
  useBuilderActions: () => ({ setParam: setParamMock }),
}))

const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = vi.fn()
  setParamMock.mockClear()
})

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
  vi.clearAllMocks()
})

const baseState: LookupState = {
  lookupType: "dvdcompare",
  stepId: "step-1",
  fieldName: "dvdCompareId",
  companionNameField: "dvdCompareName",
  stage: "search",
  searchTerm: "Soldier",
  searchError: null,
  results: null,
  formatFilter: "Blu-ray 4K",
  selectedGroup: null,
  selectedVariant: null,
  selectedFid: null,
  releases: null,
  releasesDebug: null,
  releasesError: null,
  isLoading: false,
}

const mockResponse = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
  }) as Response

describe("LookupSearchStage — DVDCompare flow", () => {
  test("clicking a movie with multiple variants + Blu-ray 4K filter goes straight to 'release' (NEVER 'variant')", async () => {
    // Soldier (1998) on DVDCompare has 3 fids: DVD (235), Blu-ray 4K
    // (74759), Blu-ray (35486). groupDvdCompareResults collapses them
    // into one group. With Format=Blu-ray 4K, clicking the row must
    // pick the matching variant and go straight to releases.
    // The legacy bug pushed users through a redundant disc-type picker;
    // this test guards against that regression.
    const soldierGroup = {
      baseTitle: "Soldier",
      year: "1998",
      variants: [
        { id: "235", variant: "DVD" },
        { id: "74759", variant: "Blu-ray 4K" },
        { id: "35486", variant: "Blu-ray" },
      ],
    }
    const stateWithResults: LookupState = {
      ...baseState,
      results: [
        soldierGroup,
      ] as unknown as LookupState["results"],
    }
    const onUpdate = vi.fn()
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      mockResponse({
        releases: [
          {
            hash: "1",
            label:
              "Blu-ray ALL America - Arrow Films - Limited Edition [2026]",
          },
          {
            hash: "2",
            label:
              "Blu-ray ALL Canada - Arrow Films - Limited Edition [2026]",
          },
          {
            hash: "3",
            label:
              "Blu-ray ALL United Kingdom - Arrow Films - Limited Edition [2026]",
          },
        ],
        error: null,
      }),
    )

    render(
      <LookupSearchStage
        state={stateWithResults}
        onUpdate={onUpdate}
        onClose={() => {}}
      />,
    )

    fireEvent.click(screen.getByText("Soldier (1998)"))

    // Must transition to "release" and never to "variant".
    await waitFor(() => {
      const stages = onUpdate.mock.calls.map(
        ([patch]) => (patch as Partial<LookupState>).stage,
      )
      expect(stages).toContain("release")
      expect(stages).not.toContain("variant")
    })

    // Must use the Blu-ray 4K variant (fid=74759).
    const stageCall = onUpdate.mock.calls.find(
      ([patch]) =>
        (patch as Partial<LookupState>).stage === "release",
    )
    if (!stageCall) {
      throw new Error(
        "Expected an onUpdate call with stage='release'",
      )
    }
    const releasePatch =
      stageCall[0] as Partial<LookupState>
    expect(releasePatch.selectedFid).toBe("74759")
    expect(releasePatch.selectedVariant).toBe("Blu-ray 4K")

    // fetchReleases must be called with the numeric fid in the POST body.
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const [url, init] = vi.mocked(globalThis.fetch).mock
      .calls[0]
    expect(String(url)).toContain(
      "/queries/listDvdCompareReleases",
    )
    const sentBody = JSON.parse(
      (init?.body as string) ?? "{}",
    ) as { dvdCompareId: unknown }
    expect(sentBody.dvdCompareId).toBe(74759)
    expect(typeof sentBody.dvdCompareId).toBe("number")
  })

  test("never writes an object into the numeric fieldName (avoids '[object Object]')", async () => {
    // The non-dvdcompare branch (mal/anidb/tvdb/tmdb) previously called
    // setParam(stepId, fieldName, { id, name }) — but the field stores
    // a plain number, so React rendered the object as "[object Object]".
    const stateWithResults: LookupState = {
      ...baseState,
      lookupType: "mal",
      fieldName: "malId",
      companionNameField: "malName",
      formatFilter: "all",
      results: [
        { malId: 12345, name: "Neon Genesis Evangelion" },
      ] as unknown as LookupState["results"],
    }

    render(
      <LookupSearchStage
        state={stateWithResults}
        onUpdate={vi.fn()}
        onClose={() => {}}
      />,
    )

    fireEvent.click(
      screen.getByText("Neon Genesis Evangelion"),
    )

    await waitFor(() =>
      expect(setParamMock).toHaveBeenCalled(),
    )
    for (const call of setParamMock.mock.calls) {
      const value = call[2]
      expect(
        typeof value === "object" && value !== null,
      ).toBe(false)
    }
  })

  test("single-result search auto-loads releases even when isDirectListing is missing (covers 'solider' → 1-result page that didn't HTTP-redirect)", async () => {
    // DVDCompare sometimes returns a search-results page with exactly
    // one row instead of a 302 to film.php. The server then returns
    // isDirectListing:undefined and results:[oneRecord]. With a
    // format filter active (default Blu-ray 4K), the old code filtered
    // that one record out and showed "No results." Now the UI must
    // treat any single-result dvdcompare response as a direct hit.
    const onUpdate = vi.fn()
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        mockResponse({
          // No isDirectListing flag set — server didn't see a redirect.
          results: [
            {
              baseTitle: "Tinker Tailor Solider Spy",
              id: 55420,
              variant: "Blu-ray",
              year: "1979",
            },
          ],
          error: null,
        }),
      )
      .mockResolvedValueOnce(
        mockResponse({ releases: [], error: null }),
      )

    render(
      <LookupSearchStage
        state={{
          ...baseState,
          searchTerm: "solider",
          formatFilter: "Blu-ray 4K",
        }}
        onUpdate={onUpdate}
        onClose={() => {}}
      />,
    )

    fireEvent.click(screen.getByText("Search"))

    // Must transition to release stage with fid=55420 and call the
    // releases endpoint — not show "No results."
    await waitFor(() => {
      const stages = onUpdate.mock.calls.map(
        ([patch]) => (patch as Partial<LookupState>).stage,
      )
      expect(stages).toContain("release")
    })
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    const releasesCall = vi.mocked(globalThis.fetch).mock
      .calls[1]
    const body = JSON.parse(
      (releasesCall[1]?.body as string) ?? "{}",
    ) as { dvdCompareId: unknown }
    expect(body.dvdCompareId).toBe(55420)
  })

  test("isDirectListing response auto-loads releases without showing search results", async () => {
    // Server detects search.php redirected to a single film page (e.g.
    // 'solider' misspelling → fid=55420 'Tinker Tailor Solider Spy
    // (Blu-ray) (1979)'). The web client must skip the picker and load
    // releases for that film directly — ignoring formatFilter, since the
    // direct hit is canonical.
    const onUpdate = vi.fn()
    // First call: /queries/searchDvdCompare returns isDirectListing=true
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        mockResponse({
          isDirectListing: true,
          results: [
            {
              baseTitle: "Tinker Tailor Solider Spy",
              id: 55420,
              variant: "Blu-ray",
              year: "1979",
            },
          ],
          error: null,
        }),
      )
      // Second call: /queries/listDvdCompareReleases for fid 55420
      .mockResolvedValueOnce(
        mockResponse({
          releases: [
            {
              hash: "1",
              label:
                "Blu-ray ALL United Kingdom - Acorn Media",
            },
            {
              hash: "2",
              label:
                "Blu-ray ALL United States - Acorn Media",
            },
          ],
          error: null,
        }),
      )

    render(
      <LookupSearchStage
        state={baseState}
        onUpdate={onUpdate}
        onClose={() => {}}
      />,
    )

    fireEvent.click(screen.getByText("Search"))

    await waitFor(() => {
      const stages = onUpdate.mock.calls.map(
        ([patch]) => (patch as Partial<LookupState>).stage,
      )
      expect(stages).toContain("release")
    })

    // Two fetch calls: search, then releases — never variant in between.
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    const releaseCall = vi.mocked(globalThis.fetch).mock
      .calls[1]
    const body = JSON.parse(
      (releaseCall[1]?.body as string) ?? "{}",
    ) as { dvdCompareId: unknown }
    expect(body.dvdCompareId).toBe(55420)
  })
})
