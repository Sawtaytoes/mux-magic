import type { OnlyNameSpecialFeaturesResult } from "@mux-magic/core/src/app-commands/onlyNameSpecialFeaturesDvdCompare.events.js"
import { onlyNameSpecialFeaturesDvdCompare } from "@mux-magic/core/src/app-commands/onlyNameSpecialFeaturesDvdCompare.js"
import { subscribeCli } from "@mux-magic/core/src/tools/subscribeCli.js"
import { logInfo, logWarning } from "@mux-magic/tools"
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
      '$0 onlyNameSpecialFeaturesDvdCompare "~/disc-rips/concert" "https://dvdcompare.net/comparisons/film.php?fid=55539#1"',
      "Names all special features in the folder using timecode matching against the DVDCompare.net release at #1. No TMDB lookup — suited for concerts, documentaries, and other non-movie workflows.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Directory containing special-features files.",
      type: "string",
    })
    .positional("url", {
      demandOption: false,
      describe:
        "DVDCompare.net URL including the chosen release's hash tag.",
      type: "string",
    })
    .option("dvdCompareId", {
      alias: "d",
      describe:
        "DVDCompare film ID — constructs URL directly and bypasses search.",
      nargs: 1,
      number: true,
      type: "number",
    })
    .option("dvdCompareReleaseHash", {
      alias: "r",
      describe:
        "Release hash (URL fragment #) on the DVDCompare page. Defaults to 1 (the first release option).",
      nargs: 1,
      number: true,
      type: "number",
    })
    .option("searchTerm", {
      alias: "s",
      describe:
        "Title to search on DVDCompare.net (used when no url or dvdCompareId).",
      nargs: 1,
      type: "string",
    })
    .option("fixedOffset", {
      alias: "o",
      default: 0,
      describe:
        "Timecodes are pushed positively or negatively by this amount (in seconds).",
      nargs: 1,
      number: true,
      type: "number",
    })
    .option("timecodePadding", {
      alias: "p",
      default: 2,
      describe:
        "Seconds that timecodes may be off. Defaults to 2, matching typical DVDCompare-vs-rip drift. Pass 0 for exact-match-only.",
      nargs: 1,
      number: true,
      type: "number",
    })
    .option("autoNameDuplicates", {
      alias: "a",
      boolean: true,
      default: false,
      describe:
        "When two-or-more files match the same target name within a single run, auto-disambiguate them with (2)/(3)/… suffixes deterministically. Pass --no-autoNameDuplicates to instead emit a duplicate-pick prompt for each ambiguous group.",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const onlyNameSpecialFeaturesDvdCompareCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command:
    "onlyNameSpecialFeaturesDvdCompare <sourcePath> [url]",
  describe:
    "Rename special features by timecode matching against DVDCompare.net — no TMDB lookup. Suited for concerts, documentaries, and other non-movie workflows.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    const cliObserver = subscribeCli()
    let renamedCount = 0
    onlyNameSpecialFeaturesDvdCompare({
      isAutoNamingDuplicates: argv.autoNameDuplicates,
      dvdCompareId: argv.dvdCompareId,
      dvdCompareReleaseHash: argv.dvdCompareReleaseHash,
      fixedOffset: argv.fixedOffset,
      searchTerm: argv.searchTerm,
      sourcePath: argv.sourcePath,
      timecodePaddingAmount: argv.timecodePadding,
      url: argv.url,
    }).subscribe({
      next: (event: OnlyNameSpecialFeaturesResult) => {
        if ("skippedFilename" in event) {
          logInfo(
            "SKIPPED",
            `"${event.skippedFilename}" — no timecode match found. Run nameSpecialFeaturesDvdCompareTmdb for fuzzy fallback.`,
          )
          return
        }
        if ("hasCollision" in event) {
          logWarning(
            "REVIEW NEEDED",
            `"${event.filename}" → "${event.targetFilename}" already exists.`,
          )
          return
        }
        renamedCount += 1
        logInfo("RENAMED", event.oldName, event.newName)
      },
      complete: () => {
        logInfo(
          "SUMMARY",
          `Renamed ${renamedCount} file${renamedCount === 1 ? "" : "s"}.`,
        )
        cliObserver.complete()
      },
      error: cliObserver.error,
    })
  },
}
