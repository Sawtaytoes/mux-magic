import { moveFilesIntoNamedFolders } from "@mux-magic/core/src/app-commands/moveFilesIntoNamedFolders.js"
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
      '$0 moveFilesIntoNamedFolders "/Disc-Rips/Casper - 4K"',
      "For each file in the folder, creates a same-named subdirectory (extension stripped) and moves the file into it. Casper.mkv → Casper/Casper.mkv.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Folder whose files should each be moved into a same-named subdirectory.",
      type: "string",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const moveFilesIntoNamedFoldersCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "moveFilesIntoNamedFolders <sourcePath>",
  describe:
    "Foldarize: for each file in sourcePath, create a same-named subdirectory (with the file's extension stripped) and move the file into it. Useful for organising a folder of media rips into per-title directories before further processing.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    moveFilesIntoNamedFolders({
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
