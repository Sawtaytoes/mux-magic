import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { deleteFolder } from "../app-commands/deleteFolder.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 deleteFolder "/work/~TEMP/AUDIO-OFFSETS" --confirm',
      "Recursively deletes the AUDIO-OFFSETS scratch directory left behind by getAudioOffsets.",
    )
    .positional("folderPath", {
      demandOption: true,
      describe: "Folder to delete (recursively).",
      type: "string",
    })
    .option("confirm", {
      boolean: true,
      default: false,
      describe:
        "Required: pass --confirm to acknowledge this is destructive. Without it the command refuses to run.",
      type: "boolean",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const deleteFolderCommand: CommandModule<{}, Args> =
  {
    command: "deleteFolder <folderPath>",
    describe:
      "Recursively delete a folder and all its contents. Useful for cleaning up scratch directories like ~TEMP/AUDIO-OFFSETS after running getAudioOffsets. Requires --confirm.",

    builder: builder as CommandBuilder<{}, Args>,

    handler: (argv) => {
      deleteFolder({
        confirm: argv.confirm,
        folderPath: argv.folderPath,
      }).subscribe(subscribeCli())
    },
  }
