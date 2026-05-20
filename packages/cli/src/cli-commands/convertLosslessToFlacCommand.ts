import { convertLosslessToFlac } from "@mux-magic/core/src/app-commands/convertLosslessToFlac.js"
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
      '$0 convertLosslessToFlac "~/music"',
      "Encodes any .wav / .aif / .aiff / .m4a / .m4b files in '~/music' to FLAC in-place (strictly lossless).",
    )
    .example(
      '$0 convertLosslessToFlac "~/music" -r',
      "Recursively descends one level into subdirectories (default depth).",
    )
    .example(
      '$0 convertLosslessToFlac "~/music" -r --recursiveDepth 3',
      "Recursively descends three levels of subdirectories.",
    )
    .example(
      '$0 convertLosslessToFlac "~/music" --delete-source',
      "Encodes to FLAC and removes the source file after each successful encode.",
    )
    .example(
      '$0 convertLosslessToFlac "~/music" -ra',
      "Dry-run audit: recursively probe every lossless audio file and report what would be converted vs. skipped (float / DSD), without invoking ffmpeg or writing any FLAC files.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Directory containing lossless audio files (.wav / .wave / .aif / .aiff / .m4a / .m4b) or directories of them.",
      type: "string",
    })
    .option("isRecursive", {
      alias: "r",
      boolean: true,
      default: false,
      describe:
        "Recursively descends into subdirectories looking for accepted lossless audio files. Depth is controlled by --recursiveDepth (default 1).",
      nargs: 0,
      type: "boolean",
    })
    .option("recursiveDepth", {
      default: 0,
      describe:
        "Maximum recursion depth when --isRecursive is set (0 = default depth of 1).",
      type: "number",
    })
    .option("isSourceDeleted", {
      alias: "delete-source",
      boolean: true,
      default: false,
      describe:
        "When set, deletes each source file after its FLAC encode succeeds. Defaults to keeping the originals.",
      nargs: 0,
      type: "boolean",
    })
    .option("isAuditOnly", {
      alias: "a",
      boolean: true,
      default: false,
      describe:
        "Dry-run: probe each file and report what would be converted vs. skipped (and why), but do not invoke ffmpeg or write any FLAC files. Source files are never touched. Useful for scanning a music library before committing to the encode.",
      nargs: 0,
      type: "boolean",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const convertLosslessToFlacCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "convertLosslessToFlac <sourcePath>",
  describe:
    "Encodes lossless audio files (.wav / .wave / .aif / .aiff / .m4a / .m4b) to FLAC in-place. Strictly lossless — channels, bit depth, sample rate, and metadata are preserved. Optionally deletes each source file after a successful encode.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    convertLosslessToFlac({
      isAuditOnly: argv.isAuditOnly,
      isRecursive: argv.isRecursive,
      isSourceDeleted: argv.isSourceDeleted,
      recursiveDepth: argv.recursiveDepth,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
