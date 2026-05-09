import {
  concatMap,
  filter,
  from,
} from "rxjs"

import {
  getMkvInfo,
  type MkvTookNixTrackType,
} from "../tools/getMkvInfo.js"
import { type Iso6392LanguageCode } from "../tools/iso6392LanguageCodes.js"
import { runMkvPropEdit } from "./runMkvPropEdit.js"

export const defineLanguageForUndefinedTracks = ({
  filePath,
  subtitleLanguage,
  trackType,
}: {
  filePath: string
  subtitleLanguage: Iso6392LanguageCode
  trackType: MkvTookNixTrackType
}) => (
  getMkvInfo(
    filePath,
  )
  .pipe(
    concatMap(({
      tracks
    }) => (
      from(
        tracks
      )
      .pipe(
        filter((
          track,
        ) => (
          (
            track
            .type
          )
          === trackType
        )),
        filter((
          track,
        ) => (
          (
            track
            .properties
            .language
          )
          === "und"
        )),
        concatMap((
          track,
        ) => (
          runMkvPropEdit({
            args: [
              "--edit",
              `track:@${track.properties.number}`,

              "--set",
              `language=${subtitleLanguage}`,
            ],
            filePath,
          })
        )),
      )
    )),
  )
)
