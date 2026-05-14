import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { hasSurroundSound } from "@mux-magic/server/src/app-commands/hasSurroundSound.js"
import { subscribeCli } from "@mux-magic/server/src/tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 hasSurroundSound "~/movies" -r',
      "Recursively looks through all folders in '~/movies' where higher channel count audio tracks aren't the default.",
    )
    .example(
      '$0 hasSurroundSound "~/movies" -r -d 2',
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

export const hasSurroundSoundCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "hasSurroundSound <sourcePath>",
  describe:
    "Output a list of files channel counts higher than 2.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    hasSurroundSound({
      isRecursive: argv.isRecursive,
      recursiveDepth: argv.recursiveDepth,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
