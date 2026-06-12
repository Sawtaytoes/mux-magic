import type { LanguageSelection } from "@mux-magic/api/src/api/languageSelection.js"
import { runMkvPropEdit } from "./runMkvPropEdit.js"

export const updateTrackLanguage = ({
  filePath,
  languageSelection,
  trackId,
}: {
  filePath: string
  languageSelection: LanguageSelection
  trackId: number
}) =>
  runMkvPropEdit({
    args: [
      "--edit",
      `track:@${trackId}`,

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
  })
