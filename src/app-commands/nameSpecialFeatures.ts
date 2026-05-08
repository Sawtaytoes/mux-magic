import {
  concat,
  concatMap,
  defaultIfEmpty,
  defer,
  map,
  mergeAll,
  mergeMap,
  Observable,
  of,
  scan,
  switchMap,
  tap,
  throwError,
  toArray,
} from "rxjs"

import { access, rename as fsRename } from "node:fs/promises"
import { basename, dirname, extname, join } from "node:path"

import { canonicalizeMovieTitle, type MovieIdentity } from "../tools/canonicalizeMovieTitle.js"
import { logAndRethrow } from "../tools/logAndRethrow.js"
import {
  getIsSimilarTimecode,
  getSpecialFeatureFromTimecode,
  type TimecodeDeviation,
} from "../tools/getSpecialFeatureFromTimecode.js"
import {
  convertDurationToDvdCompareTimecode,
  getFileDuration,
} from "../tools/getFileDuration.js"
import { getMediaInfo } from "../tools/getMediaInfo.js"
import {
  parseSpecialFeatures,
  type Cut,
} from "../tools/parseSpecialFeatures.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import {
  displayDvdCompareVariant,
  findDvdCompareResults,
  searchDvdCompare,
} from "../tools/searchDvdCompare.js"
import { getUserSearchInput } from "../tools/getUserSearchInput.js"
import type { FileInfo } from "../tools/getFiles.js"
import { withFileProgress } from "../tools/progressEmitter.js"
import { makeDirectory } from "../tools/makeDirectory.js"

const getNextFilenameCount = (
  previousCount?: number,
) => (
  (
    previousCount
    || 0
  )
  + 1
)

const DVDCOMPARE_FILM_BASE = "https://www.dvdcompare.net/comparisons/film.php?fid="

// Plex (and most filesystems) reject these characters; replace with safe
// ASCII fallbacks so the resulting names stay readable rather than just
// stripping characters and leaving awkward gaps.
const sanitizeFilenameSegment = (name: string): string => (
  name
  .replace(/:/gu, " -")
  .replace(/\?/gu, "")
  .replace(/"/gu, "'")
  .replace(/[\\/|*<>]/gu, "")
  .replace(/[\x00-\x1f]/gu, "")
  .trim()
)

export const buildMovieBaseName = (movie: MovieIdentity): string => {
  const title = sanitizeFilenameSegment(movie.title)
  const yearPart = movie.year ? ` (${movie.year})` : ""
  return `${title}${yearPart}`
}

export const buildMovieFeatureName = (movie: MovieIdentity, cutName: string): string => {
  const editionPart = cutName ? ` {edition-${sanitizeFilenameSegment(cutName)}}` : ""
  return `${buildMovieBaseName(movie)}${editionPart}`
}

// Parse the edition tag from an already-renamed filename stem (or full
// filename with extension). Returns the edition string (e.g. "Director's Cut")
// or null when the stem carries no {edition-…} tag.
export const parseEditionFromFilename = (filename: string): string | null => {
  const stem = filename.slice(0, filename.length - extname(filename).length)
  const match = stem.match(/\{edition-([^}]+)\}/)
  return match ? match[1] : null
}

// Returns true when a renamed filename looks like a main-feature file
// (i.e. matches "Title (Year)" or "Title (Year) {edition-…}" without any
// Plex special-feature suffix like -trailer, -behindthescenes, etc.).
// The heuristic: if the stem ends in one of the known Plex suffixes it's
// a special feature; otherwise it's the main feature.
const PLEX_SPECIAL_FEATURE_SUFFIXES = [
  "-trailer",
  "-behindthescenes",
  "-deleted",
  "-featurette",
  "-interview",
  "-scene",
  "-short",
  "-other",
] as const

export const isMainFeatureFilename = (filename: string): boolean => {
  const stem = filename.slice(0, filename.length - extname(filename).length)
  return !PLEX_SPECIAL_FEATURE_SUFFIXES.some((suffix) => stem.endsWith(suffix))
}

const resolveUrl = ({
  dvdCompareId,
  dvdCompareReleaseHash,
  searchTerm,
  url,
}: {
  dvdCompareId?: number,
  dvdCompareReleaseHash?: number,
  searchTerm?: string,
  url?: string,
}): Observable<string> => {
  if (url) return of(url)

  const hash = dvdCompareReleaseHash ?? 1

  if (dvdCompareId != null) return of(`${DVDCOMPARE_FILM_BASE}${dvdCompareId}#${hash}`)

  if (searchTerm) {
    return (
      findDvdCompareResults(searchTerm)
      .pipe(
        switchMap((results) => {
          if (results.length === 0) {
            throw new Error(`No DVDCompare results found for: ${searchTerm}`)
          }

          return (
            getUserSearchInput({
              message: `Search results for "${searchTerm}":`,
              options: [
                ...results
                .map((result, index) => ({
                  index,
                  label: `${result.baseTitle}${result.variant !== "DVD" ? ` (${displayDvdCompareVariant(result.variant)})` : ""}${result.year ? ` (${result.year})` : ""}`,
                })),
                {
                  index: -1,
                  label: "Cancel / skip",
                },
              ],
            })
            .pipe(
              map((selectedIndex) => {
                if (selectedIndex === -1) return undefined

                return results.at(selectedIndex)
              }),
              tap((result) => {
                if (!result) throw new Error("No result selected.")
              }),
              map((result) => `${DVDCOMPARE_FILM_BASE}${result!.id}#${hash}`),
            )
          )
        }),
      )
    )
  }

  return throwError(() => new Error("Provide url, dvdCompareId, or searchTerm."))
}

// Per-rename emission shape. The pipeline emits one of these per file
// it actually renamed (`{ oldName, newName }`), then a single trailing
// summary record (`{ unrenamedFilenames, possibleNames }`) so the
// builder can render "Files not renamed: …" plus an optional "Possible
// names (no timecode in listing): …" hint underneath. `possibleNames`
// is empty whenever every file was successfully renamed — only useful
// when the user has a leftover to manually identify.
//
// The `collision` variant is only emitted in interactive (non-automated)
// mode when a rename target already exists on disk. The UI can render
// it as a "review needed" event prompting the user to compare and pick.
//
// The `movedToEditionFolder` variant is emitted after a main-feature
// file is successfully moved into its edition-aware nested folder.
export type NameSpecialFeaturesResult =
  | { oldName: string, newName: string }
  | { unrenamedFilenames: string[], possibleNames: string[], unnamedFileCandidates?: UnnamedFileCandidate[] }
  | { collision: true, filename: string, targetFilename: string }
  | { movedToEditionFolder: true, filename: string, destinationPath: string }

// A candidate association for an unnamed file — used in the follow-up
// association report when files remain unnamed after the main pass and
// there are untimed DVDCompare entries that could match them.
export type UnnamedFileCandidate = {
  filename: string
  candidates: string[]
}

// Per-file match outcome. The post-processor walks the buffered list of
// these and assigns final renamedFilenames, including the (1)/(2) prefix
// fallback for unmatched files when no cut matched anything. Each match
// carries the file's computed timecode so the post-processor's
// main-feature fallback can apply a minimum-duration filter (image
// galleries and other short DVDCompare-unlisted extras shouldn't be
// renamed as the movie just because they didn't match anything).
export type FileMatch =
  | { fileInfo: FileInfo, timecode: string, kind: "cut", cut: Cut }
  | { fileInfo: FileInfo, timecode: string, kind: "extra", renamedFilename: string }
  | { fileInfo: FileInfo, timecode: string, kind: "unmatched" }

const stripExtension = (filename: string): string => (
  filename.slice(0, filename.length - extname(filename).length)
)

// Topological reorder: a rename whose target name equals another file's
// CURRENT name has to run AFTER that other file's rename completes —
// otherwise the OS rejects it ("File or folder already exists") and the
// downstream logAndSwallow drops the file silently. Defer such renames
// to the end of the queue and run sequentially (concurrency: 1) so the
// freed-up slot is available by the time the deferred rename fires.
// Cycles aren't handled — they'd need a two-phase temp-rename pass —
// but realistic disc-rip layouts don't produce them. The within-run
// duplicate-target counter ((2)/(3) prefix in the scan below) still
// kicks in on top of this for files matching the same extra.
export const reorderRenamesForOnDiskConflicts = <
  T extends { fileInfo: FileInfo, renamedFilename: string }
>(renames: T[]): T[] => {
  const sourceStems = new Set(
    renames.map(({ fileInfo }) => stripExtension(fileInfo.filename)),
  )
  const upfront: T[] = []
  const deferred: T[] = []
  for (const rename of renames) {
    const ownStem = stripExtension(rename.fileInfo.filename)
    const collidesWithAnotherSource = (
      sourceStems.has(rename.renamedFilename)
      && rename.renamedFilename !== ownStem
    )
    if (collidesWithAnotherSource) {
      deferred.push(rename)
    }
    else {
      upfront.push(rename)
    }
  }
  return [...upfront, ...deferred]
}

// Files shorter than this never get the main-feature fallback rename.
// 30 min is a generous floor — typical movie cuts exceed it by a wide
// margin, while typical extras (clips, image galleries, trailers,
// short featurettes) come in well under. Surfaced as a constant so it's
// easy to retune when a real-world false-positive shows up.
const MAIN_FEATURE_MIN_DURATION_SECONDS = 30 * 60

const timecodeToSeconds = (timecode: string): number => {
  const parts = timecode.split(":").map((segment) => Number(segment) || 0)
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] * 3600 + parts[1] * 60 + parts[2]
}

// Movie-cut matching uses a wider tolerance window than extras matching.
// Full-feature rips routinely drift 5–10 seconds from DVDCompare's
// published runtime (encoder padding, leading/trailing logos, slightly
// different chapter handling), which the default per-extra padding of 2
// would reject. Cuts on a single release are minutes apart, so a 15-sec
// window won't false-positive across editions but does catch typical
// rip variance.
const CUT_TIMECODE_PADDING_FALLBACK = 15

export const findMatchingCut = (
  cuts: Cut[],
  fileTimecode: string,
  deviation: TimecodeDeviation,
): Cut | null => {
  const cutDeviation: TimecodeDeviation = {
    fixedOffset: deviation.fixedOffset,
    timecodePaddingAmount: Math.max(
      deviation.timecodePaddingAmount ?? 0,
      CUT_TIMECODE_PADDING_FALLBACK,
    ),
  }
  return cuts.find((cut) => (
    cut.timecode != null
    && getIsSimilarTimecode(fileTimecode, cut.timecode, cutDeviation)
  )) ?? null
}

// Produces the final {fileInfo, renamedFilename} pairs, applying movie
// naming to unmatched files when (and only when) no cut matched anything
// by timecode. The user's rule: if some cuts matched, the remaining
// unmatched files are likely unrelated extras DVDCompare didn't list, and
// renaming them as the main feature would be wrong.
export const postProcessMatches = (
  matches: FileMatch[],
  cuts: Cut[],
  movie: MovieIdentity,
): { fileInfo: FileInfo, renamedFilename: string }[] => {
  const renames: { fileInfo: FileInfo, renamedFilename: string }[] = []
  const unmatched: FileMatch[] = []
  let anyCutMatched = false

  matches.forEach((match) => {
    if (match.kind === "cut") {
      anyCutMatched = true
      renames.push({
        fileInfo: match.fileInfo,
        renamedFilename: buildMovieFeatureName(movie, match.cut.name),
      })
      return
    }
    if (match.kind === "extra") {
      renames.push({
        fileInfo: match.fileInfo,
        renamedFilename: match.renamedFilename,
      })
      return
    }
    unmatched.push(match)
  })

  // Some cuts matched by timecode → the unmatched files probably aren't
  // main-feature candidates (DVDCompare's extras list might just be
  // incomplete). Leave them alone, same as today's behavior.
  if (anyCutMatched) return renames

  // No cuts matched. Movie name not derivable means we can't rename
  // unmatched files as main features; leave them alone.
  if (!movie.title) return renames

  // Filter unmatched files to those long enough to plausibly be the
  // main feature. Image galleries, trailers, and other DVDCompare-
  // unlisted shorts come in well below 30 minutes; without this filter
  // a 3:31 image gallery would get renamed "(2) Movie (Year)" alongside
  // the actual movie. Files below the threshold stay unmatched and end
  // up in the unrenamedFilenames summary.
  const mainFeatureCandidates = unmatched.filter((match) => (
    match.kind === "unmatched"
    && timecodeToSeconds(match.timecode) >= MAIN_FEATURE_MIN_DURATION_SECONDS
  ))
  // Sort the candidates by filename so the (1)/(2) suffixes are stable
  // across runs.
  mainFeatureCandidates.sort((a, b) => a.fileInfo.filename.localeCompare(b.fileInfo.filename))

  if (mainFeatureCandidates.length === 0) return renames

  if (mainFeatureCandidates.length === 1) {
    // Single main-feature candidate → it's the movie. Use the sole-
    // named-cut's edition when DVDCompare published one (e.g.
    // "Director's Cut" without a timecode), else just `Title (Year)`.
    const soleNamedCut = cuts.length === 1 && cuts[0]?.name ? cuts[0] : null
    renames.push({
      fileInfo: mainFeatureCandidates[0].fileInfo,
      renamedFilename: buildMovieFeatureName(movie, soleNamedCut?.name ?? ""),
    })
    return renames
  }

  // Multiple main-feature candidates, no timecode-driven disambiguation
  // → label each as "(1) Title (Year)", "(2) Title (Year)", … so the
  // user can tell at a glance they're the movie even if which-is-which
  // is ambiguous.
  const baseName = buildMovieBaseName(movie)
  mainFeatureCandidates.forEach((match, index) => {
    renames.push({
      fileInfo: match.fileInfo,
      renamedFilename: `(${index + 1}) ${baseName}`,
    })
  })
  return renames
}

// Build a follow-up association report for unnamed files. Each unnamed
// file is paired with a ranked list of DVDCompare untimed suggestions
// (possibleNames) that could correspond to it. Right now the ranking is
// lexicographic similarity (shared words) — a cheap heuristic that still
// surfaces the right candidate in most real-world cases (the file might
// be named something like "MOVIE_t23.mkv" while the suggestion is
// "Image Gallery (1200 images)"). Callers that want more signals (runtime
// proximity) can extend this later.
export const buildUnnamedFileCandidates = (
  unrenamedFilenames: string[],
  possibleNames: string[],
): UnnamedFileCandidate[] => {
  if (unrenamedFilenames.length === 0 || possibleNames.length === 0) return []

  return unrenamedFilenames.map((filename) => {
    const stem = stripExtension(filename).toLowerCase()
    const stemWords = new Set(stem.split(/[\W_]+/).filter(Boolean))

    // Score each candidate by how many of its words appear in the stem.
    const scored = possibleNames.map((candidate) => {
      const candidateWords = candidate.toLowerCase().split(/[\W_]+/).filter(Boolean)
      const overlap = candidateWords.filter((w) => stemWords.has(w)).length
      return { candidate, overlap }
    })
    // Sort descending by overlap; ties preserve original order.
    scored.sort((a, b) => b.overlap - a.overlap)

    return {
      filename,
      candidates: scored.map((s) => s.candidate),
    }
  })
}

// Find a unique target path by appending (2), (3), … until a path that
// does not already exist on disk is found. Returns the first free path.
export const findUniqueTargetPath = async (
  desiredPath: string,
): Promise<string> => {
  let candidate = desiredPath
  let counter = 2
  while (true) {
    try {
      await access(candidate)
      // File exists — try next counter suffix.
      const ext = extname(desiredPath)
      const stem = desiredPath.slice(0, desiredPath.length - ext.length)
      candidate = `${stem} (${counter})${ext}`
      counter++
    }
    catch {
      // access threw → file does NOT exist → this path is free.
      return candidate
    }
  }
}

// Move a single file into its edition-aware nested folder:
//   <sourceParent>/<title> (<year>)/<title> (<year>) {edition-…}/<file>
//
// When the renamed file has no edition tag the move is skipped (returns
// null). The caller emits a `movedToEditionFolder` result on success.
export const moveFileToEditionFolder = (
  renamedFilePath: string,
  movie: MovieIdentity,
): Observable<string | null> => {
  const filename = basename(renamedFilePath)
  const edition = parseEditionFromFilename(filename)
  if (!edition) return of(null)

  const baseName = buildMovieBaseName(movie)
  const editionFolderName = `${baseName} {edition-${edition}}`
  const sourceParent = dirname(dirname(renamedFilePath))
  const destinationDir = join(sourceParent, baseName, editionFolderName)
  const destinationPath = join(destinationDir, filename)

  return makeDirectory(destinationDir).pipe(
    concatMap(() => (
      defer(async () => {
        const uniqueDestination = await findUniqueTargetPath(destinationPath)
        await fsRename(renamedFilePath, uniqueDestination)
        return uniqueDestination
      })
    )),
  )
}

export const nameSpecialFeatures = ({
  dvdCompareId,
  dvdCompareReleaseHash,
  fixedOffset,
  moveToEditionFolders = false,
  nonInteractive = false,
  searchTerm,
  sourcePath,
  timecodePaddingAmount,
  url,
}: (
  {
    dvdCompareId?: number,
    dvdCompareReleaseHash?: number,
    // When true, main-feature files with an {edition-…} tag are moved
    // into <sourceParent>/<Title (Year)>/<Title (Year) {edition-…}>/<file>
    // after renaming. Special-feature files are not moved.
    moveToEditionFolders?: boolean,
    // When true: rename collisions auto-resolve by appending (2), (3), etc.
    // When false (default): emit a { collision } event so the UI can prompt
    // the user to compare and choose. The CLI handler also defaults to
    // non-interactive=false so running from the terminal also surfaces the
    // collision event (both interactive modes behave the same way at the
    // observable level — the difference is how the consumer reacts to it).
    nonInteractive?: boolean,
    searchTerm?: string,
    sourcePath: string,
    url?: string,
  }
  & TimecodeDeviation
)) => {
  const deviation: TimecodeDeviation = { fixedOffset, timecodePaddingAmount }

  // Pipe is split into two chained .pipe() calls. RxJS's pipe type
  // overloads cap at ~9 operators; the diagnostic taps pushed this
  // chain past the limit, which caused TS to fall back to
  // Observable<unknown> and broke the typed CLI subscriber. Splitting
  // here keeps each chain inside the inferable range.
  return (
    resolveUrl({ dvdCompareId, dvdCompareReleaseHash, searchTerm, url })
    .pipe(
      tap(() => console.log("Loading DVDCompare page…")),
      concatMap((resolvedUrl) => searchDvdCompare({ url: resolvedUrl })),
      tap((scrape) => console.log(
        `Scraped extras text: ${scrape.extras.length} chars, `
        + `${scrape.extras.split("\n").filter(Boolean).length} non-empty lines`,
      )),
      // Resolve everything that depends on the scrape result (parsed
      // extras+cuts, canonical movie identity) before walking files.
      concatMap((scrape) => (
        parseSpecialFeatures(scrape.extras)
        .pipe(
          tap(({ extras, cuts, possibleNames }) => {
            const timecodedExtras = extras.filter((e) => e.timecode).length
            const childTimecodedExtras = extras
              .flatMap((e) => e.children ?? [])
              .filter((c) => c.timecode).length
            console.log(
              `Parsed ${extras.length} extras `
              + `(${timecodedExtras + childTimecodedExtras} with timecodes), `
              + `${cuts.length} cuts, ${possibleNames.length} untimed suggestions`,
            )
          }),
          mergeMap(({ extras, cuts, possibleNames }) => (
            (
              scrape.filmTitle
              ? canonicalizeMovieTitle({
                  dvdCompareBaseTitle: scrape.filmTitle.baseTitle,
                  dvdCompareYear: scrape.filmTitle.year,
                })
              : of<MovieIdentity>({ title: "", year: "" })
            )
            .pipe(
              map((movie) => ({ extras, cuts, movie, possibleNames })),
            )
          )),
        )
      )),
    )
    .pipe(
      tap(() => console.log(
        `Reading file metadata… (padding=${timecodePaddingAmount ?? 0}, `
        + `offset=${fixedOffset ?? 0})`,
      )),
      concatMap(({ extras: specialFeatures, cuts, movie, possibleNames }) => (
        getFilesAtDepth({ depth: 0, sourcePath })
        .pipe(
          mergeMap((fileInfo) => (
            getMediaInfo(fileInfo.fullPath)
            .pipe(
              mergeMap((mediaInfo) => getFileDuration({ mediaInfo })),
              map((duration) => ({
                fileInfo,
                timecode: convertDurationToDvdCompareTimecode(duration),
              })),
              tap(({ timecode }) => console.log(
                `  ${fileInfo.filename}: ${timecode}`,
              )),
            )
          )),
          // Per-file match: cut first (timecode-deterministic), then
          // extras (existing matcher with user prompts on ambiguity),
          // else 'unmatched' for the post-processor to decide on.
          concatMap(({ fileInfo, timecode }): Observable<FileMatch> => {
            const matchedCut = findMatchingCut(cuts, timecode, deviation)
            if (matchedCut) {
              return of({ fileInfo, timecode, kind: "cut", cut: matchedCut })
            }
            const unmatchedFallback: FileMatch = { fileInfo, timecode, kind: "unmatched" }
            return (
              getSpecialFeatureFromTimecode({
                filename: fileInfo.filename,
                filePath: fileInfo.fullPath,
                fixedOffset,
                specialFeatures,
                timecode,
                timecodePaddingAmount,
              })
              .pipe(
                map((renamedFilename): FileMatch => ({
                  fileInfo,
                  timecode,
                  kind: "extra",
                  renamedFilename,
                })),
                defaultIfEmpty(unmatchedFallback),
              )
            )
          }),
          // Buffer every per-file match so the post-processor can apply
          // the (1)/(2) main-feature fallback after seeing the full set.
          toArray(),
          concatMap((matches: FileMatch[]) => {
            const renames = postProcessMatches(matches, cuts, movie)
            const renamedFullPaths = new Set(renames.map((r) => r.fileInfo.fullPath))
            // Files that survived the post-processor without a rename —
            // surfaced as a final summary so the user can see at a glance
            // which entries the matcher couldn't place. Most common cause
            // is a special feature DVDCompare lists without a timecode
            // (e.g. image galleries). Always emitted, even when empty,
            // so the formatter has a stable result shape.
            const unrenamedFilenames = matches
              .filter((match) => !renamedFullPaths.has(match.fileInfo.fullPath))
              .map((match) => match.fileInfo.filename)

            // Only surface possibleNames suggestions when there's actually
            // a leftover file to identify. On the happy path the list is
            // noise — every file matched, so the user doesn't need a
            // sidebar of untimed extras to choose from.
            const possibleNamesForSummary = (
              unrenamedFilenames.length > 0
                ? possibleNames
                : []
            )

            // Build per-file candidate associations for the follow-up
            // association report. Only populated when there are both
            // unnamed files AND untimed DVDCompare suggestions — the
            // common case where the user still has files that need a name.
            const unnamedFileCandidates = buildUnnamedFileCandidates(
              unrenamedFilenames,
              possibleNamesForSummary,
            )

            if (unnamedFileCandidates.length > 0) {
              console.log("Unnamed files with DVDCompare candidate associations:")
              unnamedFileCandidates.forEach(({ filename, candidates }) => {
                console.log(`  • ${filename}`)
                candidates.slice(0, 3).forEach((c) => console.log(`      - ${c}`))
              })
            }

            console.log(
              `Renaming matched files (${renames.length} of ${matches.length})…`,
            )

            // Reorder so renames-into-another-file's-current-name happen
            // after the file holding that name has already moved away.
            // Required for the within-run conflict (e.g. an existing
            // "International Trailer without Narration -trailer.mkv" being
            // renamed to "with Narration", while another file is being
            // renamed to "without Narration") which previously raced and
            // silently dropped one file via logAndSwallow.
            const orderedRenames = reorderRenamesForOnDiskConflicts(renames)

            // Render the renames through the duplicate-counter +
            // rename-observable scan as before, then append the summary.
            // N4 collision handling: for each rename we check (via the
            // scan state) whether the target name was already seen within
            // this run (intra-run duplicate) OR exists on disk (pre-existing
            // file). Intra-run duplicates use the existing (2)/(3) counter.
            // Pre-existing on-disk collisions branch on nonInteractive:
            //   - nonInteractive=true  → auto-suffix with (2)/(3) counter.
            //   - nonInteractive=false → emit { collision } and skip the rename.
            const renamesStream$ = (
              of(...orderedRenames)
              .pipe(
                scan(
                  (
                    { previousFilenameCount },
                    { fileInfo, renamedFilename },
                  ) => {
                    const intraRunDuplicate = renamedFilename in previousFilenameCount
                    const finalName = (
                      intraRunDuplicate
                      ? `(${getNextFilenameCount(previousFilenameCount[renamedFilename])}) ${renamedFilename}`
                      : renamedFilename
                    )
                    return {
                      previousFilenameCount: {
                        ...previousFilenameCount,
                        [renamedFilename]: getNextFilenameCount(
                          previousFilenameCount[renamedFilename],
                        ),
                      },
                      renameFileObservable: (
                        // N4: on-disk collision check for non-intra-run
                        // conflicts. When the target already exists and
                        // we're not in nonInteractive mode, emit a
                        // collision event instead of attempting the rename.
                        defer(async () => {
                          if (nonInteractive) {
                            // Auto-suffix mode: find a free path via
                            // findUniqueTargetPath (handles both intra-run
                            // and pre-existing on-disk cases uniformly).
                            const ext = extname(fileInfo.fullPath)
                            const desiredPath = join(
                              sourcePath,
                              finalName.concat(ext),
                            )
                            const uniquePath = await findUniqueTargetPath(desiredPath)
                            const uniqueName = basename(uniquePath, ext)
                            return { resolvedName: uniqueName, isCollision: false }
                          }
                          // Interactive mode: check if the target already
                          // exists on disk (distinct from intra-run dupes
                          // which the scan counter handles).
                          const ext = extname(fileInfo.fullPath)
                          const targetPath = join(sourcePath, finalName.concat(ext))
                          const targetExistsOnDisk = await access(targetPath).then(() => true, () => false)
                          return {
                            resolvedName: finalName,
                            isCollision: targetExistsOnDisk && !intraRunDuplicate,
                          }
                        })
                        .pipe(
                          concatMap(({ resolvedName, isCollision }): Observable<NameSpecialFeaturesResult> => {
                            if (isCollision) {
                              console.warn(
                                `Collision: "${resolvedName}" already exists. `
                                + `Emitting review-needed event (pass --non-interactive to auto-suffix).`,
                              )
                              return of<NameSpecialFeaturesResult>({
                                collision: true,
                                filename: fileInfo.filename,
                                targetFilename: resolvedName,
                              })
                            }
                            return (
                              fileInfo.renameFile(resolvedName)
                              .pipe(
                                concatMap((): Observable<NameSpecialFeaturesResult> => {
                                  const renamedResult: NameSpecialFeaturesResult = {
                                    oldName: fileInfo.filename,
                                    newName: resolvedName,
                                  }
                                  // N1: after a successful rename, if the
                                  // renamed file is a main-feature with an
                                  // edition tag AND moveToEditionFolders is
                                  // requested, move it into the nested folder.
                                  if (!moveToEditionFolders) {
                                    return of(renamedResult)
                                  }
                                  if (!isMainFeatureFilename(resolvedName)) {
                                    return of(renamedResult)
                                  }
                                  const edition = parseEditionFromFilename(resolvedName)
                                  if (!edition) {
                                    return of(renamedResult)
                                  }
                                  const renamedFilePath = join(
                                    sourcePath,
                                    resolvedName.concat(extname(fileInfo.fullPath)),
                                  )
                                  return concat(
                                    of(renamedResult),
                                    moveFileToEditionFolder(renamedFilePath, movie)
                                    .pipe(
                                      map((destPath): NameSpecialFeaturesResult => {
                                        if (destPath === null) return renamedResult
                                        console.log(`Moved to edition folder: ${destPath}`)
                                        return {
                                          movedToEditionFolder: true,
                                          filename: resolvedName.concat(extname(fileInfo.fullPath)),
                                          destinationPath: destPath,
                                        }
                                      }),
                                    ),
                                  )
                                }),
                              )
                            )
                          }),
                        )
                      ),
                    }
                  },
                  {
                    previousFilenameCount: {} as Record<string, number>,
                    renameFileObservable: (
                      new Observable() as Observable<NameSpecialFeaturesResult>
                    ),
                  },
                ),
                map(({ renameFileObservable }) => renameFileObservable),
              )
            )
            const summary$: Observable<Observable<NameSpecialFeaturesResult>> = (
              of(of<NameSpecialFeaturesResult>({
                unrenamedFilenames,
                possibleNames: possibleNamesForSummary,
                unnamedFileCandidates: (
                  unnamedFileCandidates.length > 0
                    ? unnamedFileCandidates
                    : undefined
                ),
              }))
            )
            return concat(renamesStream$, summary$)
          }),
        )
      )),
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
      withFileProgress((renameObservable) => renameObservable, { concurrency: 1 }),
      logAndRethrow(nameSpecialFeatures),
    )
  )
}
