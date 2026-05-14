import { remuxToMkv } from "@mux-magic/server/src/app-commands/remuxToMkv.js"
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
      '$0 remuxToMkv "/path/to/dir" --extensions .ts --isSourceDeletedOnSuccess',
      "Remux every .ts file into an .mkv sibling and delete the original on per-file success.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe: "Directory containing files to remux.",
      type: "string",
    })
    .option("extensions", {
      array: true,
      demandOption: true,
      describe:
        "List of file extensions to remux (with or without leading dot), e.g. .ts .m2ts.",
      type: "string",
    })
    .option("isRecursive", {
      alias: "r",
      boolean: true,
      default: false,
      describe: "Recursively scan subdirectories.",
      nargs: 0,
      type: "boolean",
    })
    .option("recursiveDepth", {
      default: 0,
      describe:
        "Maximum recursion depth when --isRecursive is set (0 = default depth of 2).",
      type: "number",
    })
    .option("isSourceDeletedOnSuccess", {
      boolean: true,
      default: false,
      describe:
        "Delete each source file after its remux completes successfully.",
      nargs: 0,
      type: "boolean",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const remuxToMkvCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "remuxToMkv <sourcePath>",
  describe:
    "Pass-through remux of every matching file into an .mkv sibling using mkvmerge.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    remuxToMkv({
      extensions: argv.extensions,
      isRecursive: argv.isRecursive,
      isSourceDeletedOnSuccess:
        argv.isSourceDeletedOnSuccess,
      recursiveDepth: argv.recursiveDepth,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
