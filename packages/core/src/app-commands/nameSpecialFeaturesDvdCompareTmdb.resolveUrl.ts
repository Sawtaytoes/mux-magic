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
} from "../tools/searchDvdCompare.js"

export const DVDCOMPARE_FILM_BASE =
  "https://www.dvdcompare.net/comparisons/film.php?fid="

export const resolveUrl = ({
  dvdCompareId,
  dvdCompareReleaseHash,
  searchTerm,
  url,
}: {
  dvdCompareId?: number
  dvdCompareReleaseHash?: number
  searchTerm?: string
  url?: string
}): Observable<string> => {
  if (url) return of(url)

  const hash = dvdCompareReleaseHash ?? 1

  if (dvdCompareId != null)
    return of(
      `${DVDCOMPARE_FILM_BASE}${dvdCompareId}#${hash}`,
    )

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
          if (result == null)
            throw new Error(
              "DVDCompare returned no results.",
            )
          logInfo(
            "DVDCOMPARE DIRECT LISTING",
            `Search landed on a film page directly (fid=${result.id}). Auto-selecting listing ID; use dvdCompareReleaseHash to choose a release.`,
          )
          return of(
            `${DVDCOMPARE_FILM_BASE}${result.id}#${hash}`,
          )
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
            if (selectedIndex === -1) return undefined

            return results.at(selectedIndex)
          }),
          tap((result) => {
            if (!result)
              throw new Error("No result selected.")
          }),
          map(
            (result) =>
              `${DVDCOMPARE_FILM_BASE}${result?.id}#${hash}`,
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
