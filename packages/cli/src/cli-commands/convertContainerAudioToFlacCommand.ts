import { convertContainerAudioToFlac } from "@mux-magic/core/src/app-commands/convertContainerAudioToFlac.js"
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
      '$0 convertContainerAudioToFlac "~/music"',
      "Probe all .mkv / .mp4 / .m4v / .mov / .webm / .avi files in '~/music'. Files with video tracks are skipped with a warning (set --ack-video-drop to convert them).",
    )
    .example(
      '$0 convertContainerAudioToFlac "~/music" --ack-video-drop',
      "Convert all container audio to FLAC, dropping any video tracks.",
    )
    .example(
      '$0 convertContainerAudioToFlac "~/music" --ack-video-drop --delete-source',
      "Convert to FLAC and remove each source container file after a successful encode.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Directory containing container-with-video files (.mkv / .mp4 / .m4v / .mov / .webm / .avi) to encode to FLAC.",
      type: "string",
    })
    .option("isRecursive", {
      alias: "r",
      boolean: true,
      default: false,
      describe:
        "Recursively descends one level into subdirectories.",
      nargs: 0,
      type: "boolean",
    })
    .option("isSourceDeleted", {
      alias: "delete-source",
      boolean: true,
      default: false,
      describe:
        "When set, deletes each source container file after its FLAC encode succeeds. Defaults to keeping the originals.",
      nargs: 0,
      type: "boolean",
    })
    .option("isVideoDropAcknowledged", {
      alias: "ack-video-drop",
      boolean: true,
      default: false,
      describe:
        "Acknowledge that the video track will be dropped during conversion. Without this flag, files with video tracks are skipped. Run findContainerAudioFiles first to review which files have video tracks.",
      nargs: 0,
      type: "boolean",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const convertContainerAudioToFlacCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "convertContainerAudioToFlac <sourcePath>",
  describe:
    "Encode audio tracks from container-with-video files (.mkv / .mp4 / .m4v / .mov / .webm / .avi) to FLAC in-place, dropping video streams. Strictly lossless — channels, bit depth, sample rate, and metadata are preserved. Already-FLAC audio is demuxed losslessly (-c:a copy). Requires --ack-video-drop to convert files with video tracks.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    convertContainerAudioToFlac({
      isRecursive: argv.isRecursive,
      isSourceDeleted: argv.isSourceDeleted,
      isVideoDropAcknowledged: argv.isVideoDropAcknowledged,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
