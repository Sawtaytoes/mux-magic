import { deleteFilesByExtension } from "@mux-magic/server/src/app-commands/deleteFilesByExtension.js"
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
      '$0 deleteFilesByExtension "/path/to/dir" --extensions .srt .idx',
      "Delete all files matching the given extensions from the specified directory.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe: "Directory to search for files to delete.",
      type: "string",
    })
    .option("extensions", {
      array: true,
      demandOption: true,
      describe:
        "List of file extensions to delete (with or without leading dot).",
      type: "string",
    })
    .option("isRecursive", {
      alias: "r",
      boolean: true,
      default: false,
      describe:
        "Recursively search subdirectories for matching files.",
      nargs: 0,
      type: "boolean",
    })
    .option("recursiveDepth", {
      default: 0,
      describe:
        "Maximum recursion depth when --isRecursive is set (0 = default depth of 2).",
      type: "number",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const deleteFilesByExtensionCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "deleteFilesByExtension <sourcePath>",
  describe:
    "Delete files by extension from the provided directory.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    deleteFilesByExtension({
      isRecursive: argv.isRecursive,
      recursiveDepth: argv.recursiveDepth,
      extensions: argv.extensions,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
