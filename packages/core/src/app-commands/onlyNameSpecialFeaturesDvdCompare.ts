import { access } from "node:fs/promises"
import { extname, join } from "node:path"
import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
  logWarning,
} from "@mux-magic/tools"
import {
  concat,
  concatMap,
  defaultIfEmpty,
  defer,
  EMPTY,
  map,
  mergeAll,
  mergeMap,
  Observable,
  of,
  scan,
  toArray,
} from "rxjs"
import { z } from "zod"
import {
  convertDurationToDvdCompareTimecode,
  getFileDuration,
} from "../tools/getFileDuration.js"
import { getMediaInfo } from "../tools/getMediaInfo.js"
import {
  getSpecialFeatureFromTimecode,
  type TimecodeDeviation,
} from "../tools/getSpecialFeatureFromTimecode.js"
import {
  dedupePossibleNames,
  flattenExtrasAsPossibleNames,
  parseSpecialFeatures,
} from "../tools/parseSpecialFeatures.js"
import { withFileProgress } from "../tools/progressEmitter.js"
import { searchDvdCompare } from "../tools/searchDvdCompare.js"
import { buildUnnamedFileCandidates } from "./nameSpecialFeaturesDvdCompareTmdb.buildUnnamedFileCandidates.js"
import { reorderForDuplicatePrompts } from "./nameSpecialFeaturesDvdCompareTmdb.duplicates.js"
import { flattenAllKnownNames } from "./nameSpecialFeaturesDvdCompareTmdb.flattenAllKnownNames.js"
import { reorderRenamesForOnDiskConflicts } from "./nameSpecialFeaturesDvdCompareTmdb.reorderRenamesForOnDiskConflicts.js"
import { resolveUrl } from "./nameSpecialFeaturesDvdCompareTmdb.resolveUrl.js"
import type { OnlyNameSpecialFeaturesResult } from "./onlyNameSpecialFeaturesDvdCompare.events.js"

// Zod schema with at-least-one-identifier refinement. Exported so the
// API schemas file (packages/api/src/api/schemas.ts) can re-export it,
// and so the test file can import it to verify schema validation.
export const onlyNameSpecialFeaturesDvdCompareRequestSchema =
  z
    .object({
      sourcePath: z
        .string()
        .describe(
          "Directory containing special-features files.",
        ),
      dvdCompareId: z
        .number()
        .optional()
        .describe(
          "DVDCompare film ID — when provided, constructs URL directly and bypasses search.",
        ),
      dvdCompareReleaseHash: z
        .number()
        .optional()
        .describe(
          "The hash (URL fragment #) from the DVDCompare release page denoting which release variant is selected for that film. Defaults to 1 (the first release option).",
        ),
      url: z
        .string()
        .optional()
        .describe(
          "DVDCompare.net URL including the chosen release's hash tag.",
        ),
      searchTerm: z
        .string()
        .optional()
        .describe(
          "Title to search on DVDCompare.net (used when no url or dvdCompareId).",
        ),
      timecodePadding: z
        .number()
        .default(2)
        .describe(
          "Seconds that timecodes may be off. Defaults to 2, matching typical DVDCompare-vs-rip drift. Pass 0 for exact-match-only.",
        ),
      fixedOffset: z
        .number()
        .default(0)
        .describe(
          "Timecodes are pushed positively or negatively by this amount (in seconds).",
        ),
      autoNameDuplicates: z
        .boolean()
        .default(false)
        .describe(
          "When two-or-more files match the same target name within a single run, auto-disambiguate them with (2)/(3)/… suffixes deterministically. Pass false to instead emit a duplicate-pick prompt for each ambiguous group. Defaults to false so interactive runs prompt the user.",
        ),
    })
    .refine(
      ({ dvdCompareId, url, searchTerm }) =>
        dvdCompareId != null ||
        url != null ||
        searchTerm != null,
      {
        message:
          "Provide at least one of dvdCompareId, url, or searchTerm.",
      },
    )

const getNextFilenameCount = (previousCount?: number) =>
  (previousCount ?? 0) + 1

// Non-movie variant of `nameSpecialFeaturesDvdCompareTmdb`. Takes a
// source folder and a DVD Compare release reference, then renames each
// file whose duration matches a listed special-feature timecode to
// `<existing-base>-<plex-suffix>.<ext>`. Files with no match are
// skipped with a log entry — never renamed with a guess.
//
// Unmatched files also produce a trailing summary carrying the
// DVDCompare candidate list, which is what lights up the web UI's
// ✨ Fix Unnamed (Smart Match) button for this command — same trailer
// shape as the TMDB sibling. Unlike that sibling, leftovers are NOT
// moved into an UNNAMED-FEATURES/ bucket: skip-in-place stays this
// command's filesystem behaviour, and Smart Match renames them where
// they sit.
//
// Intentionally omitted vs. the full NSF command:
//   - TMDB lookup (non-movie workflow; no canonical title needed)
//   - Edition-folder move (Plex movies-only convention)
//   - UNNAMED-FEATURES/ bucketing (leftovers stay in sourcePath)
export const onlyNameSpecialFeaturesDvdCompare = ({
  dvdCompareId,
  dvdCompareReleaseHash,
  fixedOffset,
  isAutoNamingDuplicates = false,
  searchTerm,
  sourcePath,
  timecodePaddingAmount,
  url,
}: {
  dvdCompareId?: number
  dvdCompareReleaseHash?: number
  isAutoNamingDuplicates?: boolean
  searchTerm?: string
  sourcePath: string
  url?: string
} & TimecodeDeviation): Observable<OnlyNameSpecialFeaturesResult> => {
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
    concatMap((resolvedUrl) =>
      searchDvdCompare({ url: resolvedUrl }),
    ),
    concatMap((scrape) =>
      parseSpecialFeatures(scrape.extras).pipe(
        concatMap(({ extras, possibleNames }) =>
          getFilesAtDepth({ depth: 0, sourcePath }).pipe(
            mergeMap((fileInfo) =>
              getMediaInfo(fileInfo.fullPath).pipe(
                mergeMap((mediaInfo) =>
                  getFileDuration({ mediaInfo }),
                ),
                map((duration) => ({
                  // The measured runtime the Smart Match modal shows
                  // beside each DVDCompare candidate's published
                  // timecode, and what the server-side ranker scores
                  // duration-proximity on. `getFileDuration` maps an
                  // unparseable MediaInfo Duration to NaN, which would
                  // score as a real (wildly wrong) runtime — null is the
                  // ranker's "unknown", so normalise here.
                  durationSeconds: Number.isFinite(duration)
                    ? duration
                    : null,
                  fileInfo,
                  timecode:
                    convertDurationToDvdCompareTimecode(
                      duration,
                    ),
                })),
              ),
            ),
            concatMap(
              ({
                durationSeconds,
                fileInfo,
                timecode,
              }): Observable<
                | {
                    durationSeconds: number | null
                    fileInfo: typeof fileInfo
                    renamedFilename: string
                  }
                | {
                    durationSeconds: number | null
                    fileInfo: typeof fileInfo
                    isSkipped: true
                  }
              > => {
                logInfo(
                  "TIMECODE",
                  fileInfo.filename,
                  timecode,
                )
                return getSpecialFeatureFromTimecode({
                  filename: fileInfo.filename,
                  filePath: fileInfo.fullPath,
                  fixedOffset: deviation.fixedOffset,
                  specialFeatures: extras,
                  timecode,
                  timecodePaddingAmount:
                    deviation.timecodePaddingAmount,
                }).pipe(
                  map((renamedFilename) => ({
                    durationSeconds,
                    fileInfo,
                    renamedFilename,
                  })),
                  defaultIfEmpty({
                    durationSeconds,
                    fileInfo,
                    isSkipped: true as const,
                  }),
                )
              },
            ),
            toArray(),
            concatMap((matchResults) => {
              const skipped = matchResults.filter(
                (
                  result,
                ): result is {
                  durationSeconds: number | null
                  fileInfo: (typeof matchResults)[number]["fileInfo"]
                  isSkipped: true
                } => "isSkipped" in result,
              )
              const matched = matchResults.filter(
                (
                  result,
                ): result is {
                  durationSeconds: number | null
                  fileInfo: (typeof matchResults)[number]["fileInfo"]
                  renamedFilename: string
                } => "renamedFilename" in result,
              )

              logInfo(
                "RENAMING",
                `Renaming matched files (${matched.length} of ${matchResults.length})`,
              )

              const conflictOrderedRenames =
                reorderRenamesForOnDiskConflicts(matched)

              const promptForDuplicates$ =
                isAutoNamingDuplicates
                  ? of({
                      kept: conflictOrderedRenames,
                      droppedFullPaths: [] as string[],
                    })
                  : reorderForDuplicatePrompts(
                      conflictOrderedRenames,
                    )

              return promptForDuplicates$.pipe(
                concatMap(({ kept: orderedRenames }) => {
                  const skipEvents$: Observable<
                    Observable<OnlyNameSpecialFeaturesResult>
                  > = of(
                    ...skipped.map(({ fileInfo }) =>
                      of<OnlyNameSpecialFeaturesResult>({
                        skippedFilename: fileInfo.filename,
                        reason: "no_extra_match",
                      }),
                    ),
                  )

                  const renamesStream$: Observable<
                    Observable<OnlyNameSpecialFeaturesResult>
                  > = of(...orderedRenames).pipe(
                    scan(
                      (
                        { previousFilenameCount },
                        { fileInfo, renamedFilename },
                      ) => {
                        const isIntraRunDuplicate =
                          renamedFilename in
                          previousFilenameCount
                        const finalName =
                          isIntraRunDuplicate
                            ? `(${getNextFilenameCount(previousFilenameCount[renamedFilename])}) ${renamedFilename}`
                            : renamedFilename
                        return {
                          previousFilenameCount: {
                            ...previousFilenameCount,
                            [renamedFilename]:
                              getNextFilenameCount(
                                previousFilenameCount[
                                  renamedFilename
                                ],
                              ),
                          },
                          renameFileObservable: defer(
                            async () => {
                              const ext = extname(
                                fileInfo.fullPath,
                              )
                              const desiredPath = join(
                                sourcePath,
                                finalName.concat(ext),
                              )
                              if (
                                fileInfo.fullPath ===
                                desiredPath
                              ) {
                                logInfo(
                                  "ALREADY NAMED",
                                  `"${fileInfo.filename}" is already at its target name — nothing to do.`,
                                )
                                return {
                                  resolvedName: finalName,
                                  isCollision: false,
                                  isNoop: true,
                                }
                              }
                              const isTargetOnDisk =
                                await access(
                                  desiredPath,
                                ).then(
                                  () => true,
                                  () => false,
                                )
                              return {
                                resolvedName: finalName,
                                isCollision:
                                  isTargetOnDisk &&
                                  !isIntraRunDuplicate,
                                isNoop: false,
                              }
                            },
                          ).pipe(
                            concatMap(
                              ({
                                resolvedName,
                                isCollision,
                                isNoop,
                              }): Observable<OnlyNameSpecialFeaturesResult> => {
                                if (isNoop) {
                                  return EMPTY
                                }
                                if (isCollision) {
                                  logWarning(
                                    "COLLISION",
                                    `"${resolvedName}" already exists. Emitting review-needed event.`,
                                  )
                                  return of<OnlyNameSpecialFeaturesResult>(
                                    {
                                      hasCollision: true,
                                      filename:
                                        fileInfo.filename,
                                      targetFilename:
                                        resolvedName,
                                    },
                                  )
                                }
                                return fileInfo
                                  .renameFile(resolvedName)
                                  .pipe(
                                    map(
                                      (): OnlyNameSpecialFeaturesResult => ({
                                        oldName:
                                          fileInfo.filename,
                                        newName:
                                          resolvedName,
                                      }),
                                    ),
                                  )
                              },
                            ),
                          ),
                        }
                      },
                      {
                        previousFilenameCount: {} as Record<
                          string,
                          number
                        >,
                        renameFileObservable:
                          new Observable() as Observable<OnlyNameSpecialFeaturesResult>,
                      },
                    ),
                    map(
                      ({ renameFileObservable }) =>
                        renameFileObservable,
                    ),
                  )

                  // Every file that came out of the timecode matcher
                  // unnamed, paired with its measured runtime so the
                  // ranker can score candidates by duration proximity.
                  const unrenamedFiles = skipped.map(
                    ({ durationSeconds, fileInfo }) => ({
                      // `FileInfo.filename` is extension-stripped, and
                      // Smart Match rebuilds the on-disk oldPath/newPath
                      // from filename + extension for its rename POST —
                      // without the extension that rename fails ENOENT.
                      extension: extname(fileInfo.fullPath),
                      filename: fileInfo.filename,
                      durationSeconds,
                    }),
                  )
                  // Both the untimed entries (commentaries, galleries —
                  // the natural smart-match pool) AND the timed extras
                  // the strict matcher rejected as out-of-tolerance, so
                  // the modal can show runtimes to compare against the
                  // file's own. Skipped entirely when nothing is left
                  // over — an empty pool keeps the trailer cheap.
                  const possibleNamesForSummary =
                    unrenamedFiles.length > 0
                      ? dedupePossibleNames(
                          possibleNames.concat(
                            flattenExtrasAsPossibleNames(
                              extras,
                            ),
                          ),
                        )
                      : []
                  const summaryStream$: Observable<
                    Observable<OnlyNameSpecialFeaturesResult>
                  > = of(
                    of<OnlyNameSpecialFeaturesResult>({
                      allKnownNames: flattenAllKnownNames({
                        // No cuts: this command never runs the
                        // movie-naming branch that produces them.
                        cuts: [],
                        extras,
                        possibleNames,
                      }),
                      possibleNames:
                        possibleNamesForSummary,
                      unnamedFileCandidates:
                        buildUnnamedFileCandidates({
                          possibleNames:
                            possibleNamesForSummary,
                          unrenamedFiles,
                        }),
                      unrenamedFilenames:
                        unrenamedFiles.map(
                          (file) => file.filename,
                        ),
                    }),
                  )

                  return concat(
                    skipEvents$,
                    renamesStream$,
                    summaryStream$,
                  )
                }),
              )
            }),
          ),
        ),
      ),
    ),
    toArray(),
    mergeAll(),
    withFileProgress(
      (renameObservable) => renameObservable,
      { concurrency: 1 },
    ),
    logAndRethrowPipelineError(
      onlyNameSpecialFeaturesDvdCompare,
    ),
  )
}
