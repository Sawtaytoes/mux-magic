import type { ProviderCacheFallback } from "@mux-magic/api/api-types"
import {
  cleanup,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, test } from "vitest"
import {
  formatCacheAge,
  ProviderCacheFallbackNotice,
} from "./ProviderCacheFallbackNotice"

afterEach(() => {
  cleanup()
})

const buildFallback = (
  overrides: Partial<ProviderCacheFallback> = {},
): ProviderCacheFallback => ({
  ageMilliseconds: 3 * 24 * 60 * 60 * 1000,
  cachedAt: "2026-09-26T12:00:00.000Z",
  cause: "fetch failed",
  isProviderSkipped: false,
  provider: "dvdCompare",
  request:
    "https://www.dvdcompare.net/comparisons/film.php?fid=12345",
  ...overrides,
})

describe("ProviderCacheFallbackNotice", () => {
  test("renders nothing when the job used no cached data", () => {
    const { container } = render(
      <ProviderCacheFallbackNotice fallbacks={[]} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  test("is a named region with the provider, the request, the age and the cause", () => {
    render(
      <ProviderCacheFallbackNotice
        fallbacks={[buildFallback()]}
      />,
    )

    const notice = screen.getByRole("region", {
      name: "Cached provider data",
    })
    expect(
      within(notice).getByText(
        "This run used cached provider data.",
      ),
    ).toBeInTheDocument()
    expect(
      within(notice).getByText(
        "DVDCompare: https://www.dvdcompare.net/comparisons/film.php?fid=12345 — cached 3 days ago (2026-09-26). The request failed: fetch failed",
      ),
    ).toBeInTheDocument()
    expect(
      within(notice).getByText(/1 answer from DVDCompare/),
    ).toBeInTheDocument()
  })

  test("says when a provider was not asked because it already failed in this run", () => {
    render(
      <ProviderCacheFallbackNotice
        fallbacks={[
          buildFallback({ isProviderSkipped: true }),
        ]}
      />,
    )

    expect(
      screen.getByText(
        /Not requested, because this provider already failed earlier in the run\./,
      ),
    ).toBeInTheDocument()
  })

  test("names each provider once, and counts the lines past six", () => {
    render(
      <ProviderCacheFallbackNotice
        fallbacks={Array.from(
          { length: 8 },
          (_unused, index) =>
            buildFallback({
              provider:
                index === 0 ? "movieDb" : "dvdCompare",
              request: `request ${index}`,
            }),
        )}
      />,
    )

    expect(
      screen.getByText(
        /8 answers from TMDB, DVDCompare came/,
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(7)
    expect(
      screen.getByText(
        "2 more — the job log lists each one.",
      ),
    ).toBeInTheDocument()
  })
})

describe(formatCacheAge.name, () => {
  test("uses the largest whole unit", () => {
    expect(formatCacheAge(30 * 1000)).toBe("1 minute")
    expect(formatCacheAge(5 * 60 * 1000)).toBe("5 minutes")
    expect(formatCacheAge(60 * 60 * 1000)).toBe("1 hour")
    expect(formatCacheAge(49 * 60 * 60 * 1000)).toBe(
      "2 days",
    )
  })
})
