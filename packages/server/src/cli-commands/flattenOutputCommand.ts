import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { flattenOutput } from "../app-commands/flattenOutput.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 flattenOutput "/work/SUBTITLED"',
      "Copies every file in /work/SUBTITLED back into /work, overwriting originals. Source folder is preserved by default so you can inspect intermediate state.",
    )
    .example(
      '$0 flattenOutput "/work/SUBTITLED" --deleteSourceFolder',
      "Same as above, but also removes the SUBTITLED folder afterward.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Output folder produced by a previous step (e.g. /work/SUBTITLED). Its contents are copied up one level into its parent.",
      type: "string",
    })
    .option("deleteSourceFolder", {
      boolean: true,
      default: false,
      describe:
        "Delete the source folder after copying. By default the source is preserved (debug-friendly).",
      type: "boolean",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const flattenOutputCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "flattenOutput <sourcePath>",
  describe:
    "Flatten a chained operation's output: copy files from sourcePath up one level (overwriting originals). Prevents folder nesting from accumulating across chained steps that each have an outputFolderName. The source folder is preserved by default; pass --deleteSourceFolder to also remove it.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    flattenOutput({
      deleteSourceFolder: argv.deleteSourceFolder,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
