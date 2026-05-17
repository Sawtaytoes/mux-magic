import { addSubtitles } from "@mux-magic/server/src/app-commands/addSubtitles.js"
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
      '$0 addSubtitles "G:\\Anime\\Code Geass Subs" "G:\\Anime\\Code Geass"',
      "Adds subtitles to all media files with a corresponding folder in the subs folder that shares the exact same name (minus the extension).",
    )
    .positional("subtitlesPath", {
      demandOption: true,
      describe:
        "Directory containing subdirectories with subtitle files and `attachments/` that match the name of the media files in `sourcePath`.",
      type: "string",
    })
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Directory with media files that need subtitles.",
      type: "string",
    })
    .positional("offsets", {
      array: true,
      default: [] satisfies number[],
      demandOption: false,
      describe:
        "Space-separated list of time-alignment offsets to set for each individual file in milliseconds.",
      type: "number",
    })
    .option("hasChapterSyncOffset", {
      alias: "a",
      default: false,
      describe:
        "Compute the audio sync offset by aligning chapter 1 between the destination media file's Menu track and a chapters.xml inside the subtitles path. Falls back to globalOffset (or per-file offsets) when no chapters.xml is found.",
      nargs: 0,
      type: "boolean",
    })
    .option("globalOffset", {
      alias: "o",
      default: 0,
      describe:
        "The offset in milliseconds to apply to all audio being transferred.",
      nargs: 1,
      number: true,
      type: "number",
    })
    .option("includeChapters", {
      alias: "c",
      default: false,
      describe: "Adds chapters along with other tracks.",
      nargs: 0,
      type: "boolean",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const addSubtitlesCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command:
    "addSubtitles <subtitlesPath> <sourcePath> [offsets...]",
  describe:
    "Mux a folder of per-file subtitle directories into matching media files (preserves attachments and optional chapters.xml).",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    addSubtitles({
      globalOffsetInMilliseconds: argv.globalOffset,
      hasChapterSyncOffset: argv.hasChapterSyncOffset,
      hasChapters: argv.includeChapters,
      sourcePath: argv.sourcePath,
      offsetsInMilliseconds: argv.offsets,
      subtitlesPath: argv.subtitlesPath,
    }).subscribe(subscribeCli())
  },
}
