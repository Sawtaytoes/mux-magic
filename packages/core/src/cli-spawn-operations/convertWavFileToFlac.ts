import { unlink } from "node:fs/promises"
import {
  basename,
  dirname,
  extname,
  join,
} from "node:path"
import {
  concatMap,
  defer,
  from,
  map,
  of,
} from "rxjs"
import { runFfmpeg } from "./runFfmpeg.js"

type ConvertWavFileToFlacRequiredProps = {
  filePath: string
}

type ConvertWavFileToFlacOptionalProps = {
  isSourceDeleted?: boolean
}

export type ConvertWavFileToFlacProps =
  ConvertWavFileToFlacRequiredProps &
    ConvertWavFileToFlacOptionalProps

export const convertWavFileToFlacDefaultProps = {
  isSourceDeleted: false,
} satisfies ConvertWavFileToFlacOptionalProps

// Strictly lossless: only `-c:a flac` and `-map_metadata 0`. No `-ar`,
// `-ac`, or `-sample_fmt` — those would resample, remix, or change bit
// depth. FFmpeg's flac encoder preserves channels, sample rate, and bit
// depth from the input by default; the lossless guarantee is enforced
// here by the *absence* of those flags. A unit test in the app-command
// asserts this.
const FLAC_ENCODE_ARGS = [
  "-c:a",
  "flac",
  "-map_metadata",
  "0",
] as const

const getInPlaceFlacPath = (sourceFilePath: string) =>
  join(
    dirname(sourceFilePath),
    `${basename(
      sourceFilePath,
      extname(sourceFilePath),
    )}.flac`,
  )

export const convertWavFileToFlac = ({
  filePath,
  isSourceDeleted = convertWavFileToFlacDefaultProps.isSourceDeleted,
}: ConvertWavFileToFlacProps) =>
  of(getInPlaceFlacPath(filePath)).pipe(
    concatMap((outputFilePath) =>
      runFfmpeg({
        args: Array.from(FLAC_ENCODE_ARGS),
        inputFilePaths: [filePath],
        outputFilePath,
      }).pipe(
        // runFfmpeg only emits when ffmpeg exits 0; a non-zero exit
        // completes the stream without emitting, so this concatMap
        // (and the unlink it conditionally runs) is naturally skipped
        // on failure.
        concatMap((emittedOutputFilePath) =>
          isSourceDeleted
            ? defer(() => from(unlink(filePath))).pipe(
                map(() => emittedOutputFilePath),
              )
            : of(emittedOutputFilePath),
        ),
      ),
    ),
  )
