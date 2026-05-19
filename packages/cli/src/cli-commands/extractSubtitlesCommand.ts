import { extractSubtitles } from "@mux-magic/core/src/app-commands/extractSubtitles.js"
import {
  type Iso6392LanguageCode,
  iso6392LanguageCodes,
} from "@mux-magic/core/src/tools/iso6392LanguageCodes.js"
import { subscribeCli } from "@mux-magic/core/src/tools/subscribeCli.js"
import { subtitleTypeExtensions } from "@mux-magic/core/src/tools/subtitleTypes.js"
import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const typesModeChoices = [
  "none",
  "include",
  "exclude",
] as const

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 extractSubtitles "~/anime/Zegapain" -r --subtitlesLanguages eng jpn --typesMode exclude --subtitleTypes sup',
      "Recursively extract every subtitle track in eng/jpn across the folder, but skip image-format (.sup) tracks.",
    )
    .epilog(
      "Migration: --subtitlesLanguage (singular) was renamed to --subtitlesLanguages (array). Pass space-separated codes: --subtitlesLanguages eng jpn.",
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
    .option("subtitlesLanguages", {
      alias: "subs-langs",
      array: true,
      choices: iso6392LanguageCodes,
      default: [] as ReadonlyArray<Iso6392LanguageCode>,
      describe:
        "ISO-639-2 codes of subtitle tracks to extract. Empty = all languages.",
      type: "string",
    })
    .option("typesMode", {
      choices: typesModeChoices,
      default: "none" as (typeof typesModeChoices)[number],
      describe:
        "How to apply --subtitleTypes: 'none' ignores the list (extract all types), 'include' keeps only listed types, 'exclude' skips listed types.",
      type: "string",
    })
    .option("subtitleTypes", {
      array: true,
      choices: subtitleTypeExtensions,
      default: [] as ReadonlyArray<
        (typeof subtitleTypeExtensions)[number]
      >,
      describe:
        "Subtitle format extensions (ass/srt/sup/sub) the type filter operates on. Ignored when --typesMode is 'none'.",
      type: "string",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const extractSubtitlesCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "extractSubtitles <sourcePath>",
  describe:
    "Extract subtitle tracks into separate files alongside each video file.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    extractSubtitles({
      isRecursive: argv.isRecursive,
      sourcePath: argv.sourcePath,
      subtitleTypes: argv.subtitleTypes,
      subtitlesLanguages:
        argv.subtitlesLanguages as ReadonlyArray<Iso6392LanguageCode>,
      typesMode: argv.typesMode,
    }).subscribe(subscribeCli())
  },
}
