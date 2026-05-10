import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { hasDuplicateMusicFiles } from "../app-commands/hasDuplicateMusicFiles.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 hasDuplicateMusicFiles "~/music/artist_albums" -r',
      "Recursively looks through all folders in '~/music/artist_albums' containing albums with music files inside. Lists directories containing any two or more audio files sharing the same name.",
    )
    .example(
      '$0 hasDuplicateMusicFiles "~/music" -r -d 2',
      "Recursively looks through all folders 2 levels deep in '~/music' where any two or more audio files share the same name and logs the name of the folder.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Directory containing music files or containing other directories of music files.",
      type: "string",
    })
    .option("isRecursive", {
      alias: "r",
      boolean: true,
      default: false,
      describe:
        "Recursively looks in folders for music files.",
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

export const hasDuplicateMusicFilesCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "hasDuplicateMusicFiles <sourcePath>",
  describe:
    "Output a list of directories containing music files with duplicates. This is helpful when there are, for instance, both FLAC and MP3 files with the same name in the same directory. It can also find two sets of FLAC files as well. Also checks for `(2)` and ` - Copy` duplicates.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    hasDuplicateMusicFiles({
      isRecursive: argv.isRecursive,
      recursiveDepth: argv.recursiveDepth,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
