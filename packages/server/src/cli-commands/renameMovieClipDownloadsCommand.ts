import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { renameMovieClipDownloads } from "../app-commands/renameMovieClipDownloads.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 renameMovieClipDownloads "~/movie-demos"',
      "Renames all video files in '~/movie-demos' based the demo format for renaming with other commands.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Directory where downloaded movie demos are located.",
      type: "string",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const renameMovieClipDownloadsCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "renameMovieClipDownloads <sourcePath>",
  describe:
    "Rename TomSawyer's movie rips from the AVSForums to follow the demo format.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    renameMovieClipDownloads({
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
