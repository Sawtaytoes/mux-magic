import { basename } from "node:path"
import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import {
  concatMap,
  map,
  mergeMap,
  type Observable,
  of,
  tap,
} from "rxjs"
import {
  canonicalizeMovieTitle,
  type MovieIdentity,
} from "../tools/canonicalizeMovieTitle.js"
import {
  convertDurationToDvdCompareTimecode,
  getFileDuration,
} from "../tools/getFileDuration.js"
import { getMediaInfo } from "../tools/getMediaInfo.js"
import type { TimecodeDeviation } from "../tools/getSpecialFeatureFromTimecode.js"
import { parseSpecialFeatures } from "../tools/parseSpecialFeatures.js"
import { searchDvdCompare } from "../tools/searchDvdCompare.js"
import type { NameMovieCutsResult } from "./nameMovieCutsDvdCompareTmdb.events.js"
import { moveFileToEditionFolder } from "./nameSpecialFeaturesDvdCompareTmdb.editions.js"
import { buildMovieFeatureName } from "./nameSpecialFeaturesDvdCompareTmdb.filename.js"
import { resolveUrl } from "./nameSpecialFeaturesDvdCompareTmdb.resolveUrl.js"
import { findMatchingCut } from "./nameSpecialFeaturesDvdCompareTmdb.timecode.js"

// Narrow movie-cuts sibling of `nameSpecialFeaturesDvdCompareTmdb`.
// Inputs: a folder of main-feature movie rips (e.g. Movie.mkv,
// Movie.Directors.Cut.mkv) and a DVDCompare release reference. For each
// file we time-match against the release's listed cuts, rename to
// `<Title> (<Year>) {edition-<CutName>}.<ext>`, then move into the Plex
// edition-folder layout via the shared `moveFileToEditionFolder` helper.
// Files whose duration matches no listed cut emit a `skippedFilename`
// event — never renamed with a guess. Special-features, unnamed-file
// fallbacks, duplicate-prompt flows, and on-disk-collision interactivity
// are intentionally absent: the existing NSF command (and workers 25/26/
// 27 that improve it) own those.
export const nameMovieCutsDvdCompareTmdb = ({
  dvdCompareId,
  dvdCompareReleaseHash,
  fixedOffset,
  searchTerm,
  sourcePath,
  timecodePaddingAmount,
  url,
}: {
  dvdCompareId?: number
  dvdCompareReleaseHash?: number
  searchTerm?: string
  sourcePath: string
  url?: string
} & TimecodeDeviation): Observable<NameMovieCutsResult> => {
  const deviation: TimecodeDeviation = {
    fixedOffset,
    timecodePaddingAmount,
  }

  return resolveUrl({
    dvdCompareId,
    dvdCompareReleaseHash,
    searchTerm,
    url,
  }).pipe(
    tap(() => logInfo("LOADING", "DVDCompare page")),
    concatMap((resolvedUrl) =>
      searchDvdCompare({ url: resolvedUrl }),
    ),
    concatMap((scrape) =>
      parseSpecialFeatures(scrape.extras).pipe(
        tap(({ cuts }) =>
          logInfo("PARSED CUTS", String(cuts.length)),
        ),
        mergeMap(({ cuts }) =>
          (scrape.filmTitle
            ? canonicalizeMovieTitle({
                dvdCompareBaseTitle:
                  scrape.filmTitle.baseTitle,
                dvdCompareYear: scrape.filmTitle.year,
              })
            : of<MovieIdentity>({ title: "", year: "" })
          ).pipe(map((movie) => ({ cuts, movie }))),
        ),
      ),
    ),
    concatMap(({ cuts, movie }) =>
      // depth: 0 → only the immediate folder, no recursion. Movie cuts
      // live in a single source dir; recursion would catch unrelated
      // files in sibling Movies/<title>/<file> trees.
      getFilesAtDepth({ depth: 0, sourcePath }).pipe(
        // Sequential per file (concurrency=1) so the mediainfo spawn
        // and rename ops don't race; the file count is small (typically
        // 2–5 cuts) so this is fast enough.
        concatMap((fileInfo) =>
          getMediaInfo(fileInfo.fullPath).pipe(
            mergeMap((mediaInfo) =>
              getFileDuration({ mediaInfo }),
            ),
            map((durationInSeconds) =>
              convertDurationToDvdCompareTimecode(
                durationInSeconds,
              ),
            ),
            tap((timecode) =>
              logInfo(
                "TIMECODE",
                fileInfo.filename,
                timecode,
              ),
            ),
            concatMap(
              (
                timecode,
              ): Observable<NameMovieCutsResult> => {
                // `fileInfo.filename` is the basename WITHOUT extension
                // (it goes through `getLastItemInFilePath`'s `basename(_,
                // extname)` strip). For event emission we want the full
                // on-disk name including the extension — that's the
                // string a human sees in their file explorer.
                const originalFilename = basename(
                  fileInfo.fullPath,
                )
                const matchedCut = findMatchingCut(
                  cuts,
                  timecode,
                  deviation,
                )
                if (matchedCut == null) {
                  return of<NameMovieCutsResult>({
                    skippedFilename: originalFilename,
                    reason: "no_cut_match",
                  })
                }
                const renamedBaseName =
                  buildMovieFeatureName(
                    movie,
                    matchedCut.name,
                  )
                return fileInfo
                  .renameFile(renamedBaseName)
                  .pipe(
                    concatMap(
                      ({
                        newPath,
                      }): Observable<NameMovieCutsResult> =>
                        moveFileToEditionFolder(
                          newPath,
                          movie,
                        ).pipe(
                          map(
                            (
                              destinationPath,
                            ): NameMovieCutsResult => ({
                              oldName: originalFilename,
                              newName: basename(newPath),
                              destinationPath:
                                destinationPath ?? newPath,
                            }),
                          ),
                        ),
                    ),
                  )
              },
            ),
          ),
        ),
      ),
    ),
    logAndRethrowPipelineError(nameMovieCutsDvdCompareTmdb),
  )
}
