import { copyAudioReleaseDateIntoDate } from "@mux-magic/core/src/app-commands/copyAudioReleaseDateIntoDate.js"
import { subscribeCli } from "@mux-magic/core/src/tools/subscribeCli.js"
import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

type InferArgvOptions<T> =
  T extends Argv<infer Options> ? Options : never

const builder = (yargs: Argv) =>
  yargs
    .positional("sourcePath", {
      demandOption: true,
      describe: "The folder containing audio files.",
      type: "string",
    })
    .option("isDryRun", {
      boolean: true,
      default: true,
      describe: "Report changes without writing tags.",
      type: "boolean",
    })
    .option("isRecursive", {
      alias: "recursive",
      boolean: true,
      default: false,
      describe: "Include audio files in child folders.",
      type: "boolean",
    })
    .option("recursiveDepth", {
      default: 1,
      describe: "The maximum child-folder depth.",
      type: "number",
    })
    .option("isTimestampPreserved", {
      boolean: true,
      default: true,
      describe:
        "Restore each file's modified time after writing.",
      type: "boolean",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const copyAudioReleaseDateIntoDateCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "copyAudioReleaseDateIntoDate <sourcePath>",
  describe:
    "Copy each audio file's Release Date into Date when Date is missing.",
  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,
  handler: (argv) => {
    copyAudioReleaseDateIntoDate({
      isDryRun: argv.isDryRun,
      isRecursive: argv.isRecursive,
      isTimestampPreserved: argv.isTimestampPreserved,
      recursiveDepth: argv.recursiveDepth,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
