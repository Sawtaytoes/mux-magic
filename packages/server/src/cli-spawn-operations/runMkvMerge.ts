import { spawn } from "node:child_process"
import { unlink } from "node:fs/promises"
import {
  logAndSwallowPipelineError,
  logWarning,
} from "@mux-magic/tools"
import colors from "ansi-colors"
import cliProgress from "cli-progress"
import { Observable } from "rxjs"
import { getActiveJobId } from "../api/logCapture.js"
import { mkvMergePath } from "../tools/appPaths.js"
import { createTtyAffordances } from "../tools/createTtyAffordances.js"
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

const progressRegex = /Progress: (\d+)%/

export const runMkvMerge = ({
  args,
  outputFilePath,
}: {
  args: string[]
  outputFilePath: string
}): Observable<string> =>
  new Observable<string>((observer) => {
    // Bind a per-file progress emitter to the active job (if any).
    // Each runMkvMerge invocation handles a single output file — the
    // tracker publishes that file's progress as a row in the
    // emitter's currentFiles snapshot. The iterator that wraps these
    // calls (Phase 4 withFileProgress) drives the overall i/N rollup
    // separately.
    const jobId = getActiveJobId()
    const emitter =
      jobId !== undefined
        ? createProgressEmitter(jobId)
        : null
    const tracker =
      emitter !== null
        ? emitter.startFile(outputFilePath)
        : null

    const commandArgs = [
      "--output",
      outputFilePath,

      ...args,
    ]

    console.info([mkvMergePath].concat(commandArgs), "\n")

    const childProcess = spawn(mkvMergePath, commandArgs)

    const tty = createTtyAffordances(childProcess)

    let hasStarted = false
    // Same shape of bug we fixed in runMkvExtract / getMkvInfo: mkvmerge
    // can write informational lines to stderr (warnings on weird-but-valid
    // containers, codec advisories, etc.). Erroring on the first stderr
    // byte tore the SSE stream / sequence runner down mid-job — buffer
    // here, surface only on non-zero exit.
    const stderrChunks: string[] = []

    childProcess.stdout.on("data", (data) => {
      if (data.toString().startsWith("Progress:")) {
        const percent = Number(
          data.toString().replace(progressRegex, "$1"),
        )
        // Feed the same parsed percentage to the SSE-progress
        // tracker so API consumers see the same data the TTY bar
        // shows. Throttling lives inside the emitter.
        if (tracker !== null)
          tracker.setRatio(percent / 100)
        // cli-progress writes carriage-return redraws straight to
        // process.stdout. In API/daemon context those bytes leak
        // into the server log stream — gate the bar to TTY mode.
        if (tty.useTtyAffordances) {
          if (!hasStarted) {
            hasStarted = true

            cliProgressBar.start(100, percent, {})
          } else {
            cliProgressBar.update(percent)
          }
        }
      } else {
        console.info(data.toString())
      }
    })

    childProcess.stderr.on("data", (chunk) => {
      const text = chunk.toString()
      stderrChunks.push(text)
      console.info(text)
    })

    childProcess.on("close", (code) => {
      if (code === null) {
        unlink(outputFilePath).then(() => {
          logWarning(
            "mkvmerge",
            "Process canceled by user.",
          )

          if (tty.useTtyAffordances) {
            setTimeout(() => {
              process.exit()
            }, 500)
          }
        })
      }
    })

    childProcess.on("exit", (code) => {
      if (tty.useTtyAffordances) {
        cliProgressBar.stop()
      }
      tty.detach()
      if (tracker !== null) tracker.finish()

      if (code === 0) {
        observer.next(outputFilePath)
        observer.complete()
        return
      }
      // code === null is the user-cancel path the 'close' handler resolves.
      // Any other non-zero exit is a real failure — attach the captured
      // stderr so consumers see what mkvmerge complained about.
      if (code !== null) {
        observer.error(
          new Error(
            `mkvmerge exited with code ${code}` +
              (stderrChunks.length
                ? `: ${stderrChunks.join("").trim()}`
                : ""),
          ),
        )
      }
    })

    // Wrap the tree-kill teardown so an unsubscribe (e.g. cancelJob)
    // also drops this file from the emitter's active set. Idempotent
    // with the 'exit'-handler tracker.finish() above.
    const treeKillTeardown =
      treeKillOnUnsubscribe(childProcess)
    return () => {
      if (tracker !== null) tracker.finish()
      treeKillTeardown()
    }
  }).pipe(logAndSwallowPipelineError(runMkvMerge))
