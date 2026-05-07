import { basename } from "node:path"
import {
  EMPTY,
  concatMap,
  filter,
  from,
  map,
  mergeAll,
  mergeMap,
  of,
  switchMap,
  toArray,
} from "rxjs"

import type { AnidbAnime, AnidbEpisode, AnidbEpisodeCategory } from "../types/anidb.js"
import { episodeTypesForCategory, epnoOrderingValue } from "../types/anidb.js"
import { logAndRethrow } from "../tools/logAndRethrow.js"
import { cleanupFilename } from "../tools/cleanupFilename.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { getFiles } from "../tools/getFiles.js"
import { getUserSearchInput } from "../tools/getUserSearchInput.js"
import { logInfo } from "../tools/logMessage.js"
import { lookupAnidbById, pickAnidbSeriesName, searchAnidb } from "../tools/searchAnidb.js"
import { matchSpecialsToFiles } from "../tools/matchSpecialsToFiles.js"
import { naturalSort } from "../tools/naturalSort.js"
import { withFileProgress } from "../tools/progressEmitter.js"

// Episode title preference: English → x-jat (romaji) → first available.
const pickEpisodeTitle = (
  titles: AnidbAnime["episodes"][number]["titles"],
): string => (
  titles.find((t) => t.lang === "en")?.value
  ?? titles.find((t) => t.lang === "x-jat")?.value
  ?? titles[0]?.value
  ?? ""
)

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
  const allowedTypes = new Set<number>(episodeTypesForCategory(category))
  return episodes
    .filter((ep) => allowedTypes.has(ep.type))
    .slice()
    .sort((a, b) => epnoOrderingValue(a.type, a.epno) - epnoOrderingValue(b.type, b.epno))
}

// Output filename builder. Three formats branch on category:
//   regular  → uses AniDB's epno verbatim so a re-run with the same
//              file order produces stable filenames (epno is the
//              canonical "this is episode N" reference).
//   others   → sequential index (1, 2, 3...) under the user's
//              seasonNumber. The AniDB epno here is "O1", "O2"... —
//              not user-friendly in a Plex library, so we drop it.
//   specials → Plex's specials convention: season 0, sequential
//              index. The Plex scanner pulls these into the
//              "Specials" virtual season regardless of the AniDB
//              type prefix.
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
  const padTwo = (value: number | string): string => String(value).padStart(2, "0")
  if (category === "regular") {
    return cleanupFilename(
      seriesName.concat(
        " - ",
        "s", padTwo(seasonNumber),
        "e", padTwo(episode.epno),
        " - ", episodeTitle,
      ),
    )
  }
  if (category === "specials") {
    return cleanupFilename(
      seriesName.concat(
        " - ",
        "s00",
        "e", padTwo(sequentialIndex),
        " - ", episodeTitle,
      ),
    )
  }
  // others
  return cleanupFilename(
    seriesName.concat(
      " - ",
      "s", padTwo(seasonNumber),
      "e", padTwo(sequentialIndex),
      " - ", episodeTitle,
    ),
  )
}

export const nameAnimeEpisodesAniDB = ({
  anidbId,
  episodeType = "regular",
  searchTerm,
  seasonNumber,
  sourcePath,
}: {
  anidbId?: number,
  episodeType?: AnidbEpisodeCategory,
  searchTerm?: string,
  seasonNumber: number,
  sourcePath: string,
}) => (
  getFiles({ sourcePath })
  .pipe(
    toArray(),
    map((fileInfos) => (
      (
        anidbId != null
          ? of(anidbId)
          : (
            searchAnidb(searchTerm || basename(sourcePath))
            .pipe(
              switchMap((results) => {
                if (results.length === 0) {
                  throw new Error(`No AniDB results for: ${searchTerm || basename(sourcePath)}`)
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
                })
                .pipe(
                  map((selectedIndex) => {
                    if (selectedIndex === -1) throw new Error("No selection made.")
                    return results.at(selectedIndex)!.aid
                  }),
                )
              }),
              filter(Boolean),
            )
          )
      )
      .pipe(
        concatMap((aid) => lookupAnidbById(aid)),
        map((anime) => {
          if (!anime) throw new Error("AniDB returned no anime payload.")
          return {
            episodes: filterAndSortByCategory(anime.episodes, episodeType),
            seriesName: pickAnidbSeriesName(anime.titles),
          }
        }),
        concatMap(({ episodes, seriesName }) => {
          const sortedFileInfos = naturalSort(fileInfos).by({ asc: (fileInfo) => fileInfo.filename })
          const videoFileInfos$ = from(sortedFileInfos).pipe(filterIsVideoFile())

          if (episodeType === "specials") {
            // Specials use a per-file interactive picker (length-matched
            // candidates). Materialize the sorted video files first so
            // matchSpecialsToFiles can claim/skip each one in turn.
            return videoFileInfos$.pipe(
              toArray(),
              concatMap((videoFileInfos) => (
                matchSpecialsToFiles({ fileInfos: videoFileInfos, specials: episodes })
                .pipe(
                  toArray(),
                  concatMap((matches) => from(matches.map((match, index) => ({
                    fileInfo: match.fileInfo,
                    episode: match.episode,
                    sequentialIndex: index + 1,
                  })))),
                )
              )),
              mergeMap(({ fileInfo, episode, sequentialIndex }) => {
                const title = pickEpisodeTitle(episode.titles)
                if (!title) {
                  logInfo("NO EPISODE TITLE", fileInfo.filename, `(epno=${episode.epno})`)
                  return EMPTY
                }
                return of({
                  fileInfo,
                  renamedFilename: formatOutputFilename({
                    category: "specials",
                    episode,
                    episodeTitle: title,
                    seasonNumber,
                    sequentialIndex,
                    seriesName,
                  }),
                })
              }),
            )
          }

          // regular + others share index-based pairing. The pair index is
          // 0-based against the sorted video file list; sequentialIndex
          // is 1-based for filename use.
          return videoFileInfos$.pipe(
            map((fileInfo, index) => ({
              episode: episodes.at(index),
              fileInfo,
              sequentialIndex: index + 1,
            })),
            mergeMap(({ episode, fileInfo, sequentialIndex }) => {
              if (!episode) {
                logInfo("NO EPISODE FOR FILE", fileInfo.filename)
                return EMPTY
              }
              const title = pickEpisodeTitle(episode.titles)
              if (!title) {
                logInfo("NO EPISODE TITLE", fileInfo.filename, `(epno=${episode.epno})`)
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
            }),
          )
        }),
      )
    )),
    toArray(),
    mergeAll(),
    mergeAll(),
    withFileProgress(({ fileInfo, renamedFilename }) => fileInfo.renameFile(renamedFilename), { concurrency: Infinity }),
    logAndRethrow(nameAnimeEpisodesAniDB),
  )
)
