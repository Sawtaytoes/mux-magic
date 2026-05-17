import { access } from "node:fs/promises"
import { basename, extname, join } from "node:path"
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
  tap,
  toArray,
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
import {
  getSpecialFeatureFromTimecode,
  type TimecodeDeviation,
} from "../tools/getSpecialFeatureFromTimecode.js"
import { parseSpecialFeatures } from "../tools/parseSpecialFeatures.js"
import { withFileProgress } from "../tools/progressEmitter.js"
import { searchDvdCompare } from "../tools/searchDvdCompare.js"
import { buildUnnamedFileCandidates } from "./nameSpecialFeaturesDvdCompareTmdb.buildUnnamedFileCandidates.js"
import { reorderForDuplicatePrompts } from "./nameSpecialFeaturesDvdCompareTmdb.duplicates.js"
import {
  findUniqueTargetPath,
  moveFileToEditionFolder,
} from "./nameSpecialFeaturesDvdCompareTmdb.editions.js"
import {
  isMainFeatureFilename,
  parseEditionFromFilename,
} from "./nameSpecialFeaturesDvdCompareTmdb.editionTag.js"
import type { NameSpecialFeaturesResult } from "./nameSpecialFeaturesDvdCompareTmdb.events.js"
import type { FileMatch } from "./nameSpecialFeaturesDvdCompareTmdb.fileMatch.js"
import { flattenAllKnownNames } from "./nameSpecialFeaturesDvdCompareTmdb.flattenAllKnownNames.js"
import { postProcessMatches } from "./nameSpecialFeaturesDvdCompareTmdb.postProcessMatches.js"
import { reorderRenamesForOnDiskConflicts } from "./nameSpecialFeaturesDvdCompareTmdb.reorderRenamesForOnDiskConflicts.js"
import { resolveUrl } from "./nameSpecialFeaturesDvdCompareTmdb.resolveUrl.js"
import { findMatchingCut } from "./nameSpecialFeaturesDvdCompareTmdb.timecode.js"

const getNextFilenameCount = (previousCount?: number) =>
  (previousCount || 0) + 1

export const nameSpecialFeaturesDvdCompareTmdb = ({
  isAutoNamingDuplicates = false,
  dvdCompareId,
  dvdCompareReleaseHash,
  fixedOffset,
  isMovingToEditionFolders = false,
  isNonInteractive = false,
  searchTerm,
  sourcePath,
  timecodePaddingAmount,
  url,
}: {
  // When true (default for sequence/API runs): two-or-more files
  // matching the same target name within a single run are auto-
  // disambiguated via the deterministic (2)/(3)/… suffix counter.
  // When false (the Builder UI's default): each ambiguous group emits
  // a `getUserSearchInput` prompt so the user can pick which file
  // should keep the un-suffixed target name; the others fall through
  // to the same (2)/(3)/… counter.
  isAutoNamingDuplicates?: boolean
  dvdCompareId?: number
  dvdCompareReleaseHash?: number
  // When true, main-feature files with an {edition-…} tag are moved
  // into <sourceParent>/<Title (Year)>/<Title (Year) {edition-…}>/<file>
  // after renaming. Special-feature files are not moved.
  isMovingToEditionFolders?: boolean
  // When true: rename collisions auto-resolve by appending (2), (3), etc.
  // When false (default): emit a { hasCollision } event so the UI can prompt
  // the user to compare and choose. The CLI handler also defaults to
  // non-interactive=false so running from the terminal also surfaces the
  // hasCollision event (both interactive modes behave the same way at the
  // observable level — the difference is how the consumer reacts to it).
  isNonInteractive?: boolean
  searchTerm?: string
  sourcePath: string
  url?: string
} & TimecodeDeviation) => {
  const deviation: TimecodeDeviation = {
    fixedOffset,
    timecodePaddingAmount,
  }

  // Pipe is split into two chained .pipe() calls. RxJS's pipe type
  // overloads cap at ~9 operators; the diagnostic taps pushed this
  // chain past the limit, which caused TS to fall back to
  // Observable<unknown> and broke the typed CLI subscriber. Splitting
  // here keeps each chain inside the inferable range.
  return resolveUrl({
    dvdCompareId,
    dvdCompareReleaseHash,
    searchTerm,
    url,
  })
    .pipe(
      tap(() => logInfo("LOADING", "DVDCompare page")),
      concatMap((resolvedUrl) =>
        searchDvdCompare({ url: resolvedUrl }),
      ),
      tap((scrape) =>
        logInfo(
          "SCRAPED EXTRAS",
          `${scrape.extras.length} chars, ${scrape.extras.split("\n").filter(Boolean).length} non-empty lines`,
        ),
      ),
      // Resolve everything that depends on the scrape result (parsed
      // extras+cuts, canonical movie identity) before walking files.
      concatMap((scrape) =>
        parseSpecialFeatures(scrape.extras).pipe(
          tap(({ extras, cuts, possibleNames }) => {
            const timecodedExtras = extras.filter(
              (entry) => entry.timecode,
            ).length
            const childTimecodedExtras = extras
              .flatMap((entry) => entry.children ?? [])
              .filter((child) => child.timecode).length
            logInfo(
              "PARSED EXTRAS",
              `${extras.length} extras (${timecodedExtras + childTimecodedExtras} with timecodes), ${cuts.length} cuts, ${possibleNames.length} untimed suggestions`,
            )
          }),
          mergeMap(({ extras, cuts, possibleNames }) =>
            (scrape.filmTitle
              ? canonicalizeMovieTitle({
                  dvdCompareBaseTitle:
                    scrape.filmTitle.baseTitle,
                  dvdCompareYear: scrape.filmTitle.year,
                })
              : of<MovieIdentity>({ title: "", year: "" })
            ).pipe(
              map((movie) => ({
                extras,
                cuts,
                movie,
                possibleNames,
              })),
            ),
          ),
        ),
      ),
    )
    .pipe(
      tap(() =>
        logInfo(
          "READING FILE METADATA",
          `padding=${timecodePaddingAmount ?? 0}, offset=${fixedOffset ?? 0}`,
        ),
      ),
      concatMap(
        ({
          extras: specialFeatures,
          cuts,
          movie,
          possibleNames,
        }) =>
          getFilesAtDepth({ depth: 0, sourcePath }).pipe(
            mergeMap((fileInfo) =>
              getMediaInfo(fileInfo.fullPath).pipe(
                mergeMap((mediaInfo) =>
                  getFileDuration({ mediaInfo }),
                ),
                map((duration) => ({
                  fileInfo,
                  timecode:
                    convertDurationToDvdCompareTimecode(
                      duration,
                    ),
                  durationSeconds: duration,
                })),
                tap(({ timecode }) =>
                  logInfo(
                    "TIMECODE",
                    fileInfo.filename,
                    timecode,
                  ),
                ),
              ),
            ),
            // Per-file match: cut first (timecode-deterministic), then
            // extras (existing matcher with user prompts on ambiguity),
            // else 'unmatched' for the post-processor to decide on.
            concatMap(
              ({
                fileInfo,
                timecode,
                durationSeconds,
              }): Observable<FileMatch> => {
                const matchedCut = findMatchingCut(
                  cuts,
                  timecode,
                  deviation,
                )
                if (matchedCut) {
                  return of({
                    fileInfo,
                    timecode,
                    durationSeconds,
                    kind: "cut",
                    cut: matchedCut,
                  })
                }
                const unmatchedFallback: FileMatch = {
                  fileInfo,
                  timecode,
                  durationSeconds,
                  kind: "unmatched",
                }
                return getSpecialFeatureFromTimecode({
                  filename: fileInfo.filename,
                  filePath: fileInfo.fullPath,
                  fixedOffset,
                  specialFeatures,
                  timecode,
                  timecodePaddingAmount,
                }).pipe(
                  map(
                    (renamedFilename): FileMatch => ({
                      fileInfo,
                      timecode,
                      durationSeconds,
                      kind: "extra",
                      renamedFilename,
                    }),
                  ),
                  defaultIfEmpty(unmatchedFallback),
                )
              },
            ),
            // Buffer every per-file match so the post-processor can apply
            // the (1)/(2) main-feature fallback after seeing the full set.
            toArray(),
            concatMap((matches: FileMatch[]) => {
              const renames = postProcessMatches(
                matches,
                cuts,
                movie,
              )
              const renamedFullPaths = new Set(
                renames.map(
                  (rename) => rename.fileInfo.fullPath,
                ),
              )
              // Files that survived the post-processor without a rename —
              // surfaced as a final summary so the user can see at a glance
              // which entries the matcher couldn't place. Most common cause
              // is a special feature DVDCompare lists without a timecode
              // (e.g. image galleries). Always emitted, even when empty,
              // so the formatter has a stable result shape.
              const leftoverMatches = matches.filter(
                (match) =>
                  !renamedFullPaths.has(
                    match.fileInfo.fullPath,
                  ),
              )
              const unrenamedFilenames =
                leftoverMatches.map(
                  (match) => match.fileInfo.filename,
                )
              const unrenamedFiles = leftoverMatches.map(
                (match) => ({
                  filename: match.fileInfo.filename,
                  durationSeconds:
                    match.durationSeconds ?? null,
                }),
              )

              // Only surface possibleNames suggestions when there's actually
              // a leftover file to identify. On the happy path the list is
              // noise — every file matched, so the user doesn't need a
              // sidebar of untimed extras to choose from.
              const possibleNamesForSummary =
                unrenamedFilenames.length > 0
                  ? possibleNames
                  : []

              // Build per-file candidate associations for the follow-up
              // association report. Only populated when there are both
              // unnamed files AND untimed DVDCompare suggestions — the
              // common case where the user still has files that need a name.
              // `unrenamedFiles` (worker 58 / Part B) carries
              // `durationSeconds` per file so the web-side Smart Match
              // modal can rank candidates by duration proximity.
              const unnamedFileCandidates =
                buildUnnamedFileCandidates({
                  possibleNames: possibleNamesForSummary,
                  unrenamedFiles,
                })

              if (unnamedFileCandidates.length > 0) {
                logInfo(
                  "UNNAMED FILES",
                  "Unnamed files with DVDCompare candidate associations",
                  unnamedFileCandidates.flatMap(
                    ({ filename, candidates }) =>
                      [`  • ${filename}`].concat(
                        candidates
                          .slice(0, 3)
                          .map(
                            (candidate) =>
                              `      - ${candidate}`,
                          ),
                      ),
                  ),
                )
              }

              logInfo(
                "RENAMING",
                `Renaming matched files (${renames.length} of ${matches.length})`,
              )

              // Reorder so renames-into-another-file's-current-name happen
              // after the file holding that name has already moved away.
              // Required for the within-run conflict (e.g. an existing
              // "International Trailer without Narration -trailer.mkv" being
              // renamed to "with Narration", while another file is being
              // renamed to "without Narration") which previously raced and
              // silently dropped one file via logAndSwallowPipelineError.
              const conflictOrderedRenames =
                reorderRenamesForOnDiskConflicts(renames)

              // Phase-B duplicate-detection prompt: when two-or-more renames
              // share the same target name AND `autoNameDuplicates: false`,
              // ask the user (via the SSE prompt channel) which file should
              // claim the un-suffixed target name. The chosen file is moved
              // to the front of its group in the ordered list; the rest fall
              // through to the existing scan-based (2)/(3) counter so their
              // names disambiguate deterministically. When the user picks
              // -1 (skip) the original DVDCompare order is preserved, which
              // is also the behavior under `autoNameDuplicates: true`.
              const promptForDuplicates$ =
                isAutoNamingDuplicates
                  ? of(conflictOrderedRenames)
                  : reorderForDuplicatePrompts(
                      conflictOrderedRenames,
                    )

              return promptForDuplicates$.pipe(
                concatMap((orderedRenames) => {
                  const allKnownNames =
                    flattenAllKnownNames({
                      cuts,
                      extras: specialFeatures,
                      possibleNames,
                    })
                  // Render the renames through the duplicate-counter +
                  // rename-observable scan as before, then append the summary.
                  // N4 collision handling: for each rename we check (via the
                  // scan state) whether the target name was already seen within
                  // this run (intra-run duplicate) OR exists on disk (pre-existing
                  // file). Intra-run duplicates use the existing (2)/(3) counter.
                  // Pre-existing on-disk collisions branch on nonInteractive:
                  //   - nonInteractive=true  → auto-suffix with (2)/(3) counter.
                  //   - nonInteractive=false → emit { collision } and skip the rename.
                  const renamesStream$ = of(
                    ...orderedRenames,
                  ).pipe(
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
                          renameFileObservable:
                            // N4: on-disk collision check for non-intra-run
                            // conflicts. When the target already exists and
                            // we're not in nonInteractive mode, emit a
                            // collision event instead of attempting the rename.
                            defer(async () => {
                              const ext = extname(
                                fileInfo.fullPath,
                              )
                              const desiredPath = join(
                                sourcePath,
                                finalName.concat(ext),
                              )
                              // Self-rename: file already lives at the target path
                              // (common when re-running after a prior successful run).
                              // Skip silently rather than emitting a collision event.
                              if (
                                fileInfo.fullPath ===
                                desiredPath
                              ) {
                                return {
                                  resolvedName: finalName,
                                  isCollision: false,
                                  isNoop: true,
                                }
                              }
                              if (isNonInteractive) {
                                // Auto-suffix mode: find a free path via
                                // findUniqueTargetPath (handles both intra-run
                                // and pre-existing on-disk cases uniformly).
                                const uniquePath =
                                  await findUniqueTargetPath(
                                    desiredPath,
                                  )
                                const uniqueName = basename(
                                  uniquePath,
                                  ext,
                                )
                                return {
                                  resolvedName: uniqueName,
                                  isCollision: false,
                                  isNoop: false,
                                }
                              }
                              // Interactive mode: check if the target already
                              // exists on disk (distinct from intra-run dupes
                              // which the scan counter handles).
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
                            }).pipe(
                              concatMap(
                                ({
                                  resolvedName,
                                  isCollision,
                                  isNoop,
                                }): Observable<NameSpecialFeaturesResult> => {
                                  if (isNoop) {
                                    return EMPTY
                                  }
                                  if (isCollision) {
                                    logWarning(
                                      "COLLISION",
                                      `"${resolvedName}" already exists. Emitting review-needed event (pass --non-interactive to auto-suffix).`,
                                    )
                                    return of<NameSpecialFeaturesResult>(
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
                                    .renameFile(
                                      resolvedName,
                                    )
                                    .pipe(
                                      concatMap(
                                        (): Observable<NameSpecialFeaturesResult> => {
                                          const renamedResult: NameSpecialFeaturesResult =
                                            {
                                              oldName:
                                                fileInfo.filename,
                                              newName:
                                                resolvedName,
                                            }
                                          // N1: after a successful rename, if the
                                          // renamed file is a main-feature with an
                                          // edition tag AND moveToEditionFolders is
                                          // requested, move it into the nested folder.
                                          if (
                                            !isMovingToEditionFolders
                                          ) {
                                            return of(
                                              renamedResult,
                                            )
                                          }
                                          if (
                                            !isMainFeatureFilename(
                                              resolvedName,
                                            )
                                          ) {
                                            return of(
                                              renamedResult,
                                            )
                                          }
                                          const edition =
                                            parseEditionFromFilename(
                                              resolvedName,
                                            )
                                          if (!edition) {
                                            return of(
                                              renamedResult,
                                            )
                                          }
                                          const renamedFilePath =
                                            join(
                                              sourcePath,
                                              resolvedName.concat(
                                                extname(
                                                  fileInfo.fullPath,
                                                ),
                                              ),
                                            )
                                          return concat(
                                            of(
                                              renamedResult,
                                            ),
                                            moveFileToEditionFolder(
                                              renamedFilePath,
                                              movie,
                                            ).pipe(
                                              map(
                                                (
                                                  destPath,
                                                ): NameSpecialFeaturesResult => {
                                                  if (
                                                    destPath ===
                                                    null
                                                  )
                                                    return renamedResult
                                                  logInfo(
                                                    "MOVED TO EDITION FOLDER",
                                                    destPath,
                                                  )
                                                  return {
                                                    hasMovedToEditionFolder: true,
                                                    filename:
                                                      resolvedName.concat(
                                                        extname(
                                                          fileInfo.fullPath,
                                                        ),
                                                      ),
                                                    destinationPath:
                                                      destPath,
                                                  }
                                                },
                                              ),
                                            ),
                                          )
                                        },
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
                          new Observable() as Observable<NameSpecialFeaturesResult>,
                      },
                    ),
                    map(
                      ({ renameFileObservable }) =>
                        renameFileObservable,
                    ),
                  )
                  const summary$: Observable<
                    Observable<NameSpecialFeaturesResult>
                  > = of(
                    of<NameSpecialFeaturesResult>({
                      unrenamedFilenames,
                      possibleNames:
                        possibleNamesForSummary,
                      allKnownNames,
                      unnamedFileCandidates:
                        unnamedFileCandidates.length > 0
                          ? unnamedFileCandidates
                          : undefined,
                    }),
                  )
                  return concat(renamesStream$, summary$)
                }),
              )
            }),
          ),
      ),
      // Wait till all renames are figured out before doing any renaming.
      toArray(),
      // Unfold the array.
      mergeAll(),
      // Rename everything by calling the mapped function. withFileProgress
      // here plays the same flatten-and-subscribe role as mergeAll while
      // ticking the per-job progress emitter on each rename observable's
      // completion. Concurrency is intentionally 1 so the topologically
      // ordered renames above (reorderRenamesForOnDiskConflicts) actually
      // execute in order — running these in parallel re-introduces the
      // race between renames-out-of and renames-into the same target name.
      withFileProgress(
        (renameObservable) => renameObservable,
        { concurrency: 1 },
      ),
      logAndRethrowPipelineError(
        nameSpecialFeaturesDvdCompareTmdb,
      ),
    )
}
