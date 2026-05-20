import { splitCueSheet } from "@mux-magic/core/src/app-commands/splitCueSheet.js"
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
      '$0 splitCueSheet "~/music/rips"',
      "Walks '~/music/rips' for albums with CUE sheets and splits each into per-track FLACs under ~/music/rips/CUE-SPLITS/<album>/.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Music library root containing albums with CUE sheets.",
      type: "string",
    })
    .option("isRecursive", {
      alias: "r",
      boolean: true,
      default: true,
      describe:
        "Recursively descend into subdirectories looking for CUE files. Default true.",
      nargs: 0,
      type: "boolean",
    })
    .option("outputFolderName", {
      default: "CUE-SPLITS",
      describe:
        "Folder name created under sourcePath that holds all per-album subfolders.",
      type: "string",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const splitCueSheetCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "splitCueSheet <sourcePath>",
  describe:
    "Split lossless album rips into per-track FLACs using their CUE sheets. Handles UTF-8, Windows-1252, and Shift_JIS CUE files.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    splitCueSheet({
      isRecursive: argv.isRecursive,
      outputFolderName: argv.outputFolderName,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
