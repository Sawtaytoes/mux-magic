import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { copyFiles } from "@mux-magic/server/src/app-commands/copyFiles.js"
import { subscribeCli } from "@mux-magic/server/src/tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 copyFiles "/staging/anime" "/library/anime"',
      "Copies all files from the staging directory into the library.",
    )
    .example(
      '$0 copyFiles "/staging" "/library" --fileFilterRegex "\\.mkv$" --renamePattern "^\\[.*?\\] (.+)$" --renameReplacement "$1"',
      "Copies only MKV files, stripping leading [Group] tags from filenames.",
    )
    .example(
      '$0 copyFiles "/staging" "/library" --folderFilterRegex "^My Show S\\d+$" --includeFolders',
      "Copies matching season folders as units.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe: "Directory to copy files from.",
      type: "string",
    })
    .positional("destinationPath", {
      demandOption: true,
      describe:
        "Directory to copy files into. Created if it does not already exist.",
      type: "string",
    })
    .option("fileFilterRegex", {
      describe:
        "Only copy files whose names match this regex.",
      type: "string",
    })
    .option("folderFilterRegex", {
      describe:
        "When --includeFolders is set, only copy folders whose names match this regex.",
      type: "string",
    })
    .option("includeFolders", {
      default: false,
      describe:
        "Copy matching top-level subdirectories as units (recursively). Files are only copied if --fileFilterRegex is also set.",
      type: "boolean",
    })
    .option("renamePattern", {
      describe:
        "Regex pattern to apply to each entry name for renaming at destination. Must be paired with --renameReplacement.",
      type: "string",
    })
    .option("renameReplacement", {
      describe:
        "Replacement string for --renamePattern. Capture groups available as $1, $2, etc.",
      type: "string",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const copyFilesCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "copyFiles <sourcePath> <destinationPath>",
  describe:
    "Copy files (and optionally folders) from source to destination with optional regex filtering and renaming.",

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
    copyFiles({
      destinationPath: argv.destinationPath,
      fileFilterRegex: argv.fileFilterRegex,
      folderFilterRegex: argv.folderFilterRegex,
      isIncludingFolders: argv.includeFolders,
      renameRegex,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
