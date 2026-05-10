import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { hasImaxEnhancedAudio } from "../app-commands/hasImaxEnhancedAudio.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 hasImaxEnhancedAudio "~/demos"',
      "Lists any media files in '~/demos' with at least one IMAX Enhanced audio track.",
    )
    .example(
      '$0 hasImaxEnhancedAudio "~/movies" -r',
      "Recursively goes through '~/movies', and lists any media files with at least one IMAX Enhanced audio track.",
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

export const hasImaxEnhancedAudioCommand: CommandModule<
  {},
  Args
> = {
  command: "hasImaxEnhancedAudio <sourcePath>",
  describe:
    "Lists any files with an IMAX Enhanced audio track. Useful for checking movies and demos.",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    hasImaxEnhancedAudio({
      isRecursive: argv.isRecursive,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
