import { toArray } from "rxjs"
import type { Argv, CommandBuilder, CommandModule } from "yargs"

import { nameAnimeEpisodes } from "../app-commands/nameAnimeEpisodes.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> = T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) => (
  yargs
  .example(
    "$0 nameAnimeEpisodes \"~/anime\" \"psycho-pass\"",
    "Names all video files in '~/anime' based on the episode names on MyAnimeList.",
  )
  .option(
    "seasonNumber",
    {
      alias: "s",
      default: 1,
      describe: "The season number to output when renaming useful for TVDB which has separate season number. For aniDB, use the default value 1.",
      nargs: 1,
      number: true,
      type: "number",
    },
  )
  .positional(
    "sourcePath",
    {
      demandOption: true,
      describe: "Directory where all episodes for that season are located.",
      type: "string",
    },
  )
  .positional(
    "searchTerm",
    {
      demandOption: true,
      describe: "Name of the anime for searching MyAnimeList.com.",
      type: "string",
    },
  )
)

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const nameAnimeEpisodesCommand: CommandModule<{}, Args> = {
  command: "nameAnimeEpisodes <sourcePath> <searchTerm>",
  describe: "Name all anime episodes in a directory according to episode names on MyAnimeList.",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    nameAnimeEpisodes({
      searchTerm: (
        argv
        .searchTerm
      ),
      seasonNumber: (
        argv
        .seasonNumber
      ),
      sourcePath: (
        argv
        .sourcePath
      ),
    })
    .pipe(
      toArray(),
    )
    .subscribe(subscribeCli())
  },
}
