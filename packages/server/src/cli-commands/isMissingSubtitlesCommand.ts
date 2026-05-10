import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { isMissingSubtitles } from "../app-commands/isMissingSubtitles.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 isMissingSubtitles "~/code geass"',
      "Looks through all media files in '~/code geass' and notes any that are missing subtitles.",
    )
    .example(
      '$0 isMissingSubtitles "~/anime" -r',
      "Recursively Looks through all media files in '~/anime' and notes any that are missing subtitles.",
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

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const isMissingSubtitlesCommand: CommandModule<
  {},
  Args
> = {
  command: "isMissingSubtitles <sourcePath>",
  describe:
    "Lists all folders and files where subtitles are missing. This is useful when you have a lot of media in a different language and may need to add subtitles.",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    isMissingSubtitles({
      isRecursive: argv.isRecursive,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
