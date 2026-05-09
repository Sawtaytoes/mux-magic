import type { Argv, CommandBuilder, CommandModule } from "yargs"

import { replaceFlacWithPcmAudio } from "../app-commands/replaceFlacWithPcmAudio.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> = T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) => (
  yargs
  .example(
    "$0 replaceFlacWithPcmAudio \"~/anime\"",
    "Replaces FLAC audio tracks in media files with a PCM conversion in '~/anime'.",
  )
  .example(
    "$0 replaceFlacWithPcmAudio \"~/anime\" -r",
    "Recursively replaces FLAC audio tracks in media files with a PCM conversion in '~/anime'.",
  )
  .positional(
    "sourcePath",
    {
      demandOption: true,
      describe: "Directory containing media files or containing other directories of media files.",
      type: "string",
    },
  )
  .option(
    "isRecursive",
    {
      alias: "r",
      boolean: true,
      default: false,
      describe: "Recursively looks in folders for media files.",
      nargs: 0,
      type: "boolean",
    },
  )
)

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const replaceFlacWithPcmAudioCommand: CommandModule<{}, Args> = {
  command: "replaceFlacWithPcmAudio <sourcePath>",
  describe: "Converts any FLAC audio tracks in media files to PCM tracks at the same bit depth. This is especially useful when you might have acquired a copy of media that came with FLAC audio and want PCM audio for compatibility with your home theater system.",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    replaceFlacWithPcmAudio({
      isRecursive: (
        argv
        .isRecursive
      ),
      sourcePath: (
        argv
        .sourcePath
      ),
    })
    .subscribe(subscribeCli())
  },
}
