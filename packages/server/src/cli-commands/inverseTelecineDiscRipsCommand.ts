import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

import { inverseTelecineDiscRips } from "../app-commands/inverseTelecineDiscRips.js"
import {
  type Pulldown,
  type VideoEncoder,
  videoEncoderType,
  videoFilterPulldown,
} from "../cli-spawn-operations/inverseTelecineVideo.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 inverseTelecineDiscRips "~/anime/Gintama"',
      "Converts all media files in '~/anime/Gintama' from 60i to 24p.",
    )
    .example(
      '$0 inverseTelecineDiscRips "~/anime/Heavy Metal L-Gaim" --pd 2:2 --enc cpu',
      "Converts all media files in '~/anime/Heavy Metal L-Gaim' from 60i with a pulldown of 2:2 to 24p using the CPU rather than the GPU.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Directory containing media files or containing other directories of media files.",
      type: "string",
    })
    .option("isConstantBitrate", {
      alias: "cb",
      boolean: true,
      default: false,
      describe:
        "If the bitrate is constant, you can inverse telecine the footage. If it's variable, you need to first convert it to constant bitrate or ffmpeg won't properly inverse telecine.",
      nargs: 0,
      type: "boolean",
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
    .option("pulldown", {
      alias: "pd",
      choices: Object.keys(
        videoFilterPulldown,
      ) as Pulldown[],
      default: "2:3" satisfies Pulldown as Pulldown,
      describe:
        "Defaults to 2:3 pulldown, but sometimes, you'll see 2:2. You can tell when flipping through frames if they don't line up.",
      type: "string",
    })
    .option("videoEncoder", {
      alias: "enc",
      choices: Object.keys(
        videoEncoderType,
      ) as VideoEncoder[],
      default:
        "gpu-nvidia" satisfies VideoEncoder as VideoEncoder,
      describe:
        "Encoder type: CPU or GPU. Defaults to Nvidia GPU.",
      type: "string",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const inverseTelecineDiscRipsCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "inverseTelecineDiscRips <sourcePath>",
  describe:
    "Performs an inverse telecine (IVTC) operation on all files. It will re-encode the video track (and only the video track), so try to do this operation only once as it's a lossy operation. This expects these files to be SDR, 8-bit color, and native 24fps converted to 60i for a Blu-ray or DVD release.",

  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,

  handler: (argv) => {
    inverseTelecineDiscRips({
      isConstantBitrate: argv.isConstantBitrate,
      isRecursive: argv.isRecursive,
      pulldown: argv.pulldown as Pulldown,
      sourcePath: argv.sourcePath,
      videoEncoder: argv.videoEncoder as VideoEncoder,
    }).subscribe(subscribeCli())
  },
}
