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
  of,
  switchMap,
  toArray,
} from "rxjs"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { formatTitleWithYear } from "../tools/formatTitleWithYear.js"
import { getRandomString } from "../tools/getRandomString.js"
import { getUserSearchInput } from "../tools/getUserSearchInput.js"
import { withFileProgress } from "../tools/progressEmitter.js"
import { searchTvdb } from "../tools/searchTvdb.js"
import { getTvdbFetchClient } from "../tools/tvdbApi.js"

// One TVDB episode, flattened to the strings the output filename needs.
export type TvdbEpisodeSummary = {
  airedYear: string
  episodeName: string
  episodeNumber: string
  seriesName: string
  seasonNumber: string
}

// Filename numbering recognised without the caller configuring
// anything, in precedence order: the Plex/scene "s01e06" form first,
// then the older "1x06" form. Both are anchored on a non-alphanumeric
// boundary so a resolution tag ("1920x1080") or a codec string cannot
// be read as a season and episode.
const DEFAULT_SEASON_EPISODE_PATTERNS = [
  /(?<![a-z0-9])s(?<seasonNumber>\d{1,4})[\s._-]*e(?<episodeNumber>\d{1,4})(?![0-9])/i,
  /(?<![a-z0-9])(?<seasonNumber>\d{1,2})x(?<episodeNumber>\d{1,3})(?![0-9])/i,
]

// Compile the optional filenameRegex once. Throws a descriptive error
// on an invalid pattern so it surfaces on the run card instead of a
// cryptic RegExp SyntaxError. Case-insensitive so "S02E05" / "s02e05"
// both match without the caller thinking about it. Same contract as
// the AniDB naming command's option of the same name.
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

const readNumberedGroup = (
  match: RegExpExecArray,
  groupName: string,
): number | null => {
  const captured = match.groups?.[groupName]
  if (captured == null) {
    return null
  }
  const parsed = Number(captured)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Read the season and episode number out of a filename.
 *
 * `compiledFilenameRegex` (the caller's own pattern) wins when set;
 * otherwise the built-in `s01e06` / `1x06` patterns are tried in
 * order. A pattern with no `(?<episodeNumber>…)` group, or one whose
 * capture is not a number, counts as no match. `seasonNumber` is null
 * when the pattern does not capture one — the file still pairs by its
 * episode number.
 */
export const parseSeasonEpisodeFromFilename = (
  filename: string,
  compiledFilenameRegex: RegExp | null,
): {
  episodeNumber: number
  seasonNumber: number | null
} | null => {
  const patterns =
    compiledFilenameRegex === null
      ? DEFAULT_SEASON_EPISODE_PATTERNS
      : [compiledFilenameRegex]

  return patterns.reduce<{
    episodeNumber: number
    seasonNumber: number | null
  } | null>((found, pattern) => {
    if (found !== null) {
      return found
    }
    const match = pattern.exec(filename)
    if (match === null) {
      return null
    }
    const episodeNumber = readNumberedGroup(
      match,
      "episodeNumber",
    )
    if (episodeNumber === null) {
      return null
    }
    return {
      episodeNumber,
      seasonNumber: readNumberedGroup(
        match,
        "seasonNumber",
      ),
    }
  }, null)
}

/**
 * Decide which TVDB episode a file pairs with. Precedence:
 *   1. the season and episode number in the filename — the file is
 *      paired with the TVDB episode carrying that number, wherever
 *      the file happens to sort. A copy in Downloads does not always
 *      list in TVDB order, and specials sort ahead of season 1.
 *   2. natural-sort index, offset by `startEpisodeNumber`, for a file
 *      whose name carries no numbering at all.
 *
 * A file whose filename names a different season than the one being
 * looked up is REFUSED, not renamed. That case is why this function
 * exists: a folder holding 36 `s00` specials plus season 1 sorted the
 * specials first, and index pairing renamed all of them into season 1
 * episode titles with no error raised anywhere.
 */
export const pairEpisodeToFile = ({
  compiledFilenameRegex,
  episodes,
  filename,
  index,
  seasonNumber,
  startEpisodeNumber,
}: {
  compiledFilenameRegex: RegExp | null
  episodes: TvdbEpisodeSummary[]
  filename: string
  index: number
  seasonNumber: number
  startEpisodeNumber: number
}): {
  episode: TvdbEpisodeSummary | undefined
  skipReason: string | undefined
} => {
  const parsed = parseSeasonEpisodeFromFilename(
    filename,
    compiledFilenameRegex,
  )

  if (parsed === null) {
    return {
      episode: episodes.at(index + startEpisodeNumber - 1),
      skipReason: "NO EPISODE FOR FILE",
    }
  }

  if (
    parsed.seasonNumber !== null &&
    parsed.seasonNumber !== seasonNumber
  ) {
    return {
      episode: undefined,
      skipReason: `WRONG SEASON (filename says season ${parsed.seasonNumber}, this run looked up season ${seasonNumber})`,
    }
  }

  return {
    episode: episodes.find(
      (candidate) =>
        Number(candidate.episodeNumber) ===
        parsed.episodeNumber,
    ),
    skipReason: `NO TVDB EPISODE ${parsed.episodeNumber} IN SEASON ${seasonNumber}`,
  }
}

export const nameTvShowEpisodes = ({
  filenameRegex,
  searchTerm,
  seasonNumber,
  sourcePath,
  startEpisodeNumber = 1,
  tvdbId,
}: {
  filenameRegex?: string
  searchTerm?: string
  seasonNumber: number
  sourcePath: string
  startEpisodeNumber?: number
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
                        label: `${formatTitleWithYear({ title: result.name, year: result.year })}${result.status ? ` [${result.status}]` : ""}`,
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

                      const result =
                        results.at(selectedIndex)
                      if (result == null)
                        throw new Error(
                          "Invalid selection index.",
                        )
                      return result
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
        concatMap((episodes) => {
          // Pair each file to its TVDB episode by the numbering in the
          // filename, falling back to natural-sort order only for a
          // file that carries no numbering at all. A file that names a
          // different season is skipped with a log line rather than
          // renamed into this one.
          const compiledFilenameRegex =
            compileFilenameRegex(filenameRegex)

          return from(
            naturalSort(fileInfos).by({
              asc: (fileInfo) => fileInfo.filename,
            }),
          ).pipe(
            filterIsVideoFile(),
            map((fileInfo, index) => ({
              fileInfo,
              ...pairEpisodeToFile({
                compiledFilenameRegex,
                episodes,
                filename: fileInfo.filename,
                index,
                seasonNumber,
                startEpisodeNumber,
              }),
            })),
            concatMap(
              ({ episode, fileInfo, skipReason }) => {
                if (episode === undefined) {
                  logInfo(
                    "SKIPPED",
                    fileInfo.filename,
                    skipReason ?? "NO EPISODE FOR FILE",
                  )
                  return EMPTY
                }
                return of({
                  fileInfo,
                  renamedFilename: cleanupFilename(
                    [
                      formatTitleWithYear({
                        title: episode.seriesName,
                        year: episode.airedYear,
                      }),
                      " - s",
                      episode.seasonNumber.padStart(2, "0"),
                      "e",
                      episode.episodeNumber.padStart(
                        2,
                        "0",
                      ),
                      " - ",
                      episode.episodeName ||
                        getRandomString(),
                    ].join(""),
                  ),
                })
              },
            ),
          )
        }),
      ),
    ),
    toArray(),
    mergeAll(),
    withFileProgress(
      ({ fileInfo, renamedFilename }) =>
        fileInfo.renameFile(renamedFilename),
      { concurrency: Infinity },
    ),
    logAndRethrowPipelineError(nameTvShowEpisodes),
  )
