import {
  catchError,
  defaultIfEmpty,
  map,
  type Observable,
  of,
} from "rxjs"

import { searchMovieDb } from "./searchMovieDb.js"

export type MovieIdentity = {
  title: string
  year: string
}

// DVDCompare titles often include foreign-language and re-release aliases
// joined with " AKA ", e.g.
//   "Dragon Lord AKA Long xiao ye AKA Dragon Strike AKA Young Master in Love"
// TMDB indexes by the primary release title only, so trim the aliases off
// the first occurrence of " AKA " before searching.
const stripAkaAliases = (title: string): string =>
  title.split(/\s+AKA\s+/iu)[0].trim()

// Looks the DVDCompare-derived title up on TMDB and returns the canonical
// title + release year of the first match. Falls back to the (alias-stripped)
// DVDCompare title and the parsed year when TMDB returns nothing or
// can't be reached — the caller still gets a usable name to render with.
export const canonicalizeMovieTitle = ({
  dvdCompareBaseTitle,
  dvdCompareYear,
}: {
  dvdCompareBaseTitle: string
  dvdCompareYear: string
}): Observable<MovieIdentity> => {
  const cleanedTitle = stripAkaAliases(dvdCompareBaseTitle)
  const fallback: MovieIdentity = {
    title: cleanedTitle,
    year: dvdCompareYear,
  }

  if (!cleanedTitle) {
    return of(fallback)
  }

  return searchMovieDb(
    cleanedTitle,
    dvdCompareYear || undefined,
  ).pipe(
    map((results) => {
      const top = results[0]
      if (!top) return fallback
      return {
        title: top.title,
        // Prefer TMDB's year; fall back to DVDCompare's when TMDB has
        // no release date on file (rare but happens for early prints).
        year: top.year || dvdCompareYear,
      }
    }),
    catchError(() => of(fallback)),
    // searchMovieDb wraps its inner pipe with `logAndSwallowPipelineError` which
    // returns EMPTY on error (no emission, just complete). That
    // bypasses the catchError above — so without defaultIfEmpty,
    // a TMDB error would silently complete this stream with zero
    // emissions, and the downstream `concatMap` in nameSpecialFeatures
    // would never see a movie identity. The whole rename pipeline
    // would then no-op without surfacing why. defaultIfEmpty
    // guarantees we always emit at least the fallback.
    defaultIfEmpty(fallback),
  )
}
