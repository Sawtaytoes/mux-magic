import { applyEmbeddedSubtitleDefaults } from "@mux-magic/core/src/app-commands/applyEmbeddedSubtitleDefaults.js"
import { subscribeCli } from "@mux-magic/core/src/tools/subscribeCli.js"
import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

const builder = (yargs: Argv) =>
  yargs
    .positional("sourcePath", {
      demandOption: true,
      type: "string",
      describe:
        "Directory containing staged MKVs. Originals are preserved.",
    })
    .option("isRecursive", {
      alias: "r",
      type: "boolean",
      default: false,
      describe: "Search child folders for MKV files.",
    })
    .option("recursiveDepth", {
      type: "number",
      default: 1,
      describe:
        "Maximum number of child folder levels to search.",
    })

type Arguments =
  ReturnType<typeof builder> extends Argv<infer Options>
    ? Options
    : never

export const applyEmbeddedSubtitleDefaultsCommand: CommandModule<
  Record<string, unknown>,
  Arguments
> = {
  command: "applyEmbeddedSubtitleDefaults <sourcePath>",
  describe:
    "Apply default ASS styles to MKV copies without remuxing media packets.",
  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Arguments
  >,
  handler: (arguments_) => {
    applyEmbeddedSubtitleDefaults({
      sourcePath: arguments_.sourcePath,
      isRecursive: arguments_.isRecursive,
      recursiveDepth: arguments_.recursiveDepth,
    }).subscribe(subscribeCli())
  },
}
