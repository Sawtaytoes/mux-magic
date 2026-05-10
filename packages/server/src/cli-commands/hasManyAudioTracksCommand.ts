import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { hasManyAudioTracks } from "../app-commands/hasManyAudioTracks.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 hasManyAudioTracks "~/demos"',
      "Lists any media files in '~/demos' with more than 1 audio track.",
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

export const hasManyAudioTracksCommand: CommandModule<
  {},
  Args
> = {
  command: "hasManyAudioTracks <sourcePath>",
  describe:
    "Lists any files that have more than one audio track. Useful for determining which demo files may have unused audio tracks.",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    hasManyAudioTracks({
      isRecursive: argv.isRecursive,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
