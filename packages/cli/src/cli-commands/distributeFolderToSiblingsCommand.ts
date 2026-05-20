import { distributeFolderToSiblings } from "@mux-magic/core/src/app-commands/distributeFolderToSiblings.js"
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
      "$0 distributeFolderToSiblings",
      "From the current directory, recursively copies ./attachments into every sibling subdirectory.",
    )
    .example(
      '$0 distributeFolderToSiblings "/show/attachments" --deleteSourceFolderAfterDistributing',
      "Copies /show/attachments into every other directory under /show, then removes /show/attachments.",
    )
    .positional("sourceFolderPath", {
      default: "./attachments",
      describe:
        "Folder to copy into every sibling directory of its parent. Defaults to ./attachments so `cd into-show-dir && mux-magic distributeFolderToSiblings` just works.",
      type: "string",
    })
    .option("deleteSourceFolderAfterDistributing", {
      boolean: true,
      default: false,
      describe:
        "Delete the source folder after all copies succeed. Default false: source is preserved (destructive step is opt-in).",
      type: "boolean",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const distributeFolderToSiblingsCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "distributeFolderToSiblings [sourceFolderPath]",
  describe:
    "Copies a folder (default ./attachments) into every sibling directory of its parent. Canonical use: place a shared attachments folder inside every episode directory so each one carries its own copy.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    distributeFolderToSiblings({
      isDeletingSourceFolderAfterDistributing:
        argv.deleteSourceFolderAfterDistributing,
      sourceFolderPath: argv.sourceFolderPath,
    }).subscribe(subscribeCli())
  },
}
