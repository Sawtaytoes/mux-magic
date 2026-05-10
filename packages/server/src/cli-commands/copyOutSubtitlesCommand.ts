// @deprecated — `copyOutSubtitles` was renamed to `extractSubtitles`.
// This shim keeps the old CLI invocation working (with a deprecation
// warning) so existing scripts don't break. Remove once those scripts
// have migrated.

import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { copyOutSubtitles } from "../app-commands/copyOutSubtitles.js"
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
      '$0 copyOutSubtitles "~/anime/Zegapain" -r',
      "Deprecated: use 'extractSubtitles'. Recursively copies subtitle tracks into a separate folder alongside each video file.",
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

export const copyOutSubtitlesCommand: CommandModule<
  {},
  Args
> = {
  command: "copyOutSubtitles <sourcePath>",
  describe:
    "[DEPRECATED — use 'extractSubtitles'] Extract subtitle tracks into separate files alongside each video file.",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    copyOutSubtitles({
      isRecursive: argv.isRecursive,
      sourcePath: argv.sourcePath,
      subtitlesLanguage:
        argv.subtitlesLanguage as Iso6392LanguageCode,
    }).subscribe(subscribeCli())
  },
}
