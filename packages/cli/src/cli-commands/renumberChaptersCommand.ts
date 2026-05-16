import { renumberChapters } from "@mux-magic/server/src/app-commands/renumberChapters.js"
import { subscribeCli } from "@mux-magic/server/src/tools/subscribeCli.js"
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
      '$0 renumberChapters "~/anime/season-01" -r',
      "Recursively renumbers `Chapter NN`-style chapter names so the numbers run sequentially 1..N. Skips files with no chapters, files already sequential, and files containing any non-`Chapter NN` names.",
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
    .option("isPaddingChapterNumbers", {
      boolean: true,
      default: true,
      describe:
        "Zero-pad chapter numbers to a width of max(2, len(totalCount)) — `Chapter 01..09, 10` for ≤99 atoms, `Chapter 001..100` for ≥100. Disable with --no-pad-chapter-numbers for unpadded `Chapter 1..N`.",
      nargs: 0,
      type: "boolean",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const renumberChaptersCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "renumberChapters <sourcePath>",
  describe:
    "Renumbers `Chapter NN` chapter names to a sequential 1..N via a metadata-only mkvmerge remux (preserves timecodes / UIDs / custom-named chapters).",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    renumberChapters({
      isPaddingChapterNumbers: argv.isPaddingChapterNumbers,
      isRecursive: argv.isRecursive,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
