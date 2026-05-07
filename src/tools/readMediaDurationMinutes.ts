import { map, type Observable } from "rxjs"

import { getMediaInfo } from "./getMediaInfo.js"

// AniDB stores `episode.length` as rounded minutes; mediainfo reports
// the General-track Duration as a float in seconds. Both come through
// this helper as whole minutes so the rest of the rename flow can
// compare apples to apples (Δ minutes for picker ranking, Δ minutes
// for the regular-episode sanity warning).
export const readMediaDurationMinutes = (
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
