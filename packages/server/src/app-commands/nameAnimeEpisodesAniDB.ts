import { basename } from "node:path"
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
import { cleanupFilename } from "../tools/cleanupFilename.js"
import { detectMovieFormatVariants } from "../tools/detectMovieFormatVariants.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { getFiles } from "../tools/getFiles.js"
import { getUserSearchInput } from "../tools/getUserSearchInput.js"
import { logAndRethrow } from "../tools/logAndRethrow.js"
import { logInfo } from "../tools/logMessage.js"
import { matchSpecialsToFiles } from "../tools/matchSpecialsToFiles.js"
import { naturalSort } from "../tools/naturalSort.js"
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
): string =>
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
const formatOutputFilename = ({
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
}): string => {
  const padTwo = (value: number | string): string =>
    String(value).padStart(2, "0")
  if (category === "regular") {
    return cleanupFilename(
      seriesName.concat(
        " - ",
        "s",
        padTwo(seasonNumber),
        "e",
        padTwo(episode.epno),
        " - ",
        episodeTitle,
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
        " - ",
        episodeTitle,
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
      " - ",
      episodeTitle,
    ),
  )
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
}): void => {
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
  searchTerm,
  seasonNumber,
  sourcePath,
}: {
  anidbId?: number
  episodeType?: AnidbEpisodeCategory
  searchTerm?: string
  seasonNumber: number
  sourcePath: string
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
        concatMap((aid) => lookupAnidbById(aid)),
        concatMap((anime) => {
          if (!anime)
            throw new Error(
              "AniDB returned no anime payload.",
            )
          const filtered = filterAndSortByCategory(
            anime.episodes,
            episodeType,
          )
          const seriesName = pickAnidbSeriesName(
            anime.titles,
          )
          return resolveMovieFormatVariant(
            filtered,
            episodeType,
          ).pipe(
            map((episodes) => ({ episodes, seriesName })),
          )
        }),
        concatMap(({ episodes, seriesName }) => {
          const sortedFileInfos = naturalSort(fileInfos).by(
            { asc: (fileInfo) => fileInfo.filename },
          )
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
                    renamedFilename: formatOutputFilename({
                      category: episodeType,
                      episode,
                      episodeTitle: title,
                      seasonNumber,
                      sequentialIndex,
                      seriesName,
                    }),
                  })
                },
              ),
            )
          }

          // regular + others share index-based pairing. The pair index
          // is 0-based against the sorted video file list;
          // sequentialIndex is 1-based for filename use. Each pair
          // also reads the file's mediainfo duration and warns when
          // the file/episode lengths diverge — advisory, the rename
          // still applies.
          return videoFileInfos$.pipe(
            map((fileInfo, index) => ({
              episode: episodes.at(index),
              fileInfo,
              sequentialIndex: index + 1,
            })),
            concatMap(
              ({ episode, fileInfo, sequentialIndex }) => {
                if (!episode) {
                  logInfo(
                    "NO EPISODE FOR FILE",
                    fileInfo.filename,
                  )
                  return EMPTY
                }
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
                    }
                  }),
                )
              },
            ),
          )
        }),
      ),
    ),
    toArray(),
    mergeAll(),
    mergeAll(),
    withFileProgress(
      ({ fileInfo, renamedFilename }) =>
        fileInfo.renameFile(renamedFilename),
      { concurrency: Infinity },
    ),
    logAndRethrow(nameAnimeEpisodesAniDB),
  )
