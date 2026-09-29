import type { ProviderCacheFallback } from "@mux-magic/api/api-types"
import type { Meta, StoryObj } from "@storybook/react"
import { ProviderCacheFallbackNotice } from "./ProviderCacheFallbackNotice"

// Fixed fixture data only — no `Date.now()`, so the visual regression
// run renders the same text every time.
const DVDCOMPARE_FALLBACK: ProviderCacheFallback = {
  ageMilliseconds: 3 * 24 * 60 * 60 * 1000,
  cachedAt: "2026-09-26T12:00:00.000Z",
  cause:
    "dvdCompare request timed out after 20000 ms for https://www.dvdcompare.net/comparisons/film.php?fid=12345",
  isProviderSkipped: false,
  provider: "dvdCompare",
  request:
    "https://www.dvdcompare.net/comparisons/film.php?fid=12345",
}

const DVDCOMPARE_SKIPPED_FALLBACK: ProviderCacheFallback = {
  ageMilliseconds: 3 * 24 * 60 * 60 * 1000,
  cachedAt: "2026-09-26T12:00:05.000Z",
  cause: "fetch failed",
  isProviderSkipped: true,
  provider: "dvdCompare",
  request: "scrape|film.php?fid=12345#1",
}

const TMDB_FALLBACK: ProviderCacheFallback = {
  ageMilliseconds: 5 * 60 * 60 * 1000,
  cachedAt: "2026-09-29T07:00:00.000Z",
  cause: "fetch failed",
  isProviderSkipped: false,
  provider: "movieDb",
  request:
    "https://api.themoviedb.org/3/search/movie?query=Example%20Film&include_adult=false&language=en-US&page=1&year=1998",
}

const MUSICBRAINZ_FALLBACKS: ProviderCacheFallback[] =
  Array.from({ length: 9 }, (_unused, index) => ({
    ageMilliseconds: 40 * 60 * 1000,
    cachedAt: "2026-09-29T11:20:00.000Z",
    cause: "musicBrainz request failed with status 503",
    isProviderSkipped: index > 0,
    provider: "musicBrainz",
    request: `https://musicbrainz.org/ws/2/release/00000000-0000-0000-0000-00000000000${index}`,
  }))

const meta: Meta<typeof ProviderCacheFallbackNotice> = {
  title: "Components/ProviderCacheFallbackNotice",
  component: ProviderCacheFallbackNotice,
  parameters: {
    layout: "padded",
  },
}

export default meta
type Story = StoryObj<typeof ProviderCacheFallbackNotice>

export const OneProviderFailed: Story = {
  args: { fallbacks: [DVDCOMPARE_FALLBACK] },
}

export const ProviderSkippedAfterFailure: Story = {
  args: {
    fallbacks: [
      DVDCOMPARE_FALLBACK,
      DVDCOMPARE_SKIPPED_FALLBACK,
      TMDB_FALLBACK,
    ],
  },
}

export const ManyFallbacks: Story = {
  args: { fallbacks: MUSICBRAINZ_FALLBACKS },
}

export const NoFallbacks: Story = {
  args: { fallbacks: [] },
}
