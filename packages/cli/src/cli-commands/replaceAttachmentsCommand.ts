import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { replaceAttachments } from "@mux-magic/server/src/app-commands/replaceAttachments.js"
import { subscribeCli } from "@mux-magic/server/src/tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 replaceAttachments "G:\\Anime\\Code Geass HAS ATTACHMENTS" "G:\\Anime\\Code Geass MISSING ATTACHMENTS"',
      "For all media files that have matching names (minus the extension), it replaces the attachments (fonts, etc) which typically affect subtitles.",
    )
    .positional("sourceFilesPath", {
      demandOption: true,
      describe:
        "Directory with containing media files with attachments you want to copy.",
      type: "string",
    })
    .positional("destinationFilesPath", {
      demandOption: true,
      describe:
        "Directory containing media files with attachments you want replaced.",
      type: "string",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const replaceAttachmentsCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command:
    "replaceAttachments <sourceFilesPath> <destinationFilesPath>",
  describe:
    "Copy tracks from one media file and replace them in another making sure to only keep the chosen languages.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    replaceAttachments({
      destinationFilesPath: argv.destinationFilesPath,
      sourceFilesPath: argv.sourceFilesPath,
    }).subscribe(subscribeCli())
  },
}
