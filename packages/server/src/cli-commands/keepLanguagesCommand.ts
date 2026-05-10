import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"
import { keepLanguages } from "../app-commands/keepLanguages.js"
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
      '$0 keepLanguages "~/movies" -r --firstAudio --firstSubtitles',
      "Recursively looks through media files and only keeps the audio tracks matching the first audio track's language and only subtitles tracks matching the first subtitles track's language.",
    )
    .example(
      '$0 keepLanguages "~/movies" -r --firstAudio --audio-lang eng --firstSubtitles',
      "Recursively looks through media files and only keeps the audio tracks matching the first audio track's language as well as the specified audio language and only subtitles tracks matching the first subtitles track's language. This is useful when movies are in another language, but have english commentary.",
    )
    .example(
      '$0 keepLanguages "~/anime" -r --audio-lang jpn --audio-lang eng --subs-lang eng',
      "Recursively looks through media files and only keeps Japanese and English audio and English subtitles tracks.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe: "Directory where demo files are located.",
      type: "string",
    })
    .option("audioLanguages", {
      alias: "audio-lang",
      array: true,
      choices: iso6392LanguageCodes,
      default: [] satisfies Iso6392LanguageCode[],
      describe:
        "A 3-letter ISO-6392 language code for audio tracks to keep. All others will be removed",
      type: "array",
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
    .option("subtitlesLanguages", {
      alias: "subs-lang",
      array: true,
      choices: iso6392LanguageCodes,
      default: [] satisfies Iso6392LanguageCode[],
      describe:
        "A 3-letter ISO-6392 language code for subtitles tracks to keep. All others will be removed",
      type: "array",
    })
    .option("useFirstAudioLanguage", {
      alias: "firstAudio",
      boolean: true,
      default: false,
      describe:
        "The language of the first audio track is the only language kept for audio tracks.",
      nargs: 0,
      type: "boolean",
    })
    .option("useFirstSubtitlesLanguage", {
      alias: "firstSubtitles",
      boolean: true,
      default: false,
      describe:
        "The language of the first subtitles track is the only language kept for subtitles tracks.",
      nargs: 0,
      type: "boolean",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const keepLanguagesCommand: CommandModule<{}, Args> =
  {
    command: "keepLanguages <sourcePath>",
    describe:
      "Keeps only the specified audio and subtitle languages.",

    builder: builder as CommandBuilder<{}, Args>,

    handler: (argv) => {
      keepLanguages({
        audioLanguages:
          argv.audioLanguages as Iso6392LanguageCode[],
        hasFirstAudioLanguage: argv.useFirstAudioLanguage,
        hasFirstSubtitlesLanguage:
          argv.useFirstSubtitlesLanguage,
        isRecursive: argv.isRecursive,
        sourcePath: argv.sourcePath,
        subtitlesLanguages:
          argv.subtitlesLanguages as Iso6392LanguageCode[],
      }).subscribe(subscribeCli())
    },
  }
