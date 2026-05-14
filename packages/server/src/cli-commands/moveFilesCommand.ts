import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { moveFiles } from "../app-commands/moveFiles.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 moveFiles "/work/LANGUAGE-TRIMMED" "/work"',
      "Copies all files from LANGUAGE-TRIMMED into the work directory, then deletes the LANGUAGE-TRIMMED directory.",
    )
    .example(
      '$0 moveFiles "/staging" "/library" --fileFilterRegex "\\.mkv$" --renamePattern "^\\[.*?\\] (.+)$" --renameReplacement "$1"',
      "Moves only MKV files, stripping leading [Group] tags, then removes the staging directory.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Directory to move files from. Deleted after all files are copied.",
      type: "string",
    })
    .positional("destinationPath", {
      demandOption: true,
      describe:
        "Directory to move files into. Created if it does not already exist.",
      type: "string",
    })
    .option("fileFilterRegex", {
      describe:
        "Only move files whose names match this regex.",
      type: "string",
    })
    .option("renamePattern", {
      describe:
        "Regex pattern for renaming files at destination. Must be paired with --renameReplacement.",
      type: "string",
    })
    .option("renameReplacement", {
      describe:
        "Replacement string for --renamePattern. Capture groups available as $1, $2, etc.",
      type: "string",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const moveFilesCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "moveFiles <sourcePath> <destinationPath>",
  describe:
    "Copy all files from one directory to another, then delete the source directory. Equivalent to copyFiles followed by deleting the source. Useful when you want to clean up the output subdirectory after copying results back.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    const renameRegex =
      argv.renamePattern != null &&
      argv.renameReplacement != null
        ? {
            pattern: argv.renamePattern,
            replacement: argv.renameReplacement,
          }
        : undefined
    moveFiles({
      destinationPath: argv.destinationPath,
      fileFilterRegex: argv.fileFilterRegex,
      renameRegex,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
