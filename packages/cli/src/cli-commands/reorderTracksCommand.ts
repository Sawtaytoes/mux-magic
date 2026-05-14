import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { reorderTracks } from "@mux-magic/server/src/app-commands/reorderTracks.js"
import { subscribeCli } from "@mux-magic/server/src/tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 reorderTracks "G:\\Anime\\dot.hack--SIGN" -s 1 0',
      "This reorders subtitles track 2 to position 1.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Directory with containing media files with tracks you want to copy.",
      type: "string",
    })
    .option("audioTrackIndexes", {
      alias: "a",
      array: true,
      default: [] as number[],
      describe:
        "The order of all audio tracks that will appear in the resulting file by their index. Indexes start at `0`. If you leave out any track indexes, they will not appear in the resulting file.",
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
    .option("subtitlesTrackIndexes", {
      alias: "s",
      array: true,
      default: [] as number[],
      describe:
        "The order of all subtitles tracks that will appear in the resulting file by their index. Indexes start at `0`. If you leave out any track indexes, they will not appear in the resulting file.",
      type: "string",
    })
    .option("isSkipOnTrackMisalignment", {
      boolean: true,
      default: false,
      describe:
        "Skip files whose track count doesn't match the supplied indexes instead of erroring. Tracks should align if the command was added correctly.",
      nargs: 0,
      type: "boolean",
    })
    .option("videoTrackIndexes", {
      alias: "v",
      array: true,
      default: [] as number[],
      describe:
        "The order of all video tracks that will appear in the resulting file by their index. Indexes start at `0`. If you leave out any track indexes, they will not appear in the resulting file.",
      type: "string",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const reorderTracksCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "reorderTracks <sourcePath>",
  describe:
    "Swap the order of tracks. This is especially helpful when watching media files in a different language, and the translated subtitles track is the second one.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    reorderTracks({
      audioTrackIndexes: argv.audioTrackIndexes.map(
        (value) => Number(value),
      ),
      isRecursive: argv.isRecursive,
      isSkipOnTrackMisalignment:
        argv.isSkipOnTrackMisalignment,
      sourcePath: argv.sourcePath,
      subtitlesTrackIndexes: argv.subtitlesTrackIndexes.map(
        (value) => Number(value),
      ),
      videoTrackIndexes: argv.videoTrackIndexes.map(
        (value) => Number(value),
      ),
    }).subscribe(subscribeCli())
  },
}
