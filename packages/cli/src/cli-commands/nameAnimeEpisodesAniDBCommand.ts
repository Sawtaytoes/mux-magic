import { nameAnimeEpisodesAniDB } from "@mux-magic/core/src/app-commands/nameAnimeEpisodesAniDB.js"
import { subscribeCli } from "@mux-magic/core/src/tools/subscribeCli.js"
import type { AnidbEpisodeCategory } from "@mux-magic/core/src/types/anidb.js"
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
      '$0 nameAnimeEpisodesAniDB "~/anime" "psycho-pass"',
      "Names video files in '~/anime' using AniDB episode metadata.",
    )
    .option("seasonNumber", {
      alias: "s",
      default: 1,
      describe:
        "Season number for the output filename (Plex-style sNNeNN). Ignored when --episodeType=specials.",
      nargs: 1,
      number: true,
      type: "number",
    })
    .option("anidbId", {
      alias: "a",
      describe:
        "AniDB anime id (aid). When provided, skips the interactive search.",
      nargs: 1,
      number: true,
      type: "number",
    })
    .option("episodeType", {
      alias: "t",
      choices: [
        "regular",
        "specials",
        "credits",
        "trailers",
        "parodies",
        "others",
      ] as const,
      default: "regular" as const,
      describe:
        "Which AniDB episode types to rename. Each non-regular sub-type is run separately: specials (S), credits (C, OP/ED), trailers (T), parodies (P) all run the length-matched per-file picker and emit Plex's s00eNN. Others (type=6 alts) and regular are index-paired with a duration sanity-check warning.",
      nargs: 1,
      type: "string",
    })
    .option("filenameRegex", {
      alias: "f",
      describe:
        'Regex with a named capture group (?<episodeNumber>…) to pair each file to the AniDB episode whose number matches the captured value (e.g. "S\\d+E(?<episodeNumber>\\d+)"). Matched case-insensitively. Non-matching files fall back to index pairing. Regular/others only.',
      nargs: 1,
      type: "string",
    })
    .option("startEpisodeNumber", {
      alias: "e",
      describe:
        "First episode number when pairing a partial set by natural-sort index (e.g. 5 → s01e05, s01e06, …). Ignored for files matched by --filenameRegex. Defaults to 1. Regular/others only.",
      nargs: 1,
      number: true,
      type: "number",
    })
    .option("seriesName", {
      alias: "n",
      describe:
        "Overrides AniDB's auto-picked series title in output filenames and the seriesFolderName output. Used verbatim. When omitted, AniDB's title is used.",
      nargs: 1,
      type: "string",
    })
    .positional("sourcePath", {
      demandOption: true,
      describe: "Directory where all episodes are located.",
      type: "string",
    })
    .positional("searchTerm", {
      demandOption: true,
      describe:
        "Anime name for searching AniDB (via DuckDuckGo).",
      type: "string",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const nameAnimeEpisodesAniDBCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command:
    "nameAnimeEpisodesAniDB <sourcePath> <searchTerm>",
  describe:
    "Name all anime episodes in a directory using AniDB metadata.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    nameAnimeEpisodesAniDB({
      anidbId: argv.anidbId,
      episodeType: argv.episodeType as AnidbEpisodeCategory,
      filenameRegex: argv.filenameRegex,
      searchTerm: argv.searchTerm,
      seasonNumber: argv.seasonNumber,
      seriesName: argv.seriesName,
      sourcePath: argv.sourcePath,
      startEpisodeNumber: argv.startEpisodeNumber,
    })
      .pipe(toArray())
      .subscribe(subscribeCli())
  },
}
