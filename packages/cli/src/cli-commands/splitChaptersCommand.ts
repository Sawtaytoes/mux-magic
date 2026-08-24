import { splitChapters } from "@mux-magic/core/src/app-commands/splitChapters.js"
import { subscribeCli } from "@mux-magic/core/src/tools/subscribeCli.js"
import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

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
    .option("isRenumberingChapters", {
      boolean: true,
      default: true,
      describe:
        "Renumber each split file's `Chapter NN` names so they start at 1. A split part inherits the play-all file's numbering, so part 2 opens on `Chapter 04` without this. Parts whose chapters carry custom names (`Opening`, `Eyecatch`) are left alone. Disable with --no-isRenumberingChapters.",
      nargs: 0,
      type: "boolean",
    })
    .option("isPaddingChapterNumbers", {
      boolean: true,
      default: true,
      describe:
        "Zero-pad the renumbered chapter names — `Chapter 01..N` rather than `Chapter 1..N`. Ignored when --no-isRenumberingChapters is set.",
      nargs: 0,
      type: "boolean",
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
      isPaddingChapterNumbers: argv.isPaddingChapterNumbers,
      isRenumberingChapters: argv.isRenumberingChapters,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
