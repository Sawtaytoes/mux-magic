import { convertWavToFlac } from "@mux-magic/core/src/app-commands/convertWavToFlac.js"
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
      '$0 convertWavToFlac "~/music"',
      "Encodes .wav files in '~/music' to FLAC in-place (strictly lossless).",
    )
    .example(
      '$0 convertWavToFlac "~/music" -r',
      "Recursively descends one level into subdirectories.",
    )
    .example(
      '$0 convertWavToFlac "~/music" --delete-source',
      "Encodes to FLAC and removes the source .wav after each successful encode.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Directory containing .wav files or directories of .wav files.",
      type: "string",
    })
    .option("isRecursive", {
      alias: "r",
      boolean: true,
      default: false,
      describe:
        "Recursively descends one level into subdirectories looking for .wav files.",
      nargs: 0,
      type: "boolean",
    })
    .option("isSourceDeleted", {
      alias: "delete-source",
      boolean: true,
      default: false,
      describe:
        "When set, deletes each source .wav after its FLAC encode succeeds. Defaults to keeping the originals.",
      nargs: 0,
      type: "boolean",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const convertWavToFlacCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "convertWavToFlac <sourcePath>",
  describe:
    "Encodes .wav files to FLAC in-place. Strictly lossless — channels, bit depth, sample rate, and metadata are preserved. Optionally deletes each source .wav after a successful encode.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    convertWavToFlac({
      isRecursive: argv.isRecursive,
      isSourceDeleted: argv.isSourceDeleted,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
