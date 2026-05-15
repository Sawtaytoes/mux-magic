import { deleteCopiedOriginals } from "@mux-magic/server/src/app-commands/deleteCopiedOriginals.js"
import { subscribeCli } from "@mux-magic/server/src/tools/subscribeCli.js"
import { toArray } from "rxjs"
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
      '$0 deleteCopiedOriginals "/staging/ep01.mkv" "/staging/ep02.mkv"',
      "Deletes the two source files after they have been successfully copied to the library.",
    )
    .positional("pathsToDelete", {
      array: true,
      demandOption: true,
      describe:
        "One or more file or folder paths to delete. In a sequence, these are typically provided via linkedTo from a prior copyFiles step.",
      type: "string",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const deleteCopiedOriginalsCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "deleteCopiedOriginals <pathsToDelete..>",
  describe:
    "Delete the original source files that were previously copied by a copyFiles or moveFiles step. Is a no-op when the list is empty.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    deleteCopiedOriginals({
      pathsToDelete: argv.pathsToDelete ?? [],
    })
      .pipe(toArray())
      .subscribe(subscribeCli())
  },
}
