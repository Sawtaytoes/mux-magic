import { type Iso6392LanguageCode } from "../tools/iso6392LanguageCodes.js"
import { runMkvPropEdit } from "./runMkvPropEdit.js"

export const updateTrackLanguage = ({
  filePath,
  languageCode,
  trackId,
}: {
  filePath: string
  languageCode: Iso6392LanguageCode
  trackId: number
}) => (
  runMkvPropEdit({
    args: [
      "--edit",
      `track:@${trackId}`,

      "--set",
      `language=${languageCode}`,
    ],
    filePath,
  })
)
