import { renameFiles } from "@mux-magic/server/src/app-commands/renameFiles.js"
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
      '$0 renameFiles "/library/anime" --renamePattern "^\\[.*?\\] (.+)$" --renameReplacement "$1"',
      "Strips leading [Group] tags from every filename in the directory.",
    )
    .example(
      '$0 renameFiles "/library/anime" --fileFilterRegex "\\.mkv$" --renamePattern "\\." --renameReplacement " "',
      "After a copy that left dot-separated words, converts dots to spaces (.mkv only).",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe: "Directory containing files to rename.",
      type: "string",
    })
    .option("fileFilterRegex", {
      describe:
        "Only rename files whose names match this regex.",
      type: "string",
    })
    .option("isRecursive", {
      default: false,
      describe: "Recursively descend into subdirectories.",
      type: "boolean",
    })
    .option("recursiveDepth", {
      default: 0,
      describe:
        "Max recursion depth when --isRecursive is set (0 = default depth of 1).",
      type: "number",
    })
    .option("renamePattern", {
      demandOption: true,
      describe:
        "Regex pattern applied to each matched filename (including extension).",
      type: "string",
    })
    .option("renameReplacement", {
      demandOption: true,
      describe:
        "Replacement string for --renamePattern. Capture groups available as $1, $2, etc.",
      type: "string",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const renameFilesCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "renameFiles <sourcePath>",
  describe:
    "Rename files in place via regex. No copy, no move — just metadata rename.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    renameFiles({
      fileFilterRegex: argv.fileFilterRegex,
      isRecursive: argv.isRecursive,
      recursiveDepth: argv.recursiveDepth,
      renameRegex: {
        pattern: argv.renamePattern,
        replacement: argv.renameReplacement,
      },
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
