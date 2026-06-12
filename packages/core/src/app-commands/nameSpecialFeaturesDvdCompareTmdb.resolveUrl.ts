import { logInfo } from "@mux-magic/tools"
import {
  map,
  type Observable,
  of,
  switchMap,
  tap,
  throwError,
} from "rxjs"
import { getUserSearchInput } from "../tools/getUserSearchInput.js"
import {
  displayDvdCompareVariant,
  findDvdCompareResults,
  getReleaseHashesByDvdCompareId,
} from "../tools/searchDvdCompare.js"

export const DVDCOMPARE_FILM_BASE =
  "https://www.dvdcompare.net/comparisons/film.php?fid="

export const resolveUrl = ({
  dvdCompareId,
  dvdCompareReleaseHash,
  isNonInteractive = false,
  searchTerm,
  url,
}: {
  dvdCompareId?: number
  dvdCompareReleaseHash?: number
  isNonInteractive?: boolean
  searchTerm?: string
  url?: string
}): Observable<string> => {
  if (url) {
    return of(url)
  }

  // Release hash already pinned — build the URL directly, no network needed.
  if (
    dvdCompareId != null &&
    dvdCompareReleaseHash != null
  ) {
    return of(
      `${DVDCOMPARE_FILM_BASE}${dvdCompareId}#${dvdCompareReleaseHash}`,
    )
  }

  // dvdCompareId set but no hash pinned: fetch the release list for this film
  // and let the user choose (or auto-select if there is only one). This skips
  // the movie-search / TMDB-disambiguation stage entirely.
  if (dvdCompareId != null) {
    return getReleaseHashesByDvdCompareId(
      dvdCompareId,
    ).pipe(
      switchMap((releases) => {
        if (releases.length === 0) {
          return throwError(
            () =>
              new Error(
                `No releases found for DVDCompare film id ${dvdCompareId}.`,
              ),
          )
        }

        if (releases.length === 1) {
          const release = releases[0]
          if (release == null) {
            return throwError(
              () =>
                new Error(
                  "DVDCompare returned no releases.",
                ),
            )
          }
          logInfo(
            "DVDCOMPARE SINGLE RELEASE",
            `Auto-selecting the only release (hash=${release.hash}) for fid=${dvdCompareId}.`,
          )
          return of(
            `${DVDCOMPARE_FILM_BASE}${dvdCompareId}#${release.hash}`,
          )
        }

        // Multiple releases — non-interactive runs cannot prompt.
        if (isNonInteractive) {
          return throwError(
            () =>
              new Error(
                `Multiple releases found for DVDCompare film id ${dvdCompareId}; set dvdCompareReleaseHash to select one.`,
              ),
          )
        }

        return getUserSearchInput({
          message: `Release packages for DVDCompare film id ${dvdCompareId}:`,
          options: releases.map((release, index) => ({
            index,
            label: release.label,
          })),
        }).pipe(
          map((selectedIndex) =>
            releases.at(selectedIndex),
          ),
          tap((release) => {
            if (!release) {
              throw new Error("No release selected.")
            }
          }),
          map(
            (release) =>
              `${DVDCOMPARE_FILM_BASE}${dvdCompareId}#${release?.hash}`,
          ),
        )
      }),
    )
  }

  if (searchTerm) {
    return findDvdCompareResults(searchTerm).pipe(
      switchMap(({ isDirectListing, results }) => {
        if (results.length === 0) {
          throw new Error(
            `No DVDCompare results found for: ${searchTerm}`,
          )
        }

        // DVDCompare redirected straight to the film page — no picker
        // needed. Auto-select the lone result and build the URL directly.
        if (isDirectListing) {
          const result = results[0]
          if (result == null) {
            throw new Error(
              "DVDCompare returned no results.",
            )
          }
          logInfo(
            "DVDCOMPARE DIRECT LISTING",
            `Search landed on a film page directly (fid=${result.id}). Auto-selecting listing ID; use dvdCompareReleaseHash to choose a release.`,
          )
          return of(`${DVDCOMPARE_FILM_BASE}${result.id}#1`)
        }

        return getUserSearchInput({
          message: `Search results for "${searchTerm}":`,
          options: [
            ...results.map((result, index) => ({
              index,
              label: `${result.baseTitle}${result.variant !== "DVD" ? ` (${displayDvdCompareVariant(result.variant)})` : ""}${result.year ? ` (${result.year})` : ""}`,
            })),
            {
              index: -1,
              label: "Cancel / skip",
            },
          ],
        }).pipe(
          map((selectedIndex) => {
            if (selectedIndex === -1) {
              return undefined
            }

            return results.at(selectedIndex)
          }),
          tap((result) => {
            if (!result) {
              throw new Error("No result selected.")
            }
          }),
          map(
            (result) =>
              `${DVDCOMPARE_FILM_BASE}${result?.id}#1`,
          ),
        )
      }),
    )
  }

  return throwError(
    () =>
      new Error(
        "Provide url, dvdCompareId, or searchTerm.",
      ),
  )
}
