import { matchMusicRelease } from "@mux-magic/core/src/app-commands/matchMusicRelease.js"
import { subscribeCli } from "@mux-magic/core/src/tools/subscribeCli.js"
import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

type InferArgvOptions<T> =
  T extends Argv<infer Options> ? Options : never

const builder = (yargs: Argv) =>
  yargs
    .positional("sourcePath", {
      demandOption: true,
      describe: "The folder containing one album or disc.",
      type: "string",
    })
    .option("isRecursive", {
      alias: "recursive",
      boolean: true,
      default: false,
      describe: "Include audio files in child folders.",
      type: "boolean",
    })
    .option("language", {
      choices: ["default", "en", "ja", "ja-Latn"] as const,
      default: "default" as const,
      describe: "The title language to request from VGMdb.",
    })
    .option("recursiveDepth", {
      default: 1,
      describe: "The maximum child-folder depth.",
      type: "number",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const matchMusicReleaseCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "matchMusicRelease <sourcePath>",
  describe:
    "Try MusicBrainz, VGMdb, Discogs and freedb, then combine their release candidates.",
  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,
  handler: (argv) => {
    matchMusicRelease({
      isRecursive: argv.isRecursive,
      language: argv.language,
      recursiveDepth: argv.recursiveDepth,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
