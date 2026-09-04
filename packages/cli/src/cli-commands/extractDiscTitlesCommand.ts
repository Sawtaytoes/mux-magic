import { extractDiscTitles } from "@mux-magic/core/src/app-commands/extractDiscTitles.js"
import { subscribeCli } from "@mux-magic/core/src/tools/subscribeCli.js"
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
      '$0 extractDiscTitles "/media/Disc-Rips/[BACKUP] Desk Set - Blu-ray"',
      "Rip every title the analysis proposed keeping into EXTRACTED-TITLES/ inside the backup.",
    )
    .example(
      '$0 extractDiscTitles "/media/Disc-Rips/[BACKUP] Desk Set - Blu-ray" --titleIndexes 0 1',
      "Rip exactly these title indexes, ignoring the dispositions.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "A `[BACKUP]` folder produced by rip-deck. Read directly as a BDMV tree — no disc needed.",
      type: "string",
    })
    .option("destinationPath", {
      describe:
        "Where the .mkv files land. Defaults to EXTRACTED-TITLES/ inside the backup.",
      type: "string",
    })
    .option("disabledRuleNames", {
      array: true,
      default: [] as string[],
      describe:
        "Heuristic rules to switch off by name (e.g. isChapterlessLongTitle).",
      type: "string",
    })
    .option("minimumTitleLengthSeconds", {
      default: 10,
      describe:
        "MakeMKV's minimum title length. MUST match the analysis pass — makemkvcon numbers titles after applying this filter, so a different value here rips different titles.",
      type: "number",
    })
    .option("isRippingTrackSupersets", {
      boolean: true,
      default: false,
      describe:
        "Also rip a cluster's track-superset title (every track its siblings expose) and graft the chapters it lacks from the richest sibling playlist. One pass instead of ripping every playlist of the same film.",
      nargs: 0,
      type: "boolean",
    })
    .option("titleIndexes", {
      array: true,
      describe:
        "Explicit title indexes to rip. Omit to rip every title the analysis proposed keeping.",
      type: "number",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const extractDiscTitlesCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,
  command: "extractDiscTitles <sourcePath>",
  describe:
    "Rip the titles a disc analysis proposed keeping out of a `[BACKUP]` folder into .mkv files, one makemkvcon run per title. Leaves MakeMKV's own filenames alone so the naming step can rename them.",
  handler: (argv) => {
    extractDiscTitles({
      destinationPath: argv.destinationPath,
      disabledRuleNames: argv.disabledRuleNames,
      isRippingTrackSupersets: argv.isRippingTrackSupersets,
      minimumTitleLengthSeconds:
        argv.minimumTitleLengthSeconds,
      sourcePath: argv.sourcePath,
      titleIndexes: argv.titleIndexes,
    }).subscribe(subscribeCli())
  },
}
