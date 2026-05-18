import { spawn } from "node:child_process"
import { unlink } from "node:fs/promises"
import { extname } from "node:path"
import {
  logAndSwallowPipelineError,
  logInfo,
  logWarning,
} from "@mux-magic/tools"
import colors from "ansi-colors"
import cliProgress from "cli-progress"
import {
  concatMap,
  from,
  mergeMap,
  Observable,
  reduce,
} from "rxjs"
import { getActiveJobId } from "../api/logCapture.js"
import { ffmpegPath as defaultFfmpegPath } from "../tools/appPaths.js"
import { getFileDuration } from "../tools/getFileDuration.js"
import { getMediaInfo } from "../tools/getMediaInfo.js"
import { convertTimecodeToMilliseconds } from "../tools/parseTimestamps.js"
import { createProgressEmitter } from "../tools/progressEmitter.js"
import { treeKillOnUnsubscribe } from "./treeKillChild.js"

const cliProgressBar = new cliProgress.SingleBar({
  format: "Progress |".concat(
    colors.cyan("{bar}"),
    "| {percentage}%",
  ),
  barCompleteChar: "\u2588",
  barIncompleteChar: "\u2591",
  hideCursor: true,
})

// frame=  478 fps= 52 q=16.0 size=   38656kB time=00:00:19.93 bitrate=15883.9kbits/s speed=2.18x
const progressRegex = /.*time=(.+) bitrate=.*\r?/

export type ExtensionMimeType = ".otf" | ".ttf"

export const extensionMimeType: Record<
  ExtensionMimeType,
  string
> = {
  ".otf": "mimetype=application/x-opentype-font",
  ".ttf": "mimetype=application/x-truetype-font",
}

export const convertNaNToTimecode = (timecode: string) =>
  timecode.replace(/\d{2}:\d{2}:\d{2}\.\d+/, "") === ""
    ? timecode
    : "00:00:00.00"

export const runFfmpeg = ({
  args,
  envVars,
  ffmpegPath = defaultFfmpegPath,
  inputFilePaths,
  outputFilePath,
}: {
  args: string[]
  envVars?: Record<string, string>
  ffmpegPath?: string
  inputFilePaths: string[]
  outputFilePath: string
}): Observable<string> =>
  from(inputFilePaths).pipe(
    mergeMap((inputFilePath) =>
      getMediaInfo(inputFilePath).pipe(
        mergeMap((mediaInfo) =>
          getFileDuration({
            mediaInfo,
          }),
        ),
      ),
    ),
    reduce(
      (longestDuration, duration) =>
        duration > longestDuration
          ? duration
          : longestDuration,
      0,
    ),
    concatMap(
      (duration) =>
        new Observable<string>((observer) => {
          // In API/job context the server runs as a long-lived daemon; the CLI
          // affordances below (stdin raw mode, cli-progress bar drawing, and
          // process.exit on cancel) all break that environment — they leak
          // stdin listeners, spam the dev-watcher's stdout, and could crash
          // the server. Guard them here.
          const jobId = getActiveJobId()
          const totalDurationMs = duration * 1000
          const emitter =
            jobId !== undefined
              ? createProgressEmitter(jobId)
              : null
          const isInApiContext = emitter !== null
          const isUsingTtyAffordances =
            !isInApiContext && Boolean(process.stdin.isTTY)
          const tracker =
            emitter !== null
              ? emitter.startFile(outputFilePath)
              : null

          const commandArgs = [
            "-hide_banner",

            "-loglevel",
            "info",

            "-y",

            "-stats",

            ...inputFilePaths
              .filter(
                (inputFilePath) =>
                  extname(inputFilePath) !== ".xml",
              )
              .flatMap((inputFilePath) => [
                "-i",
                inputFilePath,
              ]),

            ...args,

            // ...(
            //   (
            //     attachmentFilePaths
            //     || []
            //   )
            //   .map((
            //     attachmentFilePath,
            //   ) => ({
            //     attachmentFilePath,
            //     fileExtension: (
            //       extname(
            //         attachmentFilePath
            //       )
            //     ),
            //   }))
            //   .filter(({
            //     fileExtension,
            //   }) => (
            //     fileExtension
            //     in extensionMimeType
            //   ))
            //   .flatMap(({
            //     attachmentFilePath,
            //     fileExtension,
            //   }) => ([
            //     "-attach",
            //     attachmentFilePath,
            //     "-metadata:s:t",
            //     (
            //       extensionMimeType
            //       [fileExtension as ExtensionMimeType]
            //     ),
            //   ]))
            // ),

            outputFilePath,
          ].filter(Boolean)

          logInfo(
            "FFMPEG",
            [ffmpegPath].concat(commandArgs).join(" "),
          )

          const childProcess = spawn(
            ffmpegPath,
            commandArgs,
            {
              env: {
                ...process.env,
                ...envVars,
              },
            },
          )

          let hasStarted = false

          childProcess.stdout.on("data", (data) => {
            logInfo("FFMPEG", data.toString())
          })

          childProcess.stderr.on("data", (data) => {
            if (data.toString().includes("time=")) {
              const elapsedMs =
                convertTimecodeToMilliseconds(
                  convertNaNToTimecode(
                    data
                      .toString()
                      .replace(progressRegex, "$1"),
                  ),
                )

              // SSE progress: emit even in API context (where the
              // TTY bar is suppressed). Throttling lives in the emitter.
              if (tracker !== null && totalDurationMs > 0) {
                tracker.setRatio(
                  Math.min(1, elapsedMs / totalDurationMs),
                )
              }

              if (!isUsingTtyAffordances) {
                // No TTY bar in API context — skip the cli-progress
                // draws so the dev watcher's stdout isn't flooded
                // with carriage-returned redraws.
                return
              }
              if (hasStarted) {
                cliProgressBar.update(elapsedMs)
              } else {
                hasStarted = true

                cliProgressBar.start(
                  totalDurationMs,
                  elapsedMs,
                  {},
                )
              }
            } else {
              logInfo("FFMPEG", data.toString())
            }
          })

          // CTRL+C handler — wired up to process.stdin only in CLI/TTY mode.
          // Held in a const so the listener can be removed on exit (otherwise
          // each runFfmpeg call leaks one listener).
          const stdinDataHandler = isUsingTtyAffordances
            ? (inputBuffer: Buffer) => {
                const key = inputBuffer.toString()

                // [CTRL][C]
                if (key === "") {
                  childProcess.kill()
                } else {
                  process.stdout.write(key)
                }
              }
            : null
          childProcess.on("close", (code) => {
            if (code === null) {
              unlink(outputFilePath).then(() => {
                logWarning(
                  "ffmpeg",
                  "Process canceled by user.",
                )

                if (isUsingTtyAffordances) {
                  setTimeout(() => {
                    process.exit()
                  }, 500)
                }
              })
            }
          })

          childProcess.on("exit", (code) => {
            if (tracker !== null) tracker.finish()
            if (code === 0) {
              observer.next(outputFilePath)
            }

            observer.complete()

            if (isUsingTtyAffordances) {
              cliProgressBar.stop()
              process.stdin.setRawMode(false)
              if (stdinDataHandler) {
                process.stdin.removeListener(
                  "data",
                  stdinDataHandler,
                )
              }
              process.stdin.pause()
            }

            childProcess.stderr.unpipe()

            childProcess.stderr.destroy()

            childProcess.stdout.unpipe()

            childProcess.stdout.destroy()

            childProcess.stdin.end()

            childProcess.stdin.destroy()
          })

          if (isUsingTtyAffordances) {
            process.stdin.setRawMode(true)
            process.stdin.resume()
            process.stdin.setEncoding("utf8")
            if (stdinDataHandler) {
              process.stdin.on("data", stdinDataHandler)
            }
          }

          // Wrap the tree-kill teardown so an unsubscribe (e.g. cancelJob)
          // also drops this file from the emitter's active set. Idempotent
          // with the 'exit'-handler tracker.finish() above (subsequent
          // finish/finalize on a removed tracker is a no-op since the
          // tracker holds its own removed-flag implicitly via the Map
          // delete).
          const treeKillTeardown =
            treeKillOnUnsubscribe(childProcess)
          return () => {
            if (tracker !== null) tracker.finish()
            treeKillTeardown()
          }
        }),
    ),
    logAndSwallowPipelineError(runFfmpeg),
  )
