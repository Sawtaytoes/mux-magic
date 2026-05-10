import {
  concatMap,
  EMPTY,
  from,
  Observable,
  of,
} from "rxjs"

import type { AnidbEpisode } from "../types/anidb.js"
import { effectiveDurationDeltaMinutes, letterPrefixForType } from "../types/anidb.js"
import type { FileInfo } from "./getFiles.js"
import { getUserSearchInput } from "./getUserSearchInput.js"
import { readMediaDurationMinutes } from "./readMediaDurationMinutes.js"

// AniDB stores episode `length` in rounded minutes (so a 32m45s OVA
// shows up as 33). File durations come from mediainfo as a float in
// seconds, normalized to whole minutes by readMediaDurationMinutes.
// Both forms feed into the |minute delta| ranking that drives the
// per-file picker.
const MAX_PICKER_OPTIONS = 5

// Sentinel selectedIndex values returned by the prompt UI:
//   -1 → skip this file (Space in builder, "-1" in CLI)
//   -2 → cancel renaming entirely (Esc in builder, "-2" in CLI)
//        Already-confirmed matches still apply; remaining files are
//        not prompted at all.
const PICKER_INDEX_SKIP = -1
const PICKER_INDEX_CANCEL = -2

export type MatchedSpecial = {
  episode: AnidbEpisode
  fileInfo: FileInfo
}

// Format a single picker row: "S20  Memory Snow                (32m, ✓)".
// Width-padded epno + title so a stack of options reads as a column.
// The trailing parenthetical shows the AniDB length plus a match
// indicator that accounts for AniDB's rounding (✓ when the file is
// within the rounding window; otherwise the effective Δ).
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
  const effectiveDelta = effectiveDurationDeltaMinutes(fileMinutes, episode.length)
  const matchIndicator = effectiveDelta === 0 ? "✓" : `Δ ${effectiveDelta}m`
  return `${labelEpno}  ${titleColumn} (${episode.length}m, ${matchIndicator})`
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

// Rank still-available episodes for one file by *effective* delta —
// distance outside AniDB's rounding window for that episode's length
// (see effectiveDurationDeltaMinutes). Within-window episodes share
// the top spot; ties resolve by AniDB's natural order (specials
// before trailers before credits) since the caller passes
// `availableEpisodes` already sorted that way. Truncates to the top
// N options so the picker stays readable.
const rankCandidatesForFile = (
  fileMinutes: number | null,
  availableEpisodes: AnidbEpisode[],
): AnidbEpisode[] => {
  if (fileMinutes == null) {
    return availableEpisodes.slice(0, MAX_PICKER_OPTIONS)
  }
  return availableEpisodes
  .map((episode) => ({
    delta: episode.length != null
      ? effectiveDurationDeltaMinutes(fileMinutes, episode.length)
      : Number.POSITIVE_INFINITY,
    episode,
  }))
  .sort((itemA, itemB) => itemA.delta - itemB.delta)
  .slice(0, MAX_PICKER_OPTIONS)
  .map((entry) => entry.episode)
}

// Drives the per-file picker. Walks files sequentially (concatMap),
// reads each file's duration via mediainfo, prompts the user with
// length-ranked candidates, and emits a MatchedSpecial when the user
// picks one.
//
// Three exit signals from the picker:
//   - selectedIndex >= 0   → claim that candidate, emit a match
//   - PICKER_INDEX_SKIP    → skip this file silently
//   - PICKER_INDEX_CANCEL  → set the cancel flag; subsequent files
//                            short-circuit to EMPTY without prompting.
//                            Matches already emitted still flow
//                            downstream so the rename pipeline
//                            applies what the user confirmed.
//
// `availableEpisodes` is mutated in place so already-claimed episodes
// don't reappear in subsequent prompts.
export const matchSpecialsToFiles = ({
  fileInfos,
  specials,
}: {
  fileInfos: FileInfo[]
  specials: AnidbEpisode[]
}): Observable<MatchedSpecial> => {
  const availableEpisodes = specials.slice()
  // Closure flag flipped by the picker's cancel branch. Every
  // outer-loop iteration consults this before doing anything, so
  // post-cancel files never read mediainfo or hit the prompt UI.
  let isCancelled = false

  return from(fileInfos)
  .pipe(
    concatMap((fileInfo) => {
      if (isCancelled || availableEpisodes.length === 0) {
        return EMPTY
      }
      return readMediaDurationMinutes(fileInfo.fullPath)
      .pipe(
        concatMap((fileMinutes) => {
          if (isCancelled || availableEpisodes.length === 0) {
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
              { index: PICKER_INDEX_SKIP, label: "Skip this file (Space)" },
              { index: PICKER_INDEX_CANCEL, label: "Cancel renaming — keep matches so far (Esc)" },
            ],
          })
          .pipe(
            concatMap((selectedIndex) => {
              if (selectedIndex === PICKER_INDEX_CANCEL) {
                isCancelled = true
                return EMPTY
              }
              if (selectedIndex === PICKER_INDEX_SKIP) {
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
    }),
  )
}
