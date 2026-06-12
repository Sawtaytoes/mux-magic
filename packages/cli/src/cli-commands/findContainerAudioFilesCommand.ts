import { findContainerAudioFiles } from "@mux-magic/core/src/app-commands/findContainerAudioFiles.js"
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
      '$0 findContainerAudioFiles "~/music"',
      "Probe all .mkv / .mp4 / .m4v / .mov / .webm / .avi files in '~/music' with MediaInfo and report per-file track summaries.",
    )
    .example(
      '$0 findContainerAudioFiles "~/music" -r',
      "Recursively descends one level into subdirectories.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Directory containing container-with-video files (.mkv / .mp4 / .m4v / .mov / .webm / .avi) to probe.",
      type: "string",
    })
    .option("isRecursive", {
      alias: "r",
      boolean: true,
      default: false,
      describe:
        "Recursively descends one level into subdirectories looking for container-with-video files.",
      nargs: 0,
      type: "boolean",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const findContainerAudioFilesCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "findContainerAudioFiles <sourcePath>",
  describe:
    "Probe container-with-video files (.mkv / .mp4 / .m4v / .mov / .webm / .avi) with MediaInfo and report per-file track summaries (audio track count, video track count, audio codec, hasVideoTrack). Pure read — no filesystem mutation.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    findContainerAudioFiles({
      isRecursive: argv.isRecursive,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
