import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { changeTrackLanguages } from "../app-commands/changeTrackLanguages.js"
import {
  type Iso6392LanguageCode,
  iso6392LanguageCodes,
} from "../tools/iso6392LanguageCodes.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 changeTrackLanguages "G:\\Anime\\dot.hack--SIGN" --subs-lang eng',
      "This changes the subtitles language to English where it was incorrectly set to Japanese. This is best used after removing subtitle languages you don't want as it sets all subtitles tracks to English.",
    )
    .example(
      '$0 changeTrackLanguages "G:\\Anime\\Code Geass" --audio-lang jpn',
      "Changes the audio language to Japanese where it may have been missing (set as undefined). This can be powerful when used with the keepLanguages command.",
    )
    .example(
      '$0 changeTrackLanguages "G:\\Movies\\Osmosis Jones" --video-lang eng',
      "Pretty much every media file will have the video language set to English even if it's a foreign media file. In some cases this language is undefined, so you may want to change it back to English. It's also possible you want to set the video language based on the content for better searching and sorting.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Directory with containing media files with tracks you want to copy.",
      type: "string",
    })
    .option("audioLanguage", {
      alias: "audio-lang",
      choices: iso6392LanguageCodes,
      describe:
        "A 3-letter ISO-6392 language code for audio tracks to keep. All others will be removed",
      type: "string",
    })
    .option("isRecursive", {
      alias: "r",
      boolean: true,
      default: false,
      describe:
        "Recursively looks in folders for media files.",
      nargs: 0,
      type: "boolean",
    })
    .option("subtitlesLanguage", {
      alias: "subs-lang",
      choices: iso6392LanguageCodes,
      describe:
        "A 3-letter ISO-6392 language code for subtitles tracks to keep. All others will be removed",
      type: "string",
    })
    .option("videoLanguage", {
      alias: "video-lang",
      choices: iso6392LanguageCodes,
      describe:
        "A 3-letter ISO-6392 language code for subtitles tracks to keep. All others will be removed",
      type: "string",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const changeTrackLanguagesCommand: CommandModule<
  {},
  Args
> = {
  command: "changeTrackLanguages <sourcePath>",
  describe:
    "Change the language of all video, audio, or subtitles tracks. This is useful when your media files had the wrong language set. For example, if the English subtitles track was listed as Japanese because it translates the Japanese audio.",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    changeTrackLanguages({
      audioLanguage: argv.audioLanguage as
        | Iso6392LanguageCode
        | undefined,
      isRecursive: argv.isRecursive,
      sourcePath: argv.sourcePath,
      subtitlesLanguage: argv.subtitlesLanguage as
        | Iso6392LanguageCode
        | undefined,
      videoLanguage: argv.videoLanguage as
        | Iso6392LanguageCode
        | undefined,
    }).subscribe(subscribeCli())
  },
}
