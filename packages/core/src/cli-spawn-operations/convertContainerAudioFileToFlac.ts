import { unlink } from "node:fs/promises"
import { basename, dirname, extname, join } from "node:path"
import { concatMap, defer, from, map, of } from "rxjs"
import { runFfmpeg } from "./runFfmpeg.js"

type ConvertContainerAudioFileToFlacRequiredProps = {
  audioCodec: string | null
  filePath: string
}

type ConvertContainerAudioFileToFlacOptionalProps = {
  isSourceDeleted?: boolean
}

export type ConvertContainerAudioFileToFlacProps =
  ConvertContainerAudioFileToFlacRequiredProps &
    ConvertContainerAudioFileToFlacOptionalProps

export const convertContainerAudioFileToFlacDefaultProps = {
  isSourceDeleted: false,
} satisfies ConvertContainerAudioFileToFlacOptionalProps

// Two strictly-lossless arg arrays — no -ar, -ac, or -sample_fmt.
// -vn removes every video stream from the output (the explicit acknowledgement
// of video-track loss that the safety gate enforces in the app-command).
// -c:a copy is used when the audio is already FLAC (lossless demux, zero
// re-encode overhead). Otherwise -c:a flac re-encodes to FLAC — channels,
// bit depth, and sample rate are preserved by ffmpeg's flac encoder by
// default; the lossless guarantee is enforced here by the *absence* of
// resample/remix/bit-depth flags.
const FLAC_REENCODE_ARGS = [
  "-vn",
  "-c:a",
  "flac",
  "-map_metadata",
  "0",
] as const

const FLAC_DEMUX_ARGS = [
  "-vn",
  "-c:a",
  "copy",
  "-map_metadata",
  "0",
] as const

const isFlacCodec = (audioCodec: string | null) =>
  audioCodec?.toUpperCase() === "FLAC"

const getInPlaceFlacPath = (sourceFilePath: string) =>
  join(
    dirname(sourceFilePath),
    `${basename(
      sourceFilePath,
      extname(sourceFilePath),
    )}.flac`,
  )

export const convertContainerAudioFileToFlac = ({
  audioCodec,
  filePath,
  isSourceDeleted = convertContainerAudioFileToFlacDefaultProps.isSourceDeleted,
}: ConvertContainerAudioFileToFlacProps) => {
  const args = isFlacCodec(audioCodec)
    ? Array.from(FLAC_DEMUX_ARGS)
    : Array.from(FLAC_REENCODE_ARGS)

  return of(getInPlaceFlacPath(filePath)).pipe(
    concatMap((outputFilePath) =>
      runFfmpeg({
        args,
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
}
