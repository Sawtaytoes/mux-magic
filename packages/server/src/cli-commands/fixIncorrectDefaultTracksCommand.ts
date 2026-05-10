import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { fixIncorrectDefaultTracks } from "../app-commands/fixIncorrectDefaultTracks.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 fixIncorrectDefaultTracks "~/anime" -r',
      "Recursively looks through all folders in '~/anime' and ensures the first video, audio, and subtitles tracks are set as the default. It also makes sure to unset other tracks so only one default exists.",
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

export const fixIncorrectDefaultTracksCommand: CommandModule<
  {},
  Args
> = {
  command: "fixIncorrectDefaultTracks <sourcePath>",
  describe:
    "Modifies each file such that the first track of each type is set as the default.",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    fixIncorrectDefaultTracks({
      isRecursive: argv.isRecursive,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
