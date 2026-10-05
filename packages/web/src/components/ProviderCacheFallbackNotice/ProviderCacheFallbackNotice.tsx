import { Alert, type AlertSize } from "@charcuterie/ui"
import type { ProviderCacheFallback } from "@mux-magic/api/api-types"

// The provider keys are the server's cache table names; these are the
// names a person knows the sites by. An unknown key shows as itself.
const PROVIDER_LABELS: Record<string, string> = {
  acoustId: "AcoustID",
  aniDb: "AniDB",
  animeOfflineDatabase: "anime-offline-database",
  animeThemes: "AnimeThemes",
  coverArtArchive: "Cover Art Archive",
  criterionForum: "Criterion Forum",
  discogs: "Discogs",
  dvdCompare: "DVDCompare",
  freedbCddb: "FreeDB",
  itunes: "iTunes",
  jikan: "Jikan (MyAnimeList)",
  movieDb: "TMDB",
  musicBrainz: "MusicBrainz",
  myAnimeList: "MyAnimeList",
  tvdb: "TheTVDB",
  vgmdbCddb: "VGMdb",
}

// Past this many, the list names the count of the rest instead: a run
// that lost MusicBrainz can fall back on dozens of releases, and the
// point of the notice is that it happened, not a full inventory — the
// job log keeps every line.
const MAXIMUM_DETAIL_LINES = 6

const millisecondsPerMinute = 60 * 1000
const millisecondsPerHour = 60 * millisecondsPerMinute
const millisecondsPerDay = 24 * millisecondsPerHour

const pluralize = ({
  count,
  unit,
}: {
  count: number
  unit: string
}) => `${count} ${unit}${count === 1 ? "" : "s"}`

export const formatCacheAge = (ageMilliseconds: number) =>
  ageMilliseconds >= millisecondsPerDay
    ? pluralize({
        count: Math.floor(
          ageMilliseconds / millisecondsPerDay,
        ),
        unit: "day",
      })
    : ageMilliseconds >= millisecondsPerHour
      ? pluralize({
          count: Math.floor(
            ageMilliseconds / millisecondsPerHour,
          ),
          unit: "hour",
        })
      : pluralize({
          count: Math.max(
            1,
            Math.floor(
              ageMilliseconds / millisecondsPerMinute,
            ),
          ),
          unit: "minute",
        })

export const getProviderLabel = (provider: string) =>
  PROVIDER_LABELS[provider] ?? provider

const describeFallback = (
  fallback: ProviderCacheFallback,
) =>
  `${getProviderLabel(fallback.provider)}: ${fallback.request} — cached ${formatCacheAge(fallback.ageMilliseconds)} ago (${fallback.cachedAt.slice(0, 10)}). ${
    fallback.isProviderSkipped
      ? "Not requested, because this provider already failed earlier in the run."
      : `The request failed: ${fallback.cause}`
  }`

const listProviderLabels = (
  fallbacks: readonly ProviderCacheFallback[],
) =>
  Array.from(
    new Set(
      fallbacks.map(({ provider }) =>
        getProviderLabel(provider),
      ),
    ),
  ).join(", ")

const buildDetails = (
  fallbacks: readonly ProviderCacheFallback[],
  context: "run" | "lookup",
) =>
  fallbacks
    .slice(0, MAXIMUM_DETAIL_LINES)
    .map(describeFallback)
    .concat(
      fallbacks.length > MAXIMUM_DETAIL_LINES
        ? [
            context === "run"
              ? `${fallbacks.length - MAXIMUM_DETAIL_LINES} more — the job log lists each one.`
              : `${fallbacks.length - MAXIMUM_DETAIL_LINES} more cached answers.`,
          ]
        : [],
    )

type ProviderCacheFallbackNoticeProps = {
  className?: string
  fallbacks: readonly ProviderCacheFallback[]
  context?: "run" | "lookup"
  size?: AlertSize
}

// Shown on a job, and in the run modal, when a provider could not answer
// and the result was built from a cached copy. Network-first means this
// is the exception; when it happens the values may be out of date, and
// the owner wants to know before he trusts a rename.
export const ProviderCacheFallbackNotice = ({
  className,
  fallbacks,
  context = "run",
  size = "sm",
}: ProviderCacheFallbackNoticeProps) =>
  fallbacks.length === 0 ? null : (
    <Alert
      className={className}
      data-testid="provider-cache-fallback-notice"
      description={`${pluralize({ count: fallbacks.length, unit: "answer" })} from ${listProviderLabels(fallbacks)} came from the cache, not the live site. Check the result before you rely on it.`}
      details={buildDetails(fallbacks, context)}
      heading={`This ${context} used cached provider data.`}
      intent="warning"
      label="Cached provider data"
      size={size}
    />
  )
