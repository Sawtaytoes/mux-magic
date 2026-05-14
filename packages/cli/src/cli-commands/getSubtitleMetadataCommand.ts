import { getSubtitleMetadata } from "@mux-magic/server/src/app-commands/getSubtitleMetadata.js"
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
      '$0 getSubtitleMetadata "/path/to/subtitles"',
      "Prints Script Info and style metadata for every .ass file as JSON.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Directory containing .ass subtitle files to inspect.",
      type: "string",
    })
    .option("isRecursive", {
      alias: "r",
      boolean: true,
      default: false,
      describe:
        "Recursively search subdirectories for .ass files.",
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

export const getSubtitleMetadataCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "getSubtitleMetadata <sourcePath>",
  describe:
    "Reads .ass subtitle files and prints their Script Info and style metadata as JSON.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    getSubtitleMetadata({
      isRecursive: argv.isRecursive,
      recursiveDepth: argv.recursiveDepth,
      sourcePath: argv.sourcePath,
    }).subscribe({
      next: (files) => {
        process.stdout.write(
          `${JSON.stringify({ files }, null, 2)}\n`,
        )
      },
      error: (err) => {
        console.error(err)
        process.exit(1)
      },
      complete: () => {
        console.timeEnd("Command Runtime")
      },
    })
  },
}
