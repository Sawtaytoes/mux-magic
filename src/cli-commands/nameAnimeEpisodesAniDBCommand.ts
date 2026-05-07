import { toArray } from "rxjs"
import type { Argv, CommandBuilder, CommandModule } from "yargs"

import { nameAnimeEpisodesAniDB } from "../app-commands/nameAnimeEpisodesAniDB.js"
import type { AnidbEpisodeCategory } from "../types/anidb.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> = T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) => (
  yargs
  .example(
    "$0 nameAnimeEpisodesAniDB \"~/anime\" \"psycho-pass\"",
    "Names video files in '~/anime' using AniDB episode metadata.",
  )
  .option(
    "seasonNumber",
    {
      alias: "s",
      default: 1,
      describe: "Season number for the output filename (Plex-style sNNeNN). Ignored when --episodeType=specials.",
      nargs: 1,
      number: true,
      type: "number",
    },
  )
  .option(
    "anidbId",
    {
      alias: "a",
      describe: "AniDB anime id (aid). When provided, skips the interactive search.",
      nargs: 1,
      number: true,
      type: "number",
    },
  )
  .option(
    "episodeType",
    {
      alias: "t",
      choices: ["regular", "specials", "others"] as const,
      default: "regular" as const,
      describe: "Which AniDB episode types to rename. \"specials\" runs the length-matched per-file picker for types 2-5 (S/C/T/P) and emits Plex's s00eNN. \"others\" pairs files index-by-index against type=6 (e.g., director's-cut 'O' episodes).",
      nargs: 1,
      type: "string",
    },
  )
  .positional(
    "sourcePath",
    {
      demandOption: true,
      describe: "Directory where all episodes are located.",
      type: "string",
    },
  )
  .positional(
    "searchTerm",
    {
      demandOption: true,
      describe: "Anime name for searching AniDB (via DuckDuckGo).",
      type: "string",
    },
  )
)

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const nameAnimeEpisodesAniDBCommand: CommandModule<{}, Args> = {
  command: "nameAnimeEpisodesAniDB <sourcePath> <searchTerm>",
  describe: "Name all anime episodes in a directory using AniDB metadata.",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    nameAnimeEpisodesAniDB({
      anidbId: argv.anidbId,
      episodeType: argv.episodeType as AnidbEpisodeCategory,
      searchTerm: argv.searchTerm,
      seasonNumber: argv.seasonNumber,
      sourcePath: argv.sourcePath,
    })
    .pipe(toArray())
    .subscribe(subscribeCli())
  },
}
