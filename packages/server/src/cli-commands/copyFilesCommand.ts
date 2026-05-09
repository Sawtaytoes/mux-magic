import type { Argv, CommandBuilder, CommandModule } from "yargs"

import { copyFiles } from "../app-commands/copyFiles.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> = T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) => (
  yargs
  .example(
    "$0 copyFiles \"/work/LANGUAGE-TRIMMED\" \"/work\"",
    "Copies all files from the LANGUAGE-TRIMMED output directory back into the work directory, overwriting originals.",
  )
  .positional(
    "sourcePath",
    {
      demandOption: true,
      describe: "Directory to copy files from.",
      type: "string",
    },
  )
  .positional(
    "destinationPath",
    {
      demandOption: true,
      describe: "Directory to copy files into. Created if it does not already exist.",
      type: "string",
    },
  )
)

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const copyFilesCommand: CommandModule<{}, Args> = {
  command: "copyFiles <sourcePath> <destinationPath>",
  describe: "Copy all files from one directory to another. Does not recurse into subdirectories. Useful for copying modified files back after commands like keepLanguages or reorderTracks create a subdirectory (e.g. LANGUAGE-TRIMMED) with the results.",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    copyFiles({
      destinationPath: (
        argv
        .destinationPath
      ),
      sourcePath: (
        argv
        .sourcePath
      ),
    })
    .subscribe(subscribeCli())
  },
}
