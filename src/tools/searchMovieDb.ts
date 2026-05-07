import { from, map, type Observable } from "rxjs"

import { logAndSwallow } from "./logAndSwallow.js"

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
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w185"

const yearOf = (releaseDate: string | undefined): string => (
  // TMDB returns release_date as yyyy-mm-dd or "" — slice the year off and
  // bail to "" when missing so the rename pipeline can decide what to do
  // with a year-less film.
  typeof releaseDate === "string" && releaseDate.length >= 4
    ? releaseDate.slice(0, 4)
    : ""
)

export const mapTmdbSearchResults = (
  rawResults: MovieDbRawSearchResult[] | null | undefined,
): MovieDbResult[] => (
  (rawResults ?? [])
  .map((entry) => ({
    imageUrl: entry.poster_path ? `${TMDB_IMAGE_BASE_URL}${entry.poster_path}` : undefined,
    movieDbId: Number(entry.id ?? 0),
    overview: entry.overview,
    title: entry.title ?? "",
    year: yearOf(entry.release_date),
  }))
  .filter((result) => result.movieDbId > 0 && result.title)
)

const requireTmdbApiKey = (): string => {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    throw new Error(
      "TMDB_API_KEY is not set. Add a TMDB v4 read-access token to .env (see .env.example).",
    )
  }
  return apiKey
}

const tmdbFetch = async (
  pathAndQuery: string,
): Promise<unknown> => {
  const response = await fetch(`${TMDB_BASE_URL}${pathAndQuery}`, {
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${requireTmdbApiKey()}`,
    },
  })
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`TMDB ${response.status} ${response.statusText}: ${body}`)
  }
  return response.json()
}

export const searchMovieDb = (
  searchTerm: string,
  year?: string,
): Observable<MovieDbResult[]> => {
  // TMDB's `year` filter narrows results to films whose release_date or
  // primary_release_date matches. Critical for disambiguation: a search
  // for "Soldier" without a year returns the top-popularity film, which
  // may not be the user's intended era — adding year=1998 lifts the
  // 1998 entry to the top.
  const yearParam = year ? `&year=${encodeURIComponent(year)}` : ""
  return (
    from(
      tmdbFetch(
        `/search/movie?query=${encodeURIComponent(searchTerm)}&include_adult=false&language=en-US&page=1${yearParam}`,
      ),
    )
    .pipe(
      map((body) => mapTmdbSearchResults((body as { results?: MovieDbRawSearchResult[] }).results)),
      logAndSwallow(searchMovieDb),
    )
  )
}

export const lookupMovieDbById = (
  movieDbId: number,
): Observable<{ name: string } | null> => (
  from(
    tmdbFetch(`/movie/${movieDbId}?language=en-US`),
  )
  .pipe(
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
    logAndSwallow(lookupMovieDbById),
  )
)
