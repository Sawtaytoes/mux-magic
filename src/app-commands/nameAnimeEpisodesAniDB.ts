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

import type { AnidbAnime } from "../types/anidb.js"
import { logAndRethrow } from "../tools/logAndRethrow.js"
import { cleanupFilename } from "../tools/cleanupFilename.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { getFiles } from "../tools/getFiles.js"
import { getUserSearchInput } from "../tools/getUserSearchInput.js"
import { logInfo } from "../tools/logMessage.js"
import { lookupAnidbById, pickAnidbSeriesName, searchAnidb } from "../tools/searchAnidb.js"
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

// AniDB returns episodes unsorted (often newest first in the XML). Filter
// to regular (type 1) episodes and sort by numeric epno so file index N
// lines up with episode N.
const filterAndSortRegularEpisodes = (
  episodes: AnidbAnime["episodes"],
): AnidbAnime["episodes"] => (
  episodes
  .filter((ep) => ep.type === 1)
  .slice()
  .sort((a, b) => Number(a.epno) - Number(b.epno))
)

export const nameAnimeEpisodesAniDB = ({
  anidbId,
  searchTerm,
  seasonNumber,
  sourcePath,
}: {
  anidbId?: number,
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
            episodes: filterAndSortRegularEpisodes(anime.episodes),
            seriesName: pickAnidbSeriesName(anime.titles),
          }
        }),
        concatMap(({ episodes, seriesName }) => (
          from(naturalSort(fileInfos).by({ asc: (fi) => fi.filename }))
          .pipe(
            filterIsVideoFile(),
            map((fileInfo, index) => ({
              episode: episodes.at(index),
              fileInfo,
            })),
            mergeMap(({ episode, fileInfo }) => {
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
                renamedFilename: cleanupFilename(
                  seriesName.concat(
                    " - ",
                    "s", String(seasonNumber).padStart(2, "0"),
                    "e", episode.epno.padStart(2, "0"),
                    " - ", title,
                  ),
                ),
              })
            }),
          )
        )),
      )
    )),
    toArray(),
    mergeAll(),
    mergeAll(),
    withFileProgress(({ fileInfo, renamedFilename }) => fileInfo.renameFile(renamedFilename), { concurrency: Infinity }),
    logAndRethrow(nameAnimeEpisodesAniDB),
  )
)
