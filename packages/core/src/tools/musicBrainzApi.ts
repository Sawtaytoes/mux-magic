import { logAndRethrowPipelineError } from "@mux-magic/tools"
import { from, map, type Observable } from "rxjs"

// The contract `packages/core/src/provider-cache/cachedFetch.ts` exposes.
// Declared here (rather than imported) so this module and its tests stand on
// their own: production call sites pass the provider-cache implementation,
// tests pass a stub, and nothing in this file ever needs the real one.
export type CachedFetch = (
  url: string,
  init?: RequestInit & { cacheKey?: string },
) => Promise<{ body: string; isFromCache: boolean }>

export const MUSICBRAINZ_BASE_URL =
  "https://musicbrainz.org/ws/2"

// MusicBrainz publishes a hard cap of one request per second and blocks the
// source address when a client ignores it. The address it would block is the
// household's, so this number is not a tuning knob.
export const MUSICBRAINZ_MINIMUM_REQUEST_INTERVAL_MILLISECONDS = 1_000

// Picard's `query_limit`.
export const MUSICBRAINZ_QUERY_LIMIT = 50

export const MUSICBRAINZ_FETCH_TIMEOUT_MILLISECONDS = 15_000

// `release_ars` + `track_ars` are both true in the owner's Picard config, which
// is `artist-rels` + `recording-rels` on the web service. Soundtracks carry
// their performer / composer / arranger credits in those relationships.
export const MUSICBRAINZ_RELEASE_INCLUDES = [
  "recordings",
  "artist-credits",
  "labels",
  "release-groups",
  "media",
  "artist-rels",
  "recording-rels",
  "genres",
  "tags",
]

export const DEFAULT_ARTIST_NAME_LOCALE = "en"

// Picard `genres_filter`. Without it, albums come back tagged `owned`.
export const DEFAULT_EXCLUDED_GENRES = [
  "seen live",
  "favorites",
  "fixme",
  "owned",
]

// Picard `max_genres` and `min_genre_usage`.
export const MAXIMUM_GENRE_COUNT = 5
export const MINIMUM_GENRE_USAGE_PERCENT = 90

export type MusicBrainzRawAlias = {
  name?: string
  locale?: string | null
  // eslint-disable-next-line @typescript-eslint/naming-convention -- wire field name, as MusicBrainz spells it
  primary?: boolean | null
  type?: string | null
}

export type MusicBrainzRawArtist = {
  id?: string
  name?: string
  "sort-name"?: string
  aliases?: MusicBrainzRawAlias[]
  genres?: MusicBrainzRawTag[]
  tags?: MusicBrainzRawTag[]
}

export type MusicBrainzRawArtistCredit = {
  name?: string
  joinphrase?: string
  artist?: MusicBrainzRawArtist
}

export type MusicBrainzRawTag = {
  name?: string
  count?: number
}

export type MusicBrainzRawRecording = {
  id?: string
  title?: string
  length?: number | null
  "artist-credit"?: MusicBrainzRawArtistCredit[]
}

export type MusicBrainzRawTrack = {
  id?: string
  position?: number
  number?: string
  title?: string
  length?: number | null
  recording?: MusicBrainzRawRecording
  "artist-credit"?: MusicBrainzRawArtistCredit[]
}

export type MusicBrainzRawMedium = {
  position?: number
  format?: string | null
  "track-count"?: number
  tracks?: MusicBrainzRawTrack[]
}

export type MusicBrainzRawLabelInfo = {
  "catalog-number"?: string | null
  label?: { id?: string; name?: string } | null
}

export type MusicBrainzRawReleaseGroup = {
  id?: string
  title?: string
  "primary-type"?: string | null
  "secondary-types"?: string[]
  genres?: MusicBrainzRawTag[]
  tags?: MusicBrainzRawTag[]
}

export type MusicBrainzRawRelease = {
  id?: string
  title?: string
  date?: string | null
  country?: string | null
  barcode?: string | null
  status?: string | null
  score?: number
  "track-count"?: number
  "artist-credit"?: MusicBrainzRawArtistCredit[]
  "release-group"?: MusicBrainzRawReleaseGroup | null
  "label-info"?: MusicBrainzRawLabelInfo[]
  media?: MusicBrainzRawMedium[]
  genres?: MusicBrainzRawTag[]
  tags?: MusicBrainzRawTag[]
}

export type MusicBrainzRawReleaseSearch = {
  releases?: MusicBrainzRawRelease[]
}

export type MusicBrainzArtistCreditPart = {
  artistId: string
  name: string
  joinPhrase: string
}

export type MusicBrainzTrack = {
  position: number
  title: string
  recordingId: string
  artistCredit: MusicBrainzArtistCreditPart[]
  lengthMilliseconds: number | null
}

export type MusicBrainzMedium = {
  discNumber: number
  format: string
  trackCount: number
  tracks: MusicBrainzTrack[]
}

export type MusicBrainzGenre = {
  name: string
  count: number
}

export type MusicBrainzRelease = {
  releaseId: string
  title: string
  artistCredit: MusicBrainzArtistCreditPart[]
  artistId: string
  releaseGroupId: string
  date: string
  country: string
  formats: string[]
  labels: string[]
  barcode: string
  trackCount: number
  media: MusicBrainzMedium[]
  isMultiArtist: boolean
  primaryType: string
  secondaryTypes: string[]
  genres: MusicBrainzGenre[]
  folksonomyTags: MusicBrainzGenre[]
  searchScore: number
}

const throwMissingUserAgent = (): never => {
  throw new Error(
    'MUSICBRAINZ_USER_AGENT is not set. MusicBrainz blocks clients that do not identify themselves. Add a descriptive value such as "mux-magic/1.0.0 ( https://example.com/contact )" to .env (see .env.example).',
  )
}

export const requireMusicBrainzUserAgent = () =>
  process.env.MUSICBRAINZ_USER_AGENT ||
  throwMissingUserAgent()

// A curly quote becomes its ASCII twin only when `convert_punctuation` is on.
// The owner's Picard has it OFF, so the default here leaves the text exactly as
// MusicBrainz stores it.
const PUNCTUATION_REPLACEMENTS = [
  { pattern: /[\u2018\u2019\u201B]/gu, replacement: "'" },
  { pattern: /[\u201C\u201D\u201F]/gu, replacement: '"' },
  { pattern: /[\u2013\u2014]/gu, replacement: "-" },
  { pattern: /\u2026/gu, replacement: "..." },
]

export const convertPunctuation = (text: string) =>
  PUNCTUATION_REPLACEMENTS.reduce(
    (converted, { pattern, replacement }) =>
      converted.replace(pattern, replacement),
    text,
  )

const applyPunctuationStyle = ({
  isPunctuationConverted,
  text,
}: {
  isPunctuationConverted: boolean
  text: string
}) =>
  isPunctuationConverted ? convertPunctuation(text) : text

const getLocaleAliases = ({
  aliases,
  locale,
}: {
  aliases: MusicBrainzRawAlias[] | undefined
  locale: string
}) =>
  (aliases ?? []).filter(
    (alias) =>
      typeof alias.name === "string" &&
      alias.name.length > 0 &&
      alias.locale === locale,
  )

// `translate_artist_names=true` with locale `en`: prefer the artist's English
// alias over the stored name. A primary alias wins over a non-primary one.
export const selectLocaleAlias = ({
  aliases,
  locale,
}: {
  aliases: MusicBrainzRawAlias[] | undefined
  locale: string
}) =>
  getLocaleAliases({ aliases, locale }).find(
    (alias) => alias.primary === true,
  )?.name ??
  getLocaleAliases({ aliases, locale }).at(0)?.name ??
  null

// `standardize_artists=true` — the artist's own name, not the credited-as name
// printed on this particular release.
const selectBaseArtistName = ({
  isArtistNameStandardized,
  rawCredit,
}: {
  isArtistNameStandardized: boolean
  rawCredit: MusicBrainzRawArtistCredit
}) =>
  (isArtistNameStandardized
    ? rawCredit.artist?.name
    : rawCredit.name) ||
  rawCredit.name ||
  rawCredit.artist?.name ||
  ""

export const resolveArtistName = ({
  artistNameLocale = DEFAULT_ARTIST_NAME_LOCALE,
  isArtistNameStandardized = true,
  isArtistNameTranslated = true,
  isPunctuationConverted = false,
  rawCredit,
}: {
  artistNameLocale?: string
  isArtistNameStandardized?: boolean
  isArtistNameTranslated?: boolean
  isPunctuationConverted?: boolean
  rawCredit: MusicBrainzRawArtistCredit
}) =>
  applyPunctuationStyle({
    isPunctuationConverted,
    text:
      (isArtistNameTranslated
        ? selectLocaleAlias({
            aliases: rawCredit.artist?.aliases,
            locale: artistNameLocale,
          })
        : null) ??
      selectBaseArtistName({
        isArtistNameStandardized,
        rawCredit,
      }),
  })

const mapArtistCredit = ({
  artistNameLocale,
  isArtistNameStandardized,
  isArtistNameTranslated,
  isPunctuationConverted,
  rawCredits,
}: {
  artistNameLocale: string
  isArtistNameStandardized: boolean
  isArtistNameTranslated: boolean
  isPunctuationConverted: boolean
  rawCredits: MusicBrainzRawArtistCredit[] | undefined
}) =>
  (rawCredits ?? []).map((rawCredit) => ({
    artistId: rawCredit.artist?.id ?? "",
    joinPhrase: rawCredit.joinphrase ?? "",
    name: resolveArtistName({
      artistNameLocale,
      isArtistNameStandardized,
      isArtistNameTranslated,
      isPunctuationConverted,
      rawCredit,
    }),
  }))

export const joinArtistCredit = (
  artistCredit: MusicBrainzArtistCreditPart[],
) =>
  artistCredit
    .map((part) => `${part.name}${part.joinPhrase}`)
    .join("")
    .trim()

const mapTags = (
  rawTags: MusicBrainzRawTag[] | undefined,
) =>
  (rawTags ?? [])
    .filter(
      (rawTag) =>
        typeof rawTag.name === "string" &&
        rawTag.name.length > 0,
    )
    .map((rawTag) => ({
      count: rawTag.count ?? 0,
      name: rawTag.name ?? "",
    }))

// Picard's `%_multiartist%`: set when the tracks on the release do not all
// share one artist. The naming script inserts "<track artist> - " in front of
// the title only when it is true.
export const deriveIsMultiArtist = (
  media: MusicBrainzMedium[],
) =>
  new Set(
    media
      .flatMap((medium) => medium.tracks)
      .map((track) =>
        track.artistCredit
          .map((part) => part.artistId || part.name)
          .join("\u0000"),
      )
      .filter((artistKey) => artistKey.length > 0),
  ).size > 1

type ArtistNameStyle = {
  artistNameLocale: string
  isArtistNameStandardized: boolean
  isArtistNameTranslated: boolean
  isPunctuationConverted: boolean
}

const mapTrack = ({
  artistNameStyle,
  rawRelease,
  rawTrack,
  trackIndex,
}: {
  artistNameStyle: ArtistNameStyle
  rawRelease: MusicBrainzRawRelease
  rawTrack: MusicBrainzRawTrack
  trackIndex: number
}): MusicBrainzTrack => ({
  artistCredit: mapArtistCredit({
    ...artistNameStyle,
    rawCredits:
      rawTrack["artist-credit"] ??
      rawTrack.recording?.["artist-credit"] ??
      rawRelease["artist-credit"],
  }),
  lengthMilliseconds:
    rawTrack.length ?? rawTrack.recording?.length ?? null,
  position: rawTrack.position ?? trackIndex + 1,
  recordingId: rawTrack.recording?.id ?? "",
  title: applyPunctuationStyle({
    isPunctuationConverted:
      artistNameStyle.isPunctuationConverted,
    text: rawTrack.title ?? rawTrack.recording?.title ?? "",
  }),
})

const buildMedium = ({
  mediumIndex,
  rawMedium,
  tracks,
}: {
  mediumIndex: number
  rawMedium: MusicBrainzRawMedium
  tracks: MusicBrainzTrack[]
}): MusicBrainzMedium => ({
  discNumber: rawMedium.position ?? mediumIndex + 1,
  format: rawMedium.format ?? "",
  trackCount: rawMedium["track-count"] ?? tracks.length,
  tracks,
})

const mapMedia = ({
  artistNameStyle,
  rawRelease,
}: {
  artistNameStyle: ArtistNameStyle
  rawRelease: MusicBrainzRawRelease
}) =>
  (rawRelease.media ?? []).map((rawMedium, mediumIndex) =>
    buildMedium({
      mediumIndex,
      rawMedium,
      tracks: (rawMedium.tracks ?? []).map(
        (rawTrack, trackIndex) =>
          mapTrack({
            artistNameStyle,
            rawRelease,
            rawTrack,
            trackIndex,
          }),
      ),
    }),
  )

const buildRelease = ({
  artistCredit,
  isPunctuationConverted,
  media,
  rawRelease,
}: {
  artistCredit: MusicBrainzArtistCreditPart[]
  isPunctuationConverted: boolean
  media: MusicBrainzMedium[]
  rawRelease: MusicBrainzRawRelease
}): MusicBrainzRelease => ({
  artistCredit,
  artistId: artistCredit[0]?.artistId ?? "",
  barcode: rawRelease.barcode ?? "",
  country: rawRelease.country ?? "",
  date: rawRelease.date ?? "",
  folksonomyTags: mapTags(rawRelease.tags),
  formats: media
    .map((medium) => medium.format)
    .filter((format) => format.length > 0),
  genres: mapTags(rawRelease.genres),
  isMultiArtist: deriveIsMultiArtist(media),
  labels: (rawRelease["label-info"] ?? [])
    .map((labelInfo) => labelInfo.label?.name ?? "")
    .filter((labelName) => labelName.length > 0),
  media,
  primaryType:
    rawRelease["release-group"]?.["primary-type"] ?? "",
  releaseGroupId: rawRelease["release-group"]?.id ?? "",
  releaseId: rawRelease.id ?? "",
  searchScore: rawRelease.score ?? 0,
  secondaryTypes:
    rawRelease["release-group"]?.["secondary-types"] ?? [],
  title: applyPunctuationStyle({
    isPunctuationConverted,
    text: rawRelease.title ?? "",
  }),
  trackCount:
    rawRelease["track-count"] ??
    media.reduce(
      (total, medium) => total + medium.trackCount,
      0,
    ),
})

export const mapMusicBrainzRelease = ({
  artistNameLocale = DEFAULT_ARTIST_NAME_LOCALE,
  isArtistNameStandardized = true,
  isArtistNameTranslated = true,
  isPunctuationConverted = false,
  rawRelease,
}: {
  artistNameLocale?: string
  isArtistNameStandardized?: boolean
  isArtistNameTranslated?: boolean
  isPunctuationConverted?: boolean
  rawRelease: MusicBrainzRawRelease
}) =>
  buildRelease({
    artistCredit: mapArtistCredit({
      artistNameLocale,
      isArtistNameStandardized,
      isArtistNameTranslated,
      isPunctuationConverted,
      rawCredits: rawRelease["artist-credit"],
    }),
    isPunctuationConverted,
    media: mapMedia({
      artistNameStyle: {
        artistNameLocale,
        isArtistNameStandardized,
        isArtistNameTranslated,
        isPunctuationConverted,
      },
      rawRelease,
    }),
    rawRelease,
  })

// Picard's genre pipeline, in order: release genres (falling back to the
// artist's when the release has none), plus folksonomy tags, minus the
// excluded list, minus anything used by fewer than `minimumGenreUsagePercent`
// of the top genre's votes, capped at `maximumGenreCount`. The result stays an
// array — `join_genres` is empty, so genres are a multi-value tag, never one
// joined string.
const getExcludedGenreKeys = (excludedGenres: string[]) =>
  new Set(
    excludedGenres.map((genreName) =>
      genreName.trim().toLowerCase(),
    ),
  )

const mergeGenreCounts = (genres: MusicBrainzGenre[]) =>
  genres.reduce(
    (accumulated: MusicBrainzGenre[], genre) =>
      accumulated.some(
        (existing) =>
          existing.name.toLowerCase() ===
          genre.name.toLowerCase(),
      )
        ? accumulated.map((existing) =>
            existing.name.toLowerCase() ===
            genre.name.toLowerCase()
              ? {
                  count: existing.count + genre.count,
                  name: existing.name,
                }
              : existing,
          )
        : accumulated.concat([genre]),
    [],
  )

const getHighestGenreCount = (genres: MusicBrainzGenre[]) =>
  genres.reduce(
    (highestCount, genre) =>
      Math.max(highestCount, genre.count),
    0,
  )

const filterGenresByUsage = ({
  genres,
  highestCount,
  minimumGenreUsagePercent,
}: {
  genres: MusicBrainzGenre[]
  highestCount: number
  minimumGenreUsagePercent: number
}) =>
  genres.filter(
    (genre) =>
      highestCount === 0 ||
      genre.count * 100 >=
        minimumGenreUsagePercent * highestCount,
  )

const capGenres = ({
  genres,
  maximumGenreCount,
  minimumGenreUsagePercent,
}: {
  genres: MusicBrainzGenre[]
  maximumGenreCount: number
  minimumGenreUsagePercent: number
}) =>
  filterGenresByUsage({
    genres,
    highestCount: getHighestGenreCount(genres),
    minimumGenreUsagePercent,
  })
    .toSorted(
      (firstGenre, secondGenre) =>
        secondGenre.count - firstGenre.count ||
        firstGenre.name.localeCompare(secondGenre.name),
    )
    .slice(0, maximumGenreCount)
    .map((genre) => genre.name)

export const selectGenres = ({
  artistGenres = [],
  excludedGenres = DEFAULT_EXCLUDED_GENRES,
  folksonomyTags = [],
  maximumGenreCount = MAXIMUM_GENRE_COUNT,
  minimumGenreUsagePercent = MINIMUM_GENRE_USAGE_PERCENT,
  releaseGenres = [],
}: {
  artistGenres?: MusicBrainzGenre[]
  excludedGenres?: string[]
  folksonomyTags?: MusicBrainzGenre[]
  maximumGenreCount?: number
  minimumGenreUsagePercent?: number
  releaseGenres?: MusicBrainzGenre[]
}) =>
  capGenres({
    genres: mergeGenreCounts(
      (releaseGenres.length > 0
        ? releaseGenres
        : artistGenres
      )
        .concat(folksonomyTags)
        .filter(
          (genre) =>
            genre.name.trim().length > 0 &&
            !getExcludedGenreKeys(excludedGenres).has(
              genre.name.trim().toLowerCase(),
            ),
        ),
    ),
    maximumGenreCount,
    minimumGenreUsagePercent,
  })

// Serialized through a promise chain rather than a bare timestamp check:
// concurrent callers reading the same stale timestamp would all compute
// "no wait needed" in one tick and burst past the one-request-per-second cap.
// Chaining makes each caller claim its slot after the previous one.
const musicBrainzRequestQueue = {
  chain: Promise.resolve(),
  lastRequestAtMilliseconds: 0,
}

const getWaitMilliseconds = () =>
  MUSICBRAINZ_MINIMUM_REQUEST_INTERVAL_MILLISECONDS -
  (Date.now() -
    musicBrainzRequestQueue.lastRequestAtMilliseconds)

const delayToNextSlot = () =>
  (getWaitMilliseconds() > 0
    ? new Promise<void>((resolve) => {
        setTimeout(resolve, getWaitMilliseconds())
      })
    : Promise.resolve()
  ).then(() => {
    musicBrainzRequestQueue.lastRequestAtMilliseconds =
      Date.now()
  })

// The assignment IS the expression: each caller replaces the queue's tail with
// its own link and waits on that link.
const waitForMusicBrainzSlot = () =>
  (musicBrainzRequestQueue.chain =
    musicBrainzRequestQueue.chain.then(delayToNextSlot))

// `AbortSignal.timeout` is the AbortController timeout without the bookkeeping:
// the timer is unreferenced, so it never holds the process open, and there is
// no handle to clear. Without a timeout, a stalled MusicBrainz connection hangs
// `fetch` forever and the whole observable chain freezes with no terminal event.
const toRequestError = ({
  error,
  url,
}: {
  error: unknown
  url: string
}) =>
  error instanceof Error &&
  (error.name === "TimeoutError" ||
    error.name === "AbortError")
    ? new Error(
        `MusicBrainz request timed out after ${MUSICBRAINZ_FETCH_TIMEOUT_MILLISECONDS}ms: ${url}`,
      )
    : error

const readResponseBody = ({
  body,
  response,
}: {
  body: string
  response: Response
}) =>
  response.ok
    ? body
    : Promise.reject(
        new Error(
          `MusicBrainz ${response.status} ${response.statusText}: ${body.slice(0, 200)}`,
        ),
      )

const fetchWithTimeout = ({
  init,
  url,
}: {
  init: RequestInit
  url: string
}) =>
  fetch(url, {
    ...init,
    signal: AbortSignal.timeout(
      MUSICBRAINZ_FETCH_TIMEOUT_MILLISECONDS,
    ),
  })
    .then((response) =>
      response
        .text()
        .then((body) =>
          readResponseBody({ body, response }),
        ),
    )
    .catch((error: unknown) =>
      Promise.reject(toRequestError({ error, url })),
    )

// Fallback fetcher, used only when a call site passes no `cachedFetch`. It
// honours the one-request-per-second rule and the User-Agent requirement, but
// it does NOT cache. Production call sites pass the provider-cache fetcher
// built with `createCachedFetch({ cache, provider: "musicbrainz", userAgent,
// minimumRequestIntervalMilliseconds })`, which does both.
export const rateLimitedMusicBrainzFetch: CachedFetch = (
  url,
  init,
) =>
  waitForMusicBrainzSlot()
    .then(() =>
      fetchWithTimeout({
        init: {
          ...init,
          headers: {
            Accept: "application/json",
            "User-Agent": requireMusicBrainzUserAgent(),
            ...init?.headers,
          },
        },
        url,
      }),
    )
    .then((body) => ({ body, isFromCache: false }))

// Lucene needs its own quoting; a title with a double quote in it would
// otherwise truncate the field and match nothing.
const escapeLuceneValue = (value: string) =>
  value.replace(/(["\\])/gu, "\\$1")

export const buildReleaseSearchQuery = ({
  albumName,
  artistName,
  trackCount,
}: {
  albumName?: string
  artistName?: string
  trackCount?: number
}) =>
  [
    artistName
      ? `artist:"${escapeLuceneValue(artistName)}"`
      : "",
    albumName
      ? `release:"${escapeLuceneValue(albumName)}"`
      : "",
    typeof trackCount === "number" && trackCount > 0
      ? `tracks:${trackCount}`
      : "",
  ]
    .filter((clause) => clause.length > 0)
    .join(" AND ")

const parseJsonBody = <ParsedBody>(body: string) =>
  JSON.parse(body) as ParsedBody

export const searchMusicBrainzReleases = ({
  albumName,
  artistName,
  artistNameLocale = DEFAULT_ARTIST_NAME_LOCALE,
  cachedFetch = rateLimitedMusicBrainzFetch,
  isArtistNameStandardized = true,
  isArtistNameTranslated = true,
  isPunctuationConverted = false,
  queryLimit = MUSICBRAINZ_QUERY_LIMIT,
  trackCount,
}: {
  albumName?: string
  artistName?: string
  artistNameLocale?: string
  cachedFetch?: CachedFetch
  isArtistNameStandardized?: boolean
  isArtistNameTranslated?: boolean
  isPunctuationConverted?: boolean
  queryLimit?: number
  trackCount?: number
}): Observable<MusicBrainzRelease[]> =>
  from(
    cachedFetch(
      `${MUSICBRAINZ_BASE_URL}/release?query=${encodeURIComponent(
        buildReleaseSearchQuery({
          albumName,
          artistName,
          trackCount,
        }),
      )}&limit=${queryLimit}&fmt=json`,
    ),
  ).pipe(
    map(({ body }) =>
      (
        parseJsonBody<MusicBrainzRawReleaseSearch>(body)
          .releases ?? []
      ).map((rawRelease) =>
        mapMusicBrainzRelease({
          artistNameLocale,
          isArtistNameStandardized,
          isArtistNameTranslated,
          isPunctuationConverted,
          rawRelease,
        }),
      ),
    ),
    logAndRethrowPipelineError(searchMusicBrainzReleases),
  )

export const getMusicBrainzRelease = ({
  artistNameLocale = DEFAULT_ARTIST_NAME_LOCALE,
  cachedFetch = rateLimitedMusicBrainzFetch,
  isArtistNameStandardized = true,
  isArtistNameTranslated = true,
  isPunctuationConverted = false,
  releaseId,
}: {
  artistNameLocale?: string
  cachedFetch?: CachedFetch
  isArtistNameStandardized?: boolean
  isArtistNameTranslated?: boolean
  isPunctuationConverted?: boolean
  releaseId: string
}): Observable<MusicBrainzRelease> =>
  from(
    cachedFetch(
      `${MUSICBRAINZ_BASE_URL}/release/${encodeURIComponent(
        releaseId,
      )}?inc=${MUSICBRAINZ_RELEASE_INCLUDES.join(
        "+",
      )}&fmt=json`,
    ),
  ).pipe(
    map(({ body }) =>
      mapMusicBrainzRelease({
        artistNameLocale,
        isArtistNameStandardized,
        isArtistNameTranslated,
        isPunctuationConverted,
        rawRelease:
          parseJsonBody<MusicBrainzRawRelease>(body),
      }),
    ),
    logAndRethrowPipelineError(getMusicBrainzRelease),
  )
