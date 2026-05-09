import {
  concat,
  concatMap,
  filter,
  map,
  of,
  take,
} from "rxjs"

import {
  getMediaInfo,
} from "../tools/getMediaInfo.js"
import { convertDurationToTimecode, getFileDuration } from "../tools/getFileDuration.js"

export const getChaptersOld = (
  filePath: string,
) => (
  getMediaInfo(
    filePath
  )
  .pipe(
    filter(
      Boolean
    ),
    concatMap((
      mediaInfo,
    ) => (
      concat(
        (
          of(
            mediaInfo
            .media
          )
          .pipe(
            filter(
              Boolean
            ),
            concatMap(({
              track,
            }) => (
              track
            )),
            filter((
              track,
            ) => (
              (
                track
                ["@type"]
              )
              === "Menu"
            )),
            filter((
              track,
            ) => (
              Boolean(
                track
              )
            )),
            take(1),
            concatMap(({
              extra,
            }) => (
              Object
              .entries(
                extra
              )
            )),
            map(([
              timecode,
              name,
            ]) => ({
              name,
              timecode: (
                timecode
                .replace(
                  /_(\d{2})_(\d{2})_(\d{2})_(\d{3})/,
                  "$1:$2:$3.$4",
                )
              ),
            })),
          )
        ),
        (
          getFileDuration({
            mediaInfo,
          })
          .pipe(
            map((
              duration,
            ) => ({
              name: "",
              timecode: (
                convertDurationToTimecode(
                  duration
                )
              ),
            })),
          )
        ),
      )
    )),
  )
)
