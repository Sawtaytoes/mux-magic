import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { hasBetterVersion } from "../app-commands/hasBetterVersion.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 hasBetterVersion "~/movies" -r',
      "Recursively looks through all folders in '~/movies' where a better version is available noted on a criterionforum.org thread.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Directory containing media files or containing other directories of media files.",
      type: "string",
    })
    .option("isRecursive", {
      alias: "r",
      boolean: true,
      default: false,
      describe:
        "Recursively looks in folders for media files.",
      nargs: 0,
      type: "boolean",
    })
    .option("recursiveDepth", {
      alias: "d",
      default: 0,
      describe:
        "How many deep of child directories to follow (2 or 3) when using `isRecursive`.",
      nargs: 1,
      number: true,
      type: "number",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const hasBetterVersionCommand: CommandModule<
  {},
  Args
> = {
  command: "hasBetterVersion <sourcePath>",
  describe:
    "Output a list of Ultra HD Blu-ray releases where a better version is available along with a reason. This information comes from a thread on criterionforum.org.",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    hasBetterVersion({
      isRecursive: argv.isRecursive,
      recursiveDepth: argv.recursiveDepth,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
