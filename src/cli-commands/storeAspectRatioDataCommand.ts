import type { Argv, CommandBuilder, CommandModule } from "yargs"

import { storeAspectRatioData } from "../app-commands/storeAspectRatioData.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> = T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) => (
  yargs
  .example(
    "$0 storeAspectRatioData \"~/media-files\"",
    "Looks through all folders in '~/media-files', finds any new files that don't have aspect ratio data, calculates it, and appends the JSON file.",
  )
  .example(
    "$0 storeAspectRatioData \"~/media-files\" -f -o \"~/\"",
    "Looks through all folders in '~/media-files', finds all media files, calculates an aspect ratio, and creates a brand new JSON file at `~/`.",
  )
  .example(
    "$0 storeAspectRatioData \"~/movies\" -r -d 2",
    "Recursively looks through all folders in '~/movies' and child folders, finds any new files that don't have aspect ratio data, calculates it, and appends the JSON file.",
  )
  .example(
    "$0 storeAspectRatioData \"G:\\\" -r -d 3 \"Anime\" \"Movies\" --rootPath \"/media/Family\"",
    "Recursively looks through all folders in 'G:\\Anime' and 'G:\\Movies' and child folders, finds any new files that don't have aspect ratio data, calculates it, and appends the JSON file.",
  )
  .example(
    "MAX_THREADS=2 $0 storeAspectRatioData \"~/media-files\"",
    "Looks through all folders in '~/media-files', finds any new files that don't have aspect ratio data, calculates it limited to only 2 CPU threads (set via the MAX_THREADS env var), and appends the JSON file.",
  )
  .positional(
    "sourcePath",
    {
      demandOption: true,
      describe: "Directory containing media files or containing other directories of media files.",
      type: "string",
    },
  )
  .positional(
    "folders",
    {
      array: true,
      default: [] satisfies string[],
      demandOption: false,
      describe: "List of folder names relative to the `sourcePath` that you want to look through. If you're searching a root path with lots of media files, but only some are in Plex, this can reduce the list down to only those provided to Plex. Ensure these folder names match the ones in Plex.",
      type: "string",
    },
  )
  .option(
    "force",
    {
      alias: "f",
      boolean: true,
      default: false,
      describe: "Instead of appending the current JSON file, it will rescan every file.",
      nargs: 0,
      type: "boolean",
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
  .option(
    "outputPath",
    {
      alias: "o",
      describe: "Location of the resulting JSON file. If using append mode, it will search here for the JSON file. By default, this uses the `sourcePath`.",
      nargs: 1,
      number: true,
      type: "string",
    },
  )
  .option(
    "recursiveDepth",
    {
      alias: "d",
      default: 0,
      describe: "How many deep of child directories to follow (2 or 3) when using `isRecursive`.",
      nargs: 1,
      number: true,
      type: "number",
    },
  )
  .option(
    "rootPath",
    {
      alias: "p",
      describe: "Plex might see your files differently than the computer running this command. To ensure the JSON file is correctly built, you can specify the root path Plex uses. This will automatically change the path separator (`/` or `\\` to match) the one provided.",
      nargs: 1,
      number: true,
      type: "string",
    },
  )
)

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const storeAspectRatioDataCommand: CommandModule<{}, Args> = {
  command: "storeAspectRatioData <sourcePath> [folders...]",
  describe: "Output a JSON file in the source path containing crop data for all listed media files. Crop data includes the aspect ratio of each media file. Files are typically all 16:9, but may have black bars. This identifies those internal resolutions separate from the media file itself.",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    storeAspectRatioData({
      folderNames: (
        argv
        .folders
      ),
      isRecursive: (
        argv
        .isRecursive
      ),
      mode: (
        argv.force
        ? "overwrite"
        : "append"
      ),
      outputPath: (
        argv
        .outputPath
      ),
      recursiveDepth: (
        argv
        .recursiveDepth
      ),
      rootPath: (
        argv
        .rootPath
      ),
      sourcePath: (
        argv
        .sourcePath
      ),
    })
    .subscribe(subscribeCli())
  },
}
