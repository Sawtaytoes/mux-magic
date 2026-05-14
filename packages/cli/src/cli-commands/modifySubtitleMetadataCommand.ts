import { readFileSync } from "node:fs"
import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { modifySubtitleMetadata } from "@mux-magic/server/src/app-commands/modifySubtitleMetadata.js"
import type { AssModificationRule } from "@mux-magic/server/src/tools/assTypes.js"
import { subscribeCli } from "@mux-magic/server/src/tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 modifySubtitleMetadata "/path/to/subtitles" --rules rules.json',
      "Applies DSL rules from rules.json to all .ass files in the given directory.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Directory containing .ass subtitle files to modify.",
      type: "string",
    })
    .option("rules", {
      demandOption: true,
      describe:
        "Path to a JSON file containing an array of modification rules.",
      type: "string",
    })
    .option("isRecursive", {
      alias: "r",
      boolean: true,
      default: false,
      describe:
        "Recursively search subdirectories for .ass files.",
      nargs: 0,
      type: "boolean",
    })
    .option("recursiveDepth", {
      default: 0,
      describe:
        "Maximum recursion depth when --isRecursive is set (0 = default depth of 2).",
      type: "number",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const modifySubtitleMetadataCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "modifySubtitleMetadata <sourcePath>",
  describe:
    "Applies DSL-driven metadata modifications to ASS subtitle files.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    const rulesJson = readFileSync(argv.rules, "utf-8")
    const rules = JSON.parse(
      rulesJson,
    ) as AssModificationRule[]

    if (!Array.isArray(rules)) {
      console.error("Rules file must contain a JSON array.")
      process.exit(1)
    }

    modifySubtitleMetadata({
      isRecursive: argv.isRecursive,
      recursiveDepth: argv.recursiveDepth,
      rules,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
