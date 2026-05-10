import {
  concatMap,
  filter,
  from,
  map,
  mergeAll,
  switchMap,
  toArray,
} from "rxjs"
import { cleanupFilename } from "../tools/cleanupFilename.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { getFiles } from "../tools/getFiles.js"
import { getRandomString } from "../tools/getRandomString.js"
import { getUserSearchInput } from "../tools/getUserSearchInput.js"
import { logAndRethrow } from "../tools/logAndRethrow.js"
import { naturalSort } from "../tools/naturalSort.js"
import { withFileProgress } from "../tools/progressEmitter.js"
import { searchTvdb } from "../tools/searchTvdb.js"
import { getTvdbFetchClient } from "../tools/tvdbApi.js"

export const nameTvShowEpisodes = ({
  searchTerm,
  seasonNumber,
  sourcePath,
  tvdbId,
}: {
  searchTerm?: string
  seasonNumber: number
  sourcePath: string
  tvdbId?: number
}) =>
  getFiles({
    sourcePath,
  }).pipe(
    toArray(),
    concatMap((fileInfos) =>
      from(getTvdbFetchClient()).pipe(
        concatMap((tvdbFetchClient) =>
          tvdbId != null
            ? tvdbFetchClient.GET(
                "/series/{id}/episodes/{season-type}",
                {
                  params: {
                    path: {
                      id: tvdbId,
                      "season-type": "official",
                    },
                    query: {
                      page: 0,
                      season: seasonNumber,
                    },
                  },
                },
              )
            : searchTvdb(searchTerm ?? "").pipe(
                switchMap((results) => {
                  if (results.length === 0) {
                    throw new Error(
                      `No TVDB results for: ${searchTerm}`,
                    )
                  }

                  return getUserSearchInput({
                    message: `TVDB results for "${searchTerm}":`,
                    options: [
                      ...results.map((result, index) => ({
                        index,
                        label: `${result.name}${result.year ? ` (${result.year})` : ""}${result.status ? ` [${result.status}]` : ""}`,
                      })),
                      {
                        index: -1,
                        label: "Cancel / skip",
                      },
                    ],
                  }).pipe(
                    map((selectedIndex) => {
                      if (selectedIndex === -1)
                        throw new Error(
                          "No selection made.",
                        )

                      return results.at(selectedIndex)!
                    }),
                  )
                }),
                filter(Boolean),
                concatMap((selectedSearchResult) =>
                  tvdbFetchClient.GET(
                    "/series/{id}/episodes/{season-type}",
                    {
                      params: {
                        path: {
                          id: selectedSearchResult.tvdbId,
                          "season-type": "official",
                        },
                        query: {
                          page: 0,
                          season: seasonNumber,
                        },
                      },
                    },
                  ),
                ),
              ),
        ),
        concatMap(({ data }) =>
          from(data?.data?.episodes || []).pipe(
            filter(Boolean),
            map((episode) => ({
              airedYear: String(
                new Date(episode.aired || "").getFullYear(),
              ),
              episodeName: episode.name || "",
              episodeNumber: episode?.number
                ? String(episode?.number)
                : "",
              seriesName: data?.data?.series?.name || "",
              seasonNumber:
                String(episode?.seasonNumber) || "1",
            })),
          ),
        ),
        toArray(),
        concatMap((episodes) =>
          from(
            naturalSort(fileInfos).by({
              asc: (fileInfo) => fileInfo.filename,
            }),
          ).pipe(
            filterIsVideoFile(),
            map((fileInfo, index) => ({
              episode: episodes.at(index),
              fileInfo,
            })),
            filter(({ episode }) => Boolean(episode)),
            map(({ episode, fileInfo }) => ({
              fileInfo,
              renamedFilename: cleanupFilename(
                (episode?.seriesName).concat(
                  " (",
                  episode?.airedYear,
                  ") - ",
                  "s",
                  episode?.seasonNumber.padStart(2, "0"),
                  "e",
                  episode?.episodeNumber.padStart(2, "0"),
                  " - ",
                  episode?.episodeName || getRandomString(),
                ),
              ),
            })),
          ),
        ),
      ),
    ),
    toArray(),
    mergeAll(),
    withFileProgress(
      ({ fileInfo, renamedFilename }) =>
        fileInfo.renameFile(renamedFilename),
      { concurrency: Infinity },
    ),
    logAndRethrow(nameTvShowEpisodes),
  )
