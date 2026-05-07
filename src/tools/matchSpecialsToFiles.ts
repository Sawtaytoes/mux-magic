import {
  concatMap,
  EMPTY,
  from,
  map,
  Observable,
  of,
} from "rxjs"

import type { AnidbEpisode } from "../types/anidb.js"
import { letterPrefixForType } from "../types/anidb.js"
import type { FileInfo } from "./getFiles.js"
import { getMediaInfo } from "./getMediaInfo.js"
import { getUserSearchInput } from "./getUserSearchInput.js"

// AniDB stores episode `length` in rounded minutes (so a 32m45s OVA
// shows up as 33). File durations come from mediainfo as a float in
// seconds, with the General track being the authoritative one for the
// container. Both forms convert to whole minutes here so the diff that
// drives candidate ranking is apples-to-apples.
const MAX_PICKER_OPTIONS = 5

export type MatchedSpecial = {
  episode: AnidbEpisode
  fileInfo: FileInfo
}

const readDurationMinutes = (
  filePath: string,
): Observable<number | null> => (
  getMediaInfo(filePath)
  .pipe(
    map((mediaInfo) => {
      const tracks = mediaInfo.media?.track ?? []
      const generalTrack = tracks.find((track) => track["@type"] === "General")
      if (!generalTrack || !generalTrack.Duration) {
        return null
      }
      const seconds = Number(generalTrack.Duration)
      if (!Number.isFinite(seconds)) {
        return null
      }
      return Math.round(seconds / 60)
    }),
  )
)

// Format a single picker row: "S20  Memory Snow                (32m, Δ 0.4m)".
// Width-padded epno + title so a stack of options reads as a column.
const formatCandidateLabel = (
  episode: AnidbEpisode,
  episodeTitle: string,
  fileMinutes: number | null,
): string => {
  const prefix = letterPrefixForType(episode.type)
  const numericPart = episode.epno.replace(/[^0-9]/g, "")
  const labelEpno = `${prefix}${numericPart}`.padEnd(4, " ")
  const titleColumn = episodeTitle.padEnd(28, " ").slice(0, 28)
  if (episode.length == null || fileMinutes == null) {
    const lengthColumn = episode.length != null ? `${episode.length}m` : "—"
    return `${labelEpno}  ${titleColumn} (${lengthColumn})`
  }
  const delta = Math.abs(fileMinutes - episode.length)
  return `${labelEpno}  ${titleColumn} (${episode.length}m, Δ ${delta}m)`
}

// Episode title preference matches the rest of the AniDB rename flow:
// English → x-jat (romaji) → first available. Duplicated here rather
// than imported to keep the helper self-contained.
const pickEpisodeTitle = (
  titles: AnidbEpisode["titles"],
): string => (
  titles.find((title) => title.lang === "en")?.value
  ?? titles.find((title) => title.lang === "x-jat")?.value
  ?? titles[0]?.value
  ?? ""
)

// Rank still-available episodes for one file by absolute minute delta,
// then drop to the top N. Ties resolve by AniDB's natural order
// (specials preferred over trailers preferred over credits) since the
// caller passes in `availableEpisodes` already sorted that way.
const rankCandidatesForFile = (
  fileMinutes: number | null,
  availableEpisodes: AnidbEpisode[],
): AnidbEpisode[] => {
  if (fileMinutes == null) {
    return availableEpisodes.slice(0, MAX_PICKER_OPTIONS)
  }
  return availableEpisodes
  .map((episode) => ({
    delta: episode.length != null ? Math.abs(fileMinutes - episode.length) : Number.POSITIVE_INFINITY,
    episode,
  }))
  .sort((a, b) => a.delta - b.delta)
  .slice(0, MAX_PICKER_OPTIONS)
  .map((entry) => entry.episode)
}

// Drives the per-file picker. Walks files sequentially (concatMap),
// reads each file's duration via mediainfo, prompts the user with
// length-ranked candidates, and emits a MatchedSpecial when the user
// picks one. Skipping a file (option 0) drops it from the result.
//
// `availableEpisodes` is mutated in place so already-claimed episodes
// don't reappear in subsequent prompts. The Observable completes after
// every file has been visited.
export const matchSpecialsToFiles = ({
  fileInfos,
  specials,
}: {
  fileInfos: FileInfo[]
  specials: AnidbEpisode[]
}): Observable<MatchedSpecial> => {
  const availableEpisodes = specials.slice()
  return from(fileInfos)
  .pipe(
    concatMap((fileInfo) => (
      readDurationMinutes(fileInfo.fullPath)
      .pipe(
        concatMap((fileMinutes) => {
          if (availableEpisodes.length === 0) {
            return EMPTY
          }
          const candidates = rankCandidatesForFile(fileMinutes, availableEpisodes)
          const fileMinutesLabel = fileMinutes != null ? `${fileMinutes}m` : "unknown duration"
          return getUserSearchInput({
            message: `Match for "${fileInfo.filename}" (${fileMinutesLabel}):`,
            options: [
              ...candidates.map((episode, index) => ({
                index,
                label: formatCandidateLabel(episode, pickEpisodeTitle(episode.titles), fileMinutes),
              })),
              { index: -1, label: "Skip this file" },
            ],
          })
          .pipe(
            concatMap((selectedIndex) => {
              if (selectedIndex === -1) {
                return EMPTY
              }
              const chosen = candidates.at(selectedIndex)
              if (!chosen) {
                return EMPTY
              }
              const claimedAt = availableEpisodes.indexOf(chosen)
              if (claimedAt >= 0) {
                availableEpisodes.splice(claimedAt, 1)
              }
              return of({ episode: chosen, fileInfo })
            }),
          )
        }),
      )
    )),
  )
}
