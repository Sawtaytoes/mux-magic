import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { renameDemos } from "../app-commands/renameDemos.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 renameDemos "~/demos"',
      "Renames all video files in '~/demos' with the correct media information. This will also replace incorrect information.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe: "Directory where demo files are located.",
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

export const renameDemosCommand: CommandModule<{}, Args> = {
  command: "renameDemos <sourcePath>",
  describe:
    "Rename demo files (such as Dolby's Amaze) to a format which accurately states all capabilities for easier searching and sorting in media apps (like Plex).",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    renameDemos({
      isRecursive: argv.isRecursive,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
