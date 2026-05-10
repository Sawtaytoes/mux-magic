import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import {
  FALLBACK_INTRO_FILENAME,
  FALLBACK_OUTRO_FILENAME,
  mergeOrderedChapters,
} from "../app-commands/mergeOrderedChapters.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 mergeOrderedChapters "~/movies"',
      "Merges media files with ordered chapters and separate intro and outro files.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe: "Directory where demo files are located.",
      type: "string",
    })
    .positional("introFilename", {
      default: FALLBACK_INTRO_FILENAME,
      demandOption: false,
      describe: "Filename of the intro MKV file.",
      type: "string",
    })
    .positional("outroFilename", {
      default: FALLBACK_OUTRO_FILENAME,
      demandOption: false,
      describe: "Filename of the outro MKV file.",
      type: "string",
    })
    .option("insertIntroBeforeChapterNumber", {
      alias: "i",
      demandOption: true,
      describe:
        "Inserts intro before the specified chapter number.",
      type: "number",
    })
    .option("insertOutroBeforeChapterNumber", {
      alias: "o",
      demandOption: true,
      describe:
        "Inserts outro before the specified chapter number.",
      type: "number",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const mergeOrderedChaptersCommand: CommandModule<
  {},
  Args
> = {
  command:
    "mergeOrderedChapters <sourcePath> [introFilename] [outroFilename]",
  describe:
    'Merges media files with ordered chapters and separate intro and outro files. Intro and outro files need to be named "merge-intro.mkv" and "merge-outro.mkv" respectively. NOTE: All FLAC audio tracks have to be converted to PCM first as MKVToolNix can\'t merge FLAC audio tracks.',

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    mergeOrderedChapters({
      insertIntroAtIndex:
        argv.insertIntroBeforeChapterNumber,
      insertOutroAtIndex:
        argv.insertOutroBeforeChapterNumber,
      introFilename: argv.introFilename,
      outroFilename: argv.outroFilename,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
