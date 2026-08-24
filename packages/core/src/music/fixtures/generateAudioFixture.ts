import { spawn } from "node:child_process"
import { access, mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import { lastValueFrom, toArray } from "rxjs"
import { runFfmpeg } from "../../cli-spawn-operations/runFfmpeg.js"
import { ffmpegPath } from "../../tools/appPaths.js"

export type AudioFixtureFormat =
  | "aiff"
  | "flac"
  | "m4a"
  | "mp3"
  | "ogg"
  | "opus"
  | "wav"

const ENCODER_ARGS_BY_FORMAT: Record<
  AudioFixtureFormat,
  string[]
> = {
  aiff: ["-c:a", "pcm_s16be"],
  flac: ["-c:a", "flac"],
  m4a: ["-c:a", "aac", "-b:a", "128k"],
  mp3: ["-c:a", "libmp3lame", "-b:a", "128k"],
  ogg: ["-c:a", "libvorbis"],
  opus: ["-c:a", "libopus", "-b:a", "96k"],
  wav: ["-c:a", "pcm_s16le"],
}

export const getIsFfmpegAvailable = () =>
  new Promise<boolean>((resolve) => {
    const childProcess = spawn(ffmpegPath, ["-version"], {
      stdio: "ignore",
    })

    childProcess.on("error", () => {
      resolve(false)
    })

    childProcess.on("close", (exitCode) => {
      resolve(exitCode === 0)
    })
  })

const buildMetadataArgs = (tags: Record<string, string>) =>
  Object.entries(tags).flatMap(([tagName, tagValue]) => [
    "-metadata",
    `${tagName}=${tagValue}`,
  ])

export const generateAudioFixture = ({
  durationSeconds = 1,
  format,
  outputPath,
  tags = {},
}: {
  durationSeconds?: number
  format: AudioFixtureFormat
  outputPath: string
  tags?: Record<string, string>
}) =>
  mkdir(dirname(outputPath), { recursive: true })
    .then(() =>
      lastValueFrom(
        runFfmpeg({
          args: [
            "-f",
            "lavfi",
            "-i",
            `sine=frequency=440:duration=${durationSeconds}`,
            ...ENCODER_ARGS_BY_FORMAT[format],
            ...buildMetadataArgs(tags),
          ],
          inputFilePaths: [],
          outputFilePath: outputPath,
        }).pipe(toArray()),
      ),
    )
    .then((generatedFilePaths) =>
      generatedFilePaths.includes(outputPath)
        ? access(outputPath)
        : Promise.reject(
            new Error(
              "ffmpeg exited without an output file",
            ),
          ),
    )
    .then(() => outputPath)
    .catch((error: unknown) =>
      Promise.reject(
        new Error(
          `Cannot generate the ${format} audio fixture at "${outputPath}": ${
            error instanceof Error
              ? error.message
              : String(error)
          }`,
          { cause: error },
        ),
      ),
    )
