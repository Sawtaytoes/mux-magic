import type { Argv, CommandBuilder, CommandModule } from "yargs"

import { nameSpecialFeatures, type NameSpecialFeaturesResult } from "../app-commands/nameSpecialFeatures.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> = T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) => (
  yargs
  .example(
    "$0 nameSpecialFeatures \"~/disc-rips/movieName\" \"https://dvdcompare.net/comparisons/film.php?fid=55539#1\"",
    "Names all special features in the movie folder using the DVDCompare.net release at `#1`.",
  )
  .positional(
    "sourcePath",
    {
      demandOption: true,
      describe: "Directory where speical features are located.",
      type: "string",
    },
  )
  .positional(
    "url",
    {
      demandOption: true,
      describe: "DVDCompare.net URL including the chosen release's hash tag.",
      type: "string",
    },
  )
  .option(
    "fixedOffset",
    {
      alias: "o",
      default: 0,
      describe: "Timecodes are pushed positively or negatively by this amount.",
      nargs: 1,
      number: true,
      type: "number",
    },
  )
  .option(
    "timecodePadding",
    {
      alias: "p",
      default: 2,
      describe: "Seconds that timecodes may be off. Defaults to 2, matching typical DVDCompare-vs-rip drift. Pass 0 for exact-match-only.",
      nargs: 1,
      number: true,
      type: "number",
    },
  )
  .option(
    "moveToEditionFolders",
    {
      alias: "e",
      boolean: true,
      default: false,
      describe: "After renaming, move main-feature files that carry a {edition-…} tag into a nested folder: <sourceParent>/<Title (Year)>/<Title (Year) {edition-…}>/<file>. Special-feature files are not moved.",
    },
  )
  .option(
    "nonInteractive",
    {
      alias: "n",
      boolean: true,
      default: false,
      describe: "When a rename target already exists on disk, automatically append (2), (3), … instead of emitting a review-needed collision event. Use this in scripts or when running without a UI that can display the collision prompt.",
    },
  )
  .option(
    "autoNameDuplicates",
    {
      alias: "a",
      boolean: true,
      default: true,
      describe: "When two-or-more files match the same target name within a single run, auto-disambiguate them with (2)/(3)/… suffixes deterministically. Pass --no-autoNameDuplicates (or set false in the YAML) to instead emit a duplicate-pick prompt for each ambiguous group. Defaults to true so non-interactive runs keep today's behavior.",
    },
  )
)

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const nameSpecialFeaturesCommand: CommandModule<{}, Args> = {
  command: "nameSpecialFeatures <sourcePath> <url>",
  describe: "Name all special features in a directory according to a DVDCompare.net URL.",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    const cliObserver = subscribeCli()
    let renamedCount = 0
    nameSpecialFeatures({
      autoNameDuplicates: (
        argv
        .autoNameDuplicates
      ),
      fixedOffset: (
        argv
        .fixedOffset
      ),
      moveToEditionFolders: (
        argv
        .moveToEditionFolders
      ),
      nonInteractive: (
        argv
        .nonInteractive
      ),
      sourcePath: (
        argv
        .sourcePath
      ),
      timecodePaddingAmount: (
        argv
        .timecodePadding
      ),
      url: (
        argv
        .url
      ),
    })
    .subscribe({
      next: (event: NameSpecialFeaturesResult) => {
        if ("unrenamedFilenames" in event) {
          console.log(`Renamed ${renamedCount}. Files not renamed: ${event.unrenamedFilenames.length}.`)
          if (event.unrenamedFilenames.length > 0) {
            console.log("Files not renamed:")
            event.unrenamedFilenames.forEach((filename) => {
              console.log(`  • ${filename}`)
            })
          }
          if (event.unnamedFileCandidates && event.unnamedFileCandidates.length > 0) {
            console.log("Possible candidate associations for unnamed files:")
            event.unnamedFileCandidates.forEach(({ filename, candidates }) => {
              console.log(`  • ${filename}`)
              candidates.slice(0, 3).forEach((c) => console.log(`      - ${c}`))
            })
          }
          return
        }
        if ("collision" in event) {
          console.warn(
            `[REVIEW NEEDED] "${event.filename}" → "${event.targetFilename}" already exists. `
            + "Pass --non-interactive to auto-suffix instead.",
          )
          return
        }
        if ("movedToEditionFolder" in event) {
          console.log(`Moved to edition folder: ${event.filename} → ${event.destinationPath}`)
          return
        }
        renamedCount += 1
        console.log(`${event.oldName} → ${event.newName}`)
      },
      complete: cliObserver.complete,
      error: cliObserver.error,
    })
  },
}
