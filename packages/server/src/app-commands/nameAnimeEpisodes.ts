import { basename } from "node:path"
import {
  cleanupFilename,
  getFiles,
  logAndRethrowPipelineError,
  logInfo,
  naturalSort,
} from "@mux-magic/tools"
import malScraper from "mal-scraper"
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
  zip,
} from "rxjs"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { getUserSearchInput } from "../tools/getUserSearchInput.js"
import { withFileProgress } from "../tools/progressEmitter.js"
import { searchMal } from "../tools/searchMal.js"

export const nameAnimeEpisodes = ({
  malId,
  searchTerm,
  seasonNumber,
  sourcePath,
}: {
  malId?: number
  searchTerm?: string
  seasonNumber: number
  sourcePath: string
}) =>
  getFiles({
    sourcePath,
  }).pipe(
    toArray(),
    map((fileInfos) =>
      (malId != null
        ? of({
            id: String(malId),
            name: "",
            url: `https://myanimelist.net/anime/${malId}`,
          })
        : searchMal(
            searchTerm || basename(sourcePath),
          ).pipe(
            switchMap((results) => {
              if (results.length === 0) {
                throw new Error(
                  `No MAL results for: ${searchTerm || basename(sourcePath)}`,
                )
              }

              return getUserSearchInput({
                message: `MAL results for "${searchTerm || basename(sourcePath)}":`,
                options: [
                  ...results.map((result, index) => ({
                    index,
                    label: `${result.name}${result.airDate ? ` (${result.airDate})` : ""}${result.mediaType ? ` [${result.mediaType}]` : ""}`,
                  })),
                  {
                    index: -1,
                    label: "Cancel / skip",
                  },
                ],
              }).pipe(
                map((selectedIndex) => {
                  if (selectedIndex === -1)
                    throw new Error("No selection made.")

                  const result = results.at(selectedIndex)
                  if (result == null)
                    throw new Error(
                      "Invalid selection index.",
                    )
                  return result
                }),
                map((result) => ({
                  id: String(result.malId),
                  name: result.name,
                  url: `https://myanimelist.net/anime/${result.malId}`,
                })),
              )
            }),
            filter(Boolean),
          )
      )
        .pipe(
          concatMap(({ id, name, url }) =>
            zip(
              malScraper.getInfoFromURL(url),
              malScraper.getEpisodesList({
                id: Number(id),
                name,
              }),
            ),
          ),
        )
        .pipe(
          map(([series, seriesEpisodes]) => ({
            seriesEpisodes,
            seriesName:
              series.englishTitle ||
              series.title ||
              series.synonyms.at(0) ||
              series.japaneseTitle ||
              "",
          })),
          concatMap(({ seriesName, seriesEpisodes }) =>
            from(
              naturalSort(fileInfos).by({
                asc: (fileInfo) => fileInfo.filename,
              }),
            ).pipe(
              filterIsVideoFile(),
              map((fileInfo, index) => ({
                episode: seriesEpisodes.at(index),
                fileInfo,
              })),
              map(({ episode, fileInfo }) => ({
                episodeNumber: episode?.epNumber
                  ? String(episode?.epNumber)
                  : "",
                fileInfo,
                seasonNumber: String(seasonNumber) || "1",
                title:
                  episode?.title ||
                  episode?.japaneseTitle ||
                  "",
              })),
              mergeMap((item) => {
                if (item.title) {
                  return of(item)
                } else {
                  logInfo(
                    "NO EPISODE NAME",
                    item.fileInfo.filename,
                  )

                  return EMPTY
                }
              }),
              map(
                ({
                  episodeNumber,
                  fileInfo,
                  seasonNumber,
                  title,
                }) => ({
                  fileInfo,
                  renamedFilename: cleanupFilename(
                    seriesName.concat(
                      " - ",
                      "s",
                      seasonNumber.padStart(2, "0"),
                      "e",
                      episodeNumber.padStart(2, "0"),
                      " - ",
                      title,
                    ),
                  ),
                }),
              ),
            ),
          ),
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
    logAndRethrowPipelineError(nameAnimeEpisodes),
  )
