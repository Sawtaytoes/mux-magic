import { analyseDiscBackup } from "@mux-magic/core/src/app-commands/analyseDiscBackup.js"
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
      '$0 analyseDiscBackup "/media/Disc-Rips/[BACKUP] Desk Set - Blu-ray"',
      "Read the backup's BDMV tree and propose which titles to rip. Writes DISC-ANALYSIS/analysis.json inside the backup; nothing else is touched.",
    )
    .example(
      '$0 analyseDiscBackup "/media/Disc-Rips/[BACKUP] SOYLENT GREEN - UHD - 4K" --disabledRuleNames isTrackSuperset',
      "Same, with one heuristic switched off by name.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "A `[BACKUP]` folder produced by rip-deck. Read directly as a BDMV tree — no disc needed.",
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
        "MakeMKV's minimum title length. Defaults to 10, the floor that drops BDMV fragments without dropping short extras. Pass 0 to see everything.",
      type: "number",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const analyseDiscBackupCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,
  command: "analyseDiscBackup <sourcePath>",
  describe:
    "Analyse a disc backup and propose which titles to rip, clustering the near-duplicates and stating a reason for every proposal. Read-only: nothing is ripped, moved or deleted.",
  handler: (argv) => {
    analyseDiscBackup({
      disabledRuleNames: argv.disabledRuleNames,
      minimumTitleLengthSeconds:
        argv.minimumTitleLengthSeconds,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
