import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { extractSubtitles } from "../app-commands/extractSubtitles.js"
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
      '$0 extractSubtitles "~/anime/Zegapain" -r',
      "Recursively looks through all folders in '~/anime/Zegapain' and copies out subtitles tracks into a separate folder.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Directory containing media files or containing other directories of media files.",
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
      default:
        "eng" satisfies Iso6392LanguageCode as Iso6392LanguageCode,
      describe:
        "A 3-letter ISO-6392 language code for subtitles tracks to keep. All others will be removed",
      type: "string",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const extractSubtitlesCommand: CommandModule<
  {},
  Args
> = {
  command: "extractSubtitles <sourcePath>",
  describe:
    "Extract subtitle tracks into separate files alongside each video file.",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    extractSubtitles({
      isRecursive: argv.isRecursive,
      sourcePath: argv.sourcePath,
      subtitlesLanguage:
        argv.subtitlesLanguage as Iso6392LanguageCode,
    }).subscribe(subscribeCli())
  },
}
