import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { nameTvShowEpisodes } from "@mux-magic/server/src/app-commands/nameTvShowEpisodes.js"
import { subscribeCli } from "@mux-magic/server/src/tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 nameTvShowEpisodes "~/shows" "beast wars"',
      "Names all video files in '~/shows' based on the episode names on TVDB.",
    )
    .option("seasonNumber", {
      alias: "s",
      demandOption: true,
      describe:
        "The season number to lookup when renaming.",
      nargs: 1,
      number: true,
      type: "number",
    })
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Directory where all episodes for that season are located.",
      type: "string",
    })
    .positional("searchTerm", {
      demandOption: true,
      describe:
        "Name of the TV show for searching TVDB.com.",
      type: "string",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const nameTvShowEpisodesCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "nameTvShowEpisodes <sourcePath> <searchTerm>",
  describe:
    "Name all TV show episodes in a directory according to episode names on TVDB.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    nameTvShowEpisodes({
      searchTerm: argv.searchTerm,
      seasonNumber: argv.seasonNumber,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
