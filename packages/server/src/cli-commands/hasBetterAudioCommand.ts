import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { hasBetterAudio } from "../app-commands/hasBetterAudio.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 hasBetterAudio "~/movies" -r',
      "Recursively looks through all folders in '~/movies' where higher channel count audio tracks aren't the default.",
    )
    .example(
      '$0 hasBetterAudio "~/movies" -r -d 2',
      "Recursively looks through all folders in '~/movies' and child folders where higher channel count audio tracks aren't the default.",
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
    .option("recursiveDepth", {
      alias: "d",
      default: 0,
      describe:
        "How many deep of child directories to follow (2 or 3) when using `isRecursive`.",
      nargs: 1,
      number: true,
      type: "number",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const hasBetterAudioCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "hasBetterAudio <sourcePath>",
  describe:
    "Output a list of files that have a higher channel count audio track not listed as the first one.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    hasBetterAudio({
      isRecursive: argv.isRecursive,
      recursiveDepth: argv.recursiveDepth,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
