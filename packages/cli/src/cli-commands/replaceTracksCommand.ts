import { replaceTracks } from "@mux-magic/core/src/app-commands/replaceTracks.js"
import {
  type Iso6392LanguageCode,
  iso6392LanguageCodes,
} from "@mux-magic/core/src/tools/iso6392LanguageCodes.js"
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
      '$0 replaceTracks "G:\\Anime\\Code Geass Good Audio" "G:\\Anime\\Code Geass Bad Audio" --audio-lang jpn',
      "For all media files that have matching names (minus the extension), it replaces the bad audio media file's audio tracks with Japanese audio tracks from the good audio media file.",
    )
    .example(
      '$0 replaceTracks "G:\\Anime\\Code Geass Good Audio" "G:\\Anime\\Code Geass Bad Audio" --audio-lang jpn 0.3 0.8 0.8 0.8 0.75',
      "For all media files that have matching names (minus the extension), it replaces the bad audio media file's audio tracks with Japanese audio tracks from the good audio media file and time-aligns them by the following values in file alphabetical order: 0.3, 0.8, 0.8, 0.8, 0.75.",
    )
    .example(
      '$0 replaceTracks "G:\\Anime\\Code Geass Subbed" "G:\\Anime\\Code Geass Unsubbed" --subs-lang eng',
      "For all media files that have matching names (minus the extension), it replaces the unsubbed media file's subtitles with English subtitles from the subbed media file.",
    )
    .example(
      '$0 replaceTracks "G:\\Anime\\Code Geass with Chapters" "G:\\Anime\\Code Geass missing Chapters" -c',
      "For all media files that have matching names (minus the extension), it adds chapters to the media files missing them.",
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
    .positional("offsets", {
      array: true,
      default: [] satisfies number[],
      demandOption: false,
      describe:
        "Space-separated list of time-alignment offsets to set for each individual file in milliseconds.",
      type: "string",
    })
    .option("audioLanguages", {
      alias: "audio-lang",
      array: true,
      choices: iso6392LanguageCodes,
      default: [] satisfies Iso6392LanguageCode[],
      describe:
        "A 3-letter ISO-6392 language code for audio tracks to keep. All others will be removed",
      type: "array",
    })
    .option("hasAudioSyncOffset", {
      alias: "a",
      default: false,
      describe:
        "Per-file automatic audio sync: extract both source and destination audio to WAV via ffmpeg and run audio-offset-finder to compute the delay, then use that per-file offset when remuxing. Falls back to globalOffset (or per-file offsets) when disabled.",
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
    .option("isOverwritingExtractedAudio", {
      alias: "overwrite-audio",
      default: false,
      describe:
        "Force re-extraction of the per-file audio-sync WAV files even when a previous extraction is present. Only applies with --hasAudioSyncOffset. Defaults to reusing a cached WAV whose mediaInfo duration matches its input within 1s.",
      nargs: 0,
      type: "boolean",
    })
    .option("subtitlesLanguages", {
      alias: "subs-lang",
      array: true,
      choices: iso6392LanguageCodes,
      default: [] satisfies Iso6392LanguageCode[],
      describe:
        "A 3-letter ISO-6392 language code for subtitles tracks to keep. All others will be removed",
      type: "array",
    })
    .option("videoLanguages", {
      alias: "video-lang",
      array: true,
      choices: iso6392LanguageCodes,
      default: [] satisfies Iso6392LanguageCode[],
      describe:
        "A 3-letter ISO-6392 language code for video tracks to keep. All others will be removed",
      type: "array",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const replaceTracksCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command:
    "replaceTracks <sourcePath> <destinationFilesPath> [offsets...]",
  describe:
    "Copy tracks from one media file and replace them in another making sure to only keep the chosen languages.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    replaceTracks({
      audioLanguages: (
        argv.audioLanguages as Iso6392LanguageCode[]
      ).map((code) => ({ code })),
      destinationFilesPath: argv.destinationFilesPath,
      globalOffsetInMilliseconds: argv.globalOffset,
      hasAudioSyncOffset: argv.hasAudioSyncOffset,
      hasChapters: argv.includeChapters,
      isOverwritingExtractedAudio:
        argv.isOverwritingExtractedAudio,
      offsets: argv.offsets.map((offset) => Number(offset)),
      sourcePath: argv.sourcePath,
      subtitlesLanguages: (
        argv.subtitlesLanguages as Iso6392LanguageCode[]
      ).map((code) => ({ code })),
      videoLanguages: (
        argv.videoLanguages as Iso6392LanguageCode[]
      ).map((code) => ({ code })),
    }).subscribe(subscribeCli())
  },
}
