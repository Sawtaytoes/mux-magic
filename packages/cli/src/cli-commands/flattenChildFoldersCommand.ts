import { flattenChildFolders } from "@mux-magic/core/src/app-commands/flattenChildFolders.js"
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
      '$0 flattenChildFolders "/Disc-Rips/Disney Shorts"',
      "Moves every file from each immediate child directory of /Disc-Rips/Disney Shorts up to the parent itself. The now-empty child dirs are preserved by default.",
    )
    .example(
      '$0 flattenChildFolders "/Disc-Rips/Disney Shorts" --deleteEmptyChildFoldersAfterFlattening',
      "Same as above but also removes the (now-empty) child directories after the moves complete.",
    )
    .positional("parentPath", {
      demandOption: true,
      describe:
        "Folder whose immediate child directories should each have their files moved up to this folder.",
      type: "string",
    })
    .option("deleteEmptyChildFoldersAfterFlattening", {
      boolean: true,
      default: false,
      describe:
        "Delete the now-empty child directories after the moves. Default false: the empties are preserved for inspection (matches flattenOutput's default).",
      type: "boolean",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const flattenChildFoldersCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "flattenChildFolders <parentPath>",
  describe:
    "For each immediate child directory of parentPath, move all of its files up to parentPath. Distinct from flattenOutput which operates on a single folder — this iterates over every child instead. Optional cleanup of the now-empty child dirs.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    flattenChildFolders({
      isDeletingEmptyChildFoldersAfterFlattening:
        argv.deleteEmptyChildFoldersAfterFlattening,
      parentPath: argv.parentPath,
    }).subscribe(subscribeCli())
  },
}
