import { logAndSwallowPipelineError } from "@mux-magic/tools"
import { from, map, type Observable } from "rxjs"
import { buildSharedCachedFetch } from "./sharedProviderFetchers.js"

// Public-facing shape for builder UI + nameMovies app-command consumption.
// Year is the four-digit release year extracted from TMDB's release_date
// (yyyy-mm-dd); blank when TMDB has no release date on file.
export type MovieDbResult = {
  movieDbId: number
  title: string
  year: string
  imageUrl?: string
  overview?: string
}

// Subset of TMDB's /search/movie response item — only the fields we read.
// Defined locally so mapTmdbSearchResults can be unit-tested with synthetic
// inputs without depending on a generated OpenAPI client.
export type MovieDbRawSearchResult = {
  id?: number
  title?: string
  release_date?: string
  poster_path?: string | null
  overview?: string
}

export type MovieDbRawDetail = {
  id?: number
  title?: string
  release_date?: string
}

const TMDB_BASE_URL = "https://api.themoviedb.org/3"
const TMDB_IMAGE_BASE_URL =
  "https://image.tmdb.org/t/p/w185"

const yearOf = (releaseDate: string | undefined) =>
  // TMDB returns release_date as yyyy-mm-dd or "" — slice the year off and
  // bail to "" when missing so the rename pipeline can decide what to do
  // with a year-less film.
  typeof releaseDate === "string" && releaseDate.length >= 4
    ? releaseDate.slice(0, 4)
    : ""

export const mapTmdbSearchResults = (
  rawResults: MovieDbRawSearchResult[] | null | undefined,
): MovieDbResult[] =>
  (rawResults ?? [])
    .map((entry) => ({
      imageUrl: entry.poster_path
        ? `${TMDB_IMAGE_BASE_URL}${entry.poster_path}`
        : undefined,
      movieDbId: Number(entry.id ?? 0),
      overview: entry.overview,
      title: entry.title ?? "",
      year: yearOf(entry.release_date),
    }))
    .filter(
      (result) => result.movieDbId > 0 && result.title,
    )

const requireTmdbApiKey = () => {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    throw new Error(
      "TMDB_API_KEY is not set. Add a TMDB v4 read-access token to .env (see .env.example).",
    )
  }
  return apiKey
}

// 10-second timeout, now enforced by the provider cache's own per-request
// bound. Without one, a stalled TMDB connection (rate-limit, TLS hang,
// packet loss) hangs fetch indefinitely — and since
// `logAndSwallowPipelineError` downstream only catches errors, the whole
// observable chain (e.g. `canonicalizeMovieTitle` in
// `nameSpecialFeaturesDvdCompareTmdb`) freezes silently with no terminal
// SSE "done" event. Timing out turns the hang into an error: the cached
// answer stands in if there is one, and otherwise the error is swallowed
// and the chain proceeds with the DVDCompare-derived fallback identity.
export const TMDB_FETCH_TIMEOUT_MS = 10_000

// TMDB's documented ceiling is around 50 requests per second; a lookup
// pass makes a handful, so this only keeps a burst polite.
const TMDB_MINIMUM_REQUEST_INTERVAL_MILLISECONDS = 250

// Network-first through `provider-cache.sqlite` under `movieDb`. The
// Authorization header is not part of the cache key — the URL is the
// request — so a rotated token still finds the stored answers.
const movieDbCachedFetch = buildSharedCachedFetch({
  minimumRequestIntervalMilliseconds:
    TMDB_MINIMUM_REQUEST_INTERVAL_MILLISECONDS,
  provider: "movieDb",
  timeoutMilliseconds: TMDB_FETCH_TIMEOUT_MS,
})

const tmdbFetch = (pathAndQuery: string) =>
  Promise.resolve()
    .then(() => requireTmdbApiKey())
    .then((apiKey) =>
      movieDbCachedFetch(
        `${TMDB_BASE_URL}${pathAndQuery}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
        },
      ),
    )
    .then(({ body }) => JSON.parse(body) as unknown)

export const searchMovieDb = (
  searchTerm: string,
  year?: string,
): Observable<MovieDbResult[]> => {
  // TMDB's `year` filter narrows results to films whose release_date or
  // primary_release_date matches. Critical for disambiguation: a search
  // for "Soldier" without a year returns the top-popularity film, which
  // may not be the user's intended era — adding year=1998 lifts the
  // 1998 entry to the top.
  const yearParam = year
    ? `&year=${encodeURIComponent(year)}`
    : ""
  return from(
    tmdbFetch(
      `/search/movie?query=${encodeURIComponent(searchTerm)}&include_adult=false&language=en-US&page=1${yearParam}`,
    ),
  ).pipe(
    map((body) =>
      mapTmdbSearchResults(
        (body as { results?: MovieDbRawSearchResult[] })
          .results,
      ),
    ),
    logAndSwallowPipelineError(searchMovieDb),
  )
}

export const lookupMovieDbById = (
  movieDbId: number,
): Observable<{ name: string } | null> =>
  from(
    tmdbFetch(`/movie/${movieDbId}?language=en-US`),
  ).pipe(
    map((body) => {
      const detail = body as MovieDbRawDetail
      const title = detail.title ?? ""
      const year = yearOf(detail.release_date)
      if (!title) return null
      // Match the nameAnimeEpisodes / nameTvShowEpisodes companion-name
      // contract: a single string the builder can show next to the ID.
      // The downstream nameMovies command does its own lookup for the
      // structured { title, year } pair it uses to build the filename.
      return { name: year ? `${title} (${year})` : title }
    }),
    logAndSwallowPipelineError(lookupMovieDbById),
  )
