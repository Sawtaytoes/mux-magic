import { logAndSwallowPipelineError } from "@mux-magic/tools"
import {
  filter,
  map,
  mergeAll,
  type Observable,
  of,
  take,
} from "rxjs"
import type {
  GeneralTrack,
  MediaInfo,
} from "./getMediaInfo.js"

export const convertNumberToTimeString = (
  number: number,
): string => String(number).padStart(2, "0")

export const convertDurationToDvdCompareTimecode = (
  durationInSeconds: number,
): string => {
  const date = new Date(0, 0, 0, 0, 0, 0)

  date.setSeconds(durationInSeconds)

  return [
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  ]
    .filter((value, index) =>
      index === 0 ? Boolean(value) : true,
    )
    .map((value, index) =>
      index > 0 ? convertNumberToTimeString(value) : value,
    )
    .join(":")
}

export const convertDurationToTimecode = (
  durationInSeconds: number,
): string => {
  const date = new Date(0, 0, 0, 0, 0, 0)

  date.setMilliseconds(durationInSeconds * 1000)

  return [
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  ]
    .map((value) => convertNumberToTimeString(value))
    .join(":")
    .concat(
      ".",
      String(date.getMilliseconds()).padStart(3, "0"),
    )
}

export const getFileDuration = ({
  mediaInfo,
}: {
  mediaInfo: MediaInfo
}): Observable<number> =>
  of(mediaInfo).pipe(
    map(({ media }) => media?.track),
    filter(Boolean),
    mergeAll(),
    filter(
      (track): track is GeneralTrack =>
        track["@type"] === "General",
    ),
    take(1),
    map((generalTrack) => Number(generalTrack.Duration)),
    logAndSwallowPipelineError(getFileDuration),
  )
