import type { Argv, CommandBuilder, CommandModule } from "yargs"

import { setDisplayWidth } from "../app-commands/setDisplayWidth.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> = T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) => (
  yargs
  .example(
    "$0 setDisplayWidth \"~/disc-rips/dot-hack--sign\" -w 853",
    "Sets the display width (DAR) of 4:3 video files to 16:9.",
  )
  .positional(
    "sourcePath",
    {
      demandOption: true,
      describe: "Directory where video files are located.",
      type: "string",
    },
  )
  .option(
    "displayWidth",
    {
      alias: "w",
      default: 853,
      describe: "Display width of the video file. For DVDs, they're all 3:2, but you can set them to the proper 4:3 or 16:9 aspect ratio with anamorphic (non-square) pixels using this value. This uncommon in Blu-ray and online media; it's a holdover from the NTSC analog broadcasting days.",
      type: "number",
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
)

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const setDisplayWidthCommand: CommandModule<{}, Args> = {
  command: "setDisplayWidth <sourcePath>",
  describe: "Sets the display width (DAR) of a video file. Helpful when a DVD was incorrectly set to 4:3 rather than 16:9.",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    setDisplayWidth({
      displayWidth: (
        argv
        .displayWidth
      ),
      isRecursive: (
        argv
        .isRecursive
      ),
      recursiveDepth: (
        argv
        .recursiveDepth
      ),
      sourcePath: (
        argv
        .sourcePath
      ),
    })
    .subscribe(subscribeCli())
  },
}
