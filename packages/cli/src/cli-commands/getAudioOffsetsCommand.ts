import { getAudioOffsets } from "@mux-magic/server/src/app-commands/getAudioOffsets.js"
import { subscribeCli } from "@mux-magic/server/src/tools/subscribeCli.js"
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
      '$0 getAudioOffsets "G:\\Anime\\Code Geass Good Audio" "G:\\Anime\\Code Geass Bad Audio"',
      "For all media files that have matching names (minus the extension), it calculates and prints the audio offset.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Directory with containing media files with tracks you want to copy.",
      type: "string",
    })
    .positional("destinationFilesPath", {
      demandOption: true,
      describe:
        "Directory containing media files with tracks you want replaced.",
      type: "string",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const getAudioOffsetsCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command:
    "getAudioOffsets <sourcePath> <destinationFilesPath>",
  describe:
    "Get the audio offset of media files in two directories where files share the same name.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    getAudioOffsets({
      destinationFilesPath: argv.destinationFilesPath,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
