import { basename } from "node:path"
import {
  cleanupFilename,
  getFiles,
  logAndRethrowPipelineError,
  logInfo,
  naturalSort,
} from "@mux-magic/tools"
import {
  concatMap,
  EMPTY,
  filter,
  from,
  map,
  mergeAll,
  mergeMap,
  of,
  switchMap,
  toArray,
} from "rxjs"
import { detectMovieFormatVariants } from "../tools/detectMovieFormatVariants.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { getUserSearchInput } from "../tools/getUserSearchInput.js"
import { matchSpecialsToFiles } from "../tools/matchSpecialsToFiles.js"
import { withFileProgress } from "../tools/progressEmitter.js"
import { readMediaDurationMinutes } from "../tools/readMediaDurationMinutes.js"
import {
  lookupAnidbById,
  pickAnidbSeriesName,
  searchAnidb,
} from "../tools/searchAnidb.js"
import type {
  AnidbAnime,
  AnidbEpisode,
  AnidbEpisodeCategory,
} from "../types/anidb.js"
import {
  effectiveDurationDeltaMinutes,
  episodeTypesForCategory,
  epnoOrderingValue,
  isPickerCategory,
} from "../types/anidb.js"

// Slack added on top of AniDB's rounding window for the index-paired
// duration sanity-check warning. AniDB's `length` is rounded UP (1m
// granularity below 16, 5m at 16+; see effectiveDurationDeltaMinutes).
// A few extra minutes of drift is still normal (intro/outro variants,
// post-credits scenes, NCED vs ED), so the warning only fires when
// the file's duration is meaningfully outside the rounding window.
const DURATION_MISMATCH_SLACK_MINUTES = 2

// Episode title preference: English → x-jat (romaji) → first available.
const pickEpisodeTitle = (
  titles: AnidbAnime["episodes"][number]["titles"],
) =>
  titles.find((title) => title.lang === "en")?.value ??
  titles.find((title) => title.lang === "x-jat")?.value ??
  titles[0]?.value ??
  ""

// AniDB returns episodes unsorted (often newest first in the XML).
// Filter by category and sort using a synthesized numeric ordering
// (see epnoOrderingValue) so file index N lines up with the Nth
// episode in AniDB's natural display order — even for specials whose
// epno is letter-prefixed ("S1", "C5", "O13") and would otherwise
// sort as NaN under Number(epno).
const filterAndSortByCategory = (
  episodes: AnidbAnime["episodes"],
  category: AnidbEpisodeCategory,
): AnidbAnime["episodes"] => {
  const allowedTypes = new Set<number>(
    episodeTypesForCategory(category),
  )
  return episodes
    .filter((ep) => allowedTypes.has(ep.type))
    .slice()
    .sort(
      (itemA, itemB) =>
        epnoOrderingValue(itemA.type, itemA.epno) -
        epnoOrderingValue(itemB.type, itemB.epno),
    )
}

// Output filename builder. Branches by category:
//   regular  → uses AniDB's epno verbatim so a re-run with the same
//              file order produces stable filenames (epno is the
//              canonical "this is episode N" reference).
//   others   → sequential index (1, 2, 3...) under the user's
//              seasonNumber. The AniDB epno here is "O1", "O2"... —
//              not user-friendly in a Plex library, so we drop it.
//   picker categories (specials/credits/trailers/parodies):
//              Plex's specials convention — season 0, sequential
//              index. The Plex scanner pulls these into the
//              "Specials" virtual season regardless of which AniDB
//              type the episode came from.
export const formatOutputFilename = ({
  category,
  episode,
  episodeTitle,
  seasonNumber,
  sequentialIndex,
  seriesName,
}: {
  category: AnidbEpisodeCategory
  episode: AnidbEpisode
  episodeTitle: string
  seasonNumber: number
  sequentialIndex: number
  seriesName: string
}) => {
  const padTwo = (value: number | string) =>
    String(value).padStart(2, "0")
  // A missing episode title (e.g. a currently-airing series AniDB hasn't
  // published titles for yet) drops the " - <title>" segment rather than
  // the whole file, so the rename still lands and is re-runnable once the
  // title exists.
  const titleSuffix = episodeTitle
    ? ` - ${episodeTitle}`
    : ""
  if (category === "regular") {
    return cleanupFilename(
      seriesName.concat(
        " - ",
        "s",
        padTwo(seasonNumber),
        "e",
        padTwo(episode.epno),
        titleSuffix,
      ),
    )
  }
  if (isPickerCategory(category)) {
    return cleanupFilename(
      seriesName.concat(
        " - ",
        "s00",
        "e",
        padTwo(sequentialIndex),
        titleSuffix,
      ),
    )
  }
  // others
  return cleanupFilename(
    seriesName.concat(
      " - ",
      "s",
      padTwo(seasonNumber),
      "e",
      padTwo(sequentialIndex),
      titleSuffix,
    ),
  )
}

// The series name used in output filenames and the seriesFolderName
// output. An explicit override (from the AniDB title-picker) wins
// verbatim — backticks, apostrophes and all — so the user's
// character-cleaned choice is preserved; otherwise fall back to AniDB's
// auto-picked title.
export const resolveSeriesName = (
  seriesNameOverride: string | undefined,
  titles: AnidbAnime["titles"],
): string =>
  seriesNameOverride && seriesNameOverride.length > 0
    ? seriesNameOverride
    : pickAnidbSeriesName(titles)

// Sonarr/Plex series-folder convention: "<name> [anidb-<id>]". Surfaced
// as an extractable output so a downstream copyFiles/moveFiles step can
// drop the renamed files straight into the right library folder via
// linkedTo.
export const formatSeriesFolderName = ({
  anidbId,
  seriesName,
}: {
  anidbId: number
  seriesName: string
}): string => `${seriesName} [anidb-${anidbId}]`

// Compile the optional filenameRegex once. Throws a descriptive error
// on an invalid pattern so it surfaces on the run card instead of a
// cryptic RegExp SyntaxError. Case-insensitive so "S02E05" / "s02e05"
// both match without the caller thinking about it.
export const compileFilenameRegex = (
  filenameRegex: string | undefined,
): RegExp | null => {
  if (!filenameRegex) {
    return null
  }
  try {
    return new RegExp(filenameRegex, "i")
  } catch (error) {
    throw new Error(
      `Invalid filenameRegex "${filenameRegex}": ${(error as Error).message}`,
    )
  }
}

// Pull the episode number out of a filename via the compiled regex's
// (?<episodeNumber>…) named group. Returns null when the regex has no
// such group, doesn't match, or captures a non-number.
export const extractEpisodeNumberFromFilename = (
  filename: string,
  compiledFilenameRegex: RegExp,
): number | null => {
  const captured =
    compiledFilenameRegex.exec(filename)?.groups
      ?.episodeNumber
  if (captured == null) {
    return null
  }
  const parsed = Number(captured)
  return Number.isFinite(parsed) ? parsed : null
}

// Decide which AniDB episode a file pairs with in the index-paired
// (regular / others) branch. Precedence:
//   1. filenameRegex — pair by the episode number extracted from the
//      filename (matched against AniDB's epno on its numeric part).
//      Handles partial, non-contiguous, and out-of-order sets.
//   2. startEpisodeNumber — offset natural-sort index pairing so a
//      contiguous partial set begins at episode N (e.g. 5 → s01e05).
//   3. default — natural-sort index pairing from episode 1.
// A file that doesn't match the regex falls through to the offset path,
// so a regex over a mixed folder degrades gracefully instead of
// dropping the file.
export const pairEpisodeToFileIndex = ({
  compiledFilenameRegex,
  episodes,
  filename,
  index,
  startEpisodeNumber,
}: {
  compiledFilenameRegex: RegExp | null
  episodes: AnidbEpisode[]
  filename: string
  index: number
  startEpisodeNumber: number
}): {
  episode: AnidbEpisode | undefined
  sequentialIndex: number
} => {
  if (compiledFilenameRegex) {
    const episodeNumber = extractEpisodeNumberFromFilename(
      filename,
      compiledFilenameRegex,
    )
    if (episodeNumber != null) {
      return {
        episode: episodes.find(
          (candidate) =>
            Number(
              candidate.epno.replace(/[^0-9]/g, ""),
            ) === episodeNumber,
        ),
        sequentialIndex: episodeNumber,
      }
    }
  }
  const startOffset = startEpisodeNumber - 1
  return {
    episode: episodes.at(index + startOffset),
    sequentialIndex: index + 1 + startOffset,
  }
}

// Sanity-check the duration of a file paired by index against its
// AniDB episode's reported `length`. Uses the rounding-aware
// effective delta so a 32m file paired with a 35m AniDB episode
// (which AniDB rounded up from somewhere in 31–35) doesn't trigger
// a false positive. Logs a warning when the file is outside the
// rounding window plus DURATION_MISMATCH_SLACK_MINUTES of fuzz; the
// rename itself proceeds either way — this is advisory.
const warnIfDurationMismatch = ({
  episode,
  fileMinutes,
  fileName,
}: {
  episode: AnidbEpisode
  fileMinutes: number | null
  fileName: string
}) => {
  if (fileMinutes == null || episode.length == null) {
    return
  }
  const effectiveDelta = effectiveDurationDeltaMinutes(
    fileMinutes,
    episode.length,
  )
  if (effectiveDelta <= DURATION_MISMATCH_SLACK_MINUTES) {
    return
  }
  logInfo(
    "DURATION MISMATCH",
    `${fileName} (${fileMinutes}m)`,
    `epno=${episode.epno} (${episode.length}m, Δ ${effectiveDelta}m beyond AniDB's rounding window)`,
  )
}

// When AniDB's filtered list contains both a "complete" entry and
// "Part N" entries for the same content, surface a one-time prompt so
// the user can pick which form matches their files. Returns the
// narrowed episode list. Returns the input untouched when no
// ambiguity is detected.
const resolveMovieFormatVariant = (
  episodes: AnidbEpisode[],
  category: AnidbEpisodeCategory,
) => {
  const variants = detectMovieFormatVariants(episodes)
  if (!variants) {
    return of(episodes)
  }
  const completePreview = variants.complete
    .slice(0, 2)
    .map((ep) => pickEpisodeTitle(ep.titles))
    .filter((title) => title.length > 0)
    .join(" / ")
  const partsPreview = variants.parts
    .slice(0, 3)
    .map((ep) => pickEpisodeTitle(ep.titles))
    .filter((title) => title.length > 0)
    .join(" / ")
  return getUserSearchInput({
    message: `AniDB lists both a "Complete" form and "Part N" forms for these ${category} episodes. Which describes your files?`,
    options: [
      {
        index: 0,
        label: `Complete (${variants.complete.length} entr${variants.complete.length === 1 ? "y" : "ies"}: ${completePreview})`,
      },
      {
        index: 1,
        label: `Parts (${variants.parts.length} entries: ${partsPreview})`,
      },
      { index: -1, label: "Cancel renaming (Esc)" },
    ],
  }).pipe(
    map((selectedIndex) => {
      if (selectedIndex === -1) {
        throw new Error("Renaming cancelled by user.")
      }
      return selectedIndex === 0
        ? variants.complete
        : variants.parts
    }),
  )
}

export const nameAnimeEpisodesAniDB = ({
  anidbId,
  episodeType = "regular",
  filenameRegex,
  searchTerm,
  seasonNumber,
  seriesName: seriesNameOverride,
  sourcePath,
  startEpisodeNumber = 1,
}: {
  anidbId?: number
  episodeType?: AnidbEpisodeCategory
  filenameRegex?: string
  searchTerm?: string
  seasonNumber: number
  seriesName?: string
  sourcePath: string
  startEpisodeNumber?: number
}) =>
  getFiles({ sourcePath }).pipe(
    toArray(),
    map((fileInfos) =>
      (anidbId != null
        ? of(anidbId)
        : searchAnidb(
            searchTerm || basename(sourcePath),
          ).pipe(
            switchMap((results) => {
              if (results.length === 0) {
                throw new Error(
                  `No AniDB results for: ${searchTerm || basename(sourcePath)}`,
                )
              }

              return getUserSearchInput({
                message: `AniDB results for "${searchTerm || basename(sourcePath)}":`,
                options: [
                  ...results.map((result, index) => ({
                    index,
                    label: `${result.name} (aid ${result.aid})`,
                  })),
                  { index: -1, label: "Cancel / skip" },
                ],
              }).pipe(
                map((selectedIndex) => {
                  if (selectedIndex === -1)
                    throw new Error("No selection made.")
                  return results.at(selectedIndex)?.aid
                }),
              )
            }),
            filter(Boolean),
          )
      ).pipe(
        concatMap((aid) =>
          lookupAnidbById(aid).pipe(
            map((anime) => ({ aid, anime })),
          ),
        ),
        concatMap(({ aid, anime }) => {
          if (!anime)
            throw new Error(
              "AniDB returned no anime payload.",
            )
          const filtered = filterAndSortByCategory(
            anime.episodes,
            episodeType,
          )
          const seriesName = resolveSeriesName(
            seriesNameOverride,
            anime.titles,
          )
          const seriesFolderName = formatSeriesFolderName({
            anidbId: aid,
            seriesName,
          })
          return resolveMovieFormatVariant(
            filtered,
            episodeType,
          ).pipe(
            map((episodes) => ({
              episodes,
              seriesFolderName,
              seriesName,
            })),
          )
        }),
        concatMap(
          ({ episodes, seriesFolderName, seriesName }) => {
            const sortedFileInfos = naturalSort(
              fileInfos,
            ).by({ asc: (fileInfo) => fileInfo.filename })
            const videoFileInfos$ = from(
              sortedFileInfos,
            ).pipe(filterIsVideoFile())

            if (isPickerCategory(episodeType)) {
              // Picker categories use a per-file interactive picker
              // (length-matched candidates). Materialize the sorted
              // video files first so matchSpecialsToFiles can
              // claim/skip/cancel each one in turn.
              return videoFileInfos$.pipe(
                toArray(),
                concatMap((videoFileInfos) =>
                  matchSpecialsToFiles({
                    fileInfos: videoFileInfos,
                    specials: episodes,
                  }).pipe(
                    toArray(),
                    concatMap((matches) =>
                      from(
                        matches.map((match, index) => ({
                          fileInfo: match.fileInfo,
                          episode: match.episode,
                          sequentialIndex: index + 1,
                        })),
                      ),
                    ),
                  ),
                ),
                mergeMap(
                  ({
                    fileInfo,
                    episode,
                    sequentialIndex,
                  }) => {
                    const title = pickEpisodeTitle(
                      episode.titles,
                    )
                    if (!title) {
                      logInfo(
                        "NO EPISODE TITLE",
                        fileInfo.filename,
                        `(epno=${episode.epno})`,
                      )
                      return EMPTY
                    }
                    return of({
                      fileInfo,
                      renamedFilename: formatOutputFilename(
                        {
                          category: episodeType,
                          episode,
                          episodeTitle: title,
                          seasonNumber,
                          sequentialIndex,
                          seriesName,
                        },
                      ),
                      seriesFolderName,
                    })
                  },
                ),
              )
            }

            // regular + others share index-based pairing. By default the
            // 0-based file index against the sorted video list picks the
            // episode (sequentialIndex is 1-based for filename use), but
            // filenameRegex (pair by extracted episode number) or
            // startEpisodeNumber (offset the index) override that for
            // partial / non-contiguous sets. Each pair also reads the
            // file's mediainfo duration and warns when the file/episode
            // lengths diverge — advisory, the rename still applies.
            const compiledFilenameRegex =
              compileFilenameRegex(filenameRegex)
            return videoFileInfos$.pipe(
              map((fileInfo, index) => {
                const { episode, sequentialIndex } =
                  pairEpisodeToFileIndex({
                    compiledFilenameRegex,
                    episodes,
                    filename: fileInfo.filename,
                    index,
                    startEpisodeNumber,
                  })
                return {
                  episode,
                  fileInfo,
                  sequentialIndex,
                }
              }),
              concatMap(
                ({
                  episode,
                  fileInfo,
                  sequentialIndex,
                }) => {
                  if (!episode) {
                    logInfo(
                      "NO EPISODE FOR FILE",
                      fileInfo.filename,
                    )
                    return EMPTY
                  }
                  // A missing episode title no longer drops the file —
                  // AniDB may not have published titles yet for a
                  // currently-airing series. Name it without the title
                  // segment (see formatOutputFilename) so the rename lands
                  // and stays re-runnable once the title exists.
                  const title = pickEpisodeTitle(
                    episode.titles,
                  )
                  if (!title) {
                    logInfo(
                      "NO EPISODE TITLE",
                      fileInfo.filename,
                      `(epno=${episode.epno}) — naming without title`,
                    )
                  }
                  return readMediaDurationMinutes(
                    fileInfo.fullPath,
                  ).pipe(
                    map((fileMinutes) => {
                      warnIfDurationMismatch({
                        episode,
                        fileMinutes,
                        fileName: fileInfo.filename,
                      })
                      return {
                        fileInfo,
                        renamedFilename:
                          formatOutputFilename({
                            category: episodeType,
                            episode,
                            episodeTitle: title,
                            seasonNumber,
                            sequentialIndex,
                            seriesName,
                          }),
                        seriesFolderName,
                      }
                    }),
                  )
                },
              ),
            )
          },
        ),
      ),
    ),
    toArray(),
    mergeAll(),
    mergeAll(),
    withFileProgress(
      ({ fileInfo, renamedFilename, seriesFolderName }) =>
        fileInfo.renameFile(renamedFilename).pipe(
          map((result) => ({
            ...result,
            seriesFolderName,
          })),
        ),
      { concurrency: Infinity },
    ),
    logAndRethrowPipelineError(nameAnimeEpisodesAniDB),
  )
