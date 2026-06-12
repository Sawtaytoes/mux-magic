import type { LanguageSelection } from "@mux-magic/api/src/api/languageSelection.js"
import { concatMap, filter, from } from "rxjs"
import {
  getMkvInfo,
  type MkvTookNixTrackType,
} from "../tools/getMkvInfo.js"
import { runMkvPropEdit } from "./runMkvPropEdit.js"

export const defineLanguageForUndefinedTracks = ({
  filePath,
  languageSelection,
  trackType,
}: {
  filePath: string
  languageSelection: LanguageSelection
  trackType: MkvTookNixTrackType
}) =>
  getMkvInfo(filePath).pipe(
    concatMap(({ tracks }) =>
      from(tracks).pipe(
        filter((track) => track.type === trackType),
        filter(
          (track) => track.properties.language === "und",
        ),
        concatMap((track) =>
          runMkvPropEdit({
            args: [
              "--edit",
              `track:@${track.properties.number}`,

              "--set",
              `language=${languageSelection.code}`,

              ...(languageSelection.ietf
                ? [
                    "--set",
                    `language-ietf=${languageSelection.ietf}`,
                  ]
                : []),
            ],
            filePath,
          }),
        ),
      ),
    ),
  )
