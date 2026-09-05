import { trimFileTail } from "@mux-magic/core/src/app-commands/trimFileTail.js"
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
      '$0 trimFileTail "~/disc-rips/higurashi" "Gou 01-004.mkv" 00:23:41.086',
      "Writes TRIMMED/'Gou 01-004.mkv' holding everything before 00:23:41.086. The source file is left alone.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe: "Directory containing the file to trim.",
      type: "string",
    })
    .positional("fileName", {
      demandOption: true,
      describe:
        "Exact file name inside sourcePath. One file per run — a tail trim is a per-file decision, not a folder-wide one.",
      type: "string",
    })
    .positional("endTime", {
      demandOption: true,
      describe:
        "Keep everything before this timestamp and discard the rest (HH:MM:SS[.mmm]).",
      type: "string",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const trimFileTailCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "trimFileTail <sourcePath> <fileName> <endTime>",
  describe:
    "Removes everything after a timestamp from one video file, writing the result into a TRIMMED subfolder. Useful for the anti-piracy or copyright card a disc appends after the last episode's credits.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    trimFileTail({
      endTime: argv.endTime,
      fileName: argv.fileName,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
