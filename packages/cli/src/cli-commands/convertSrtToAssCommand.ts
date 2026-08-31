import { convertSrtToAss } from "@mux-magic/core/src/app-commands/convertSrtToAss.js"
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
      '$0 convertSrtToAss "/path/to/subtitles"',
      "Convert every SRT file in the folder to ASS without changing the SRT files.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe: "Directory containing SRT subtitle files.",
      type: "string",
    })
    .option("isRecursive", {
      alias: "r",
      boolean: true,
      default: false,
      describe:
        "Recursively scan subdirectories for SRT files.",
      nargs: 0,
      type: "boolean",
    })
    .option("recursiveDepth", {
      default: 0,
      describe:
        "Maximum recursion depth when recursive scanning is enabled. Zero uses one level.",
      type: "number",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const convertSrtToAssCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "convertSrtToAss <sourcePath>",
  describe:
    "Convert SRT subtitle files to ASS in a separate CONVERTED-SUBTITLES folder.",
  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,
  handler: (argv) => {
    convertSrtToAss({
      isRecursive: argv.isRecursive,
      recursiveDepth: argv.recursiveDepth,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
