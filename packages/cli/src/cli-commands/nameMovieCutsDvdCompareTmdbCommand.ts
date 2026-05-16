import type { NameMovieCutsResult } from "@mux-magic/server/src/app-commands/nameMovieCutsDvdCompareTmdb.events.js"
import { nameMovieCutsDvdCompareTmdb } from "@mux-magic/server/src/app-commands/nameMovieCutsDvdCompareTmdb.js"
import { subscribeCli } from "@mux-magic/server/src/tools/subscribeCli.js"
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
      '$0 nameMovieCutsDvdCompareTmdb "~/disc-rips/Dragon Lord" "https://dvdcompare.net/comparisons/film.php?fid=12345#1"',
      "Rename movie cuts in the source folder to '<Title> (<Year>) {edition-<CutName>}.<ext>' and move into the Plex edition-folder layout.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Directory containing movie cut files (e.g. Movie.mkv, Movie.Directors.Cut.mkv).",
      type: "string",
    })
    .positional("url", {
      demandOption: true,
      describe:
        "DVDCompare.net URL including the chosen release's hash tag.",
      type: "string",
    })
    .option("fixedOffset", {
      alias: "o",
      default: 0,
      describe:
        "Constant offset (seconds) subtracted from each file's duration before matching.",
      nargs: 1,
      number: true,
      type: "number",
    })
    .option("timecodePadding", {
      alias: "p",
      default: 15,
      describe:
        "Seconds of slack when matching durations. Defaults to 15 — the floor used internally for typical rip-vs-DVDCompare drift on main features.",
      nargs: 1,
      number: true,
      type: "number",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const nameMovieCutsDvdCompareTmdbCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "nameMovieCutsDvdCompareTmdb <sourcePath> <url>",
  describe:
    "Rename movie-cut files matching a DVDCompare release and organize them into Plex edition folders. Files with no matching cut are skipped.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    const cliObserver = subscribeCli()
    let renamedCount = 0
    let skippedCount = 0
    nameMovieCutsDvdCompareTmdb({
      fixedOffset: argv.fixedOffset,
      sourcePath: argv.sourcePath,
      timecodePaddingAmount: argv.timecodePadding,
      url: argv.url,
    }).subscribe({
      next: (event: NameMovieCutsResult) => {
        if ("skippedFilename" in event) {
          skippedCount += 1
          console.log(
            `[SKIPPED] ${event.skippedFilename} (no matching cut found)`,
          )
          return
        }
        renamedCount += 1
        console.log(
          `${event.oldName} → ${event.destinationPath}`,
        )
      },
      complete: () => {
        console.log(
          `Done: ${renamedCount} renamed, ${skippedCount} skipped.`,
        )
        cliObserver.complete()
      },
      error: cliObserver.error,
    })
  },
}
