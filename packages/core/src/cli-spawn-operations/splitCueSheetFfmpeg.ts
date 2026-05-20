import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import { concatMap, from, map } from "rxjs"
import { runFfmpeg } from "./runFfmpeg.js"

// Thin per-track wrapper around runFfmpeg. We pass START / END
// AFTER the input via runFfmpeg's `args` (runFfmpeg injects -i
// internally before `args` — confirmed in its source). That keeps
// the seek in output-seek mode for sample-accurate splits with
// `-c:a flac` re-encoding (NOT `-c copy`, which seeks by keyframe).
//
// The arg order check is asserted in the app-command's golden-path
// test as a regression guard against anyone "optimizing" the seek to
// input-seek mode.
export const splitCueSheetFfmpeg = ({
  inputAudioPath,
  outputFilePath,
  startSeconds,
  endSeconds,
}: {
  inputAudioPath: string
  outputFilePath: string
  startSeconds: number
  endSeconds: number
}) =>
  from(
    mkdir(dirname(outputFilePath), { recursive: true }),
  ).pipe(
    concatMap(() =>
      runFfmpeg({
        args: [
          "-ss",
          startSeconds.toFixed(6),
          "-to",
          endSeconds.toFixed(6),
          "-c:a",
          "flac",
          "-map_metadata",
          "0",
        ],
        inputFilePaths: [inputAudioPath],
        outputFilePath,
      }),
    ),
    map(() => outputFilePath),
  )
