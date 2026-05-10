import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { splitChapters } from "../app-commands/splitChapters.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 splitChapters "~/disc-rips/gintama" 7,18,26,33 6,17,25 6',
      "Breaks apart video files in '~/disc-rips/gintama' using the comma-separated chapter splits in filename order. Splits occur at the beginning of the given chapters.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe: "Directory where video files are located.",
      type: "string",
    })
    .positional("chapterSplits", {
      array: true,
      demandOption: true,
      describe:
        "Space-separated list of comma-separated chapter markers. Splits occur at the beginning of the chapter.",
      type: "string",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const splitChaptersCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "splitChapters <sourcePath> <chapterSplits...>",
  describe:
    "Breaks apart large video files based on chapter markers. The split occurs at the beginning of the given chapters. This is useful for anime discs which typically rip 4-6 episodes into a single large file.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    splitChapters({
      chapterSplitsList: argv.chapterSplits,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
