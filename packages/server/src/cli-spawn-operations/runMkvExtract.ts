import colors from "ansi-colors"
import cliProgress from "cli-progress"
import {
  spawn,
} from "node:child_process";
import {
  Observable,
} from "rxjs"

import { getActiveJobId } from "../api/logCapture.js"
import { mkvExtractPath } from "../tools/appPaths.js";
import { logAndSwallow } from "../tools/logAndSwallow.js"
import { createTtyAffordances } from "../tools/createTtyAffordances.js";
import { unlink } from "node:fs/promises";
import { logWarning } from "../tools/logMessage.js";
import { createProgressEmitter } from "../tools/progressEmitter.js"
import { treeKillOnUnsubscribe } from "./treeKillChild.js"

const cliProgressBar = (
  new cliProgress
  .SingleBar({
    format: (
      "Progress |"
      .concat(
        (
          colors
          .cyan(
            "{bar}"
          )
        ),
        "| {percentage}%",
      )
    ),
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  })
)

const progressRegex = (
  /Progress: (\d+)%/
)

export const runMkvExtract = ({
  args,
  outputFilePath,
}: {
  args: string[]
  outputFilePath: string
}): (
  Observable<
    string
  >
) => (
  new Observable<
    string
  >((
    observer,
  ) => {
    // Bind a per-file progress emitter to the active job (if any).
    // See runMkvMerge.ts for the design rationale — same shape here.
    const jobId = getActiveJobId()
    const emitter = jobId !== undefined ? createProgressEmitter(jobId) : null
    const tracker = emitter !== null ? emitter.startFile(outputFilePath) : null

    const commandArgs = (
      args
    )

    console
    .info(
      (
        [mkvExtractPath]
        .concat(
          commandArgs
        )
      ),
      "\n",
    )

    const childProcess = (
      spawn(
        mkvExtractPath,
        commandArgs,
      )
    )

    const tty = createTtyAffordances(childProcess)

    let hasStarted = false
    // mkvextract writes its 'Extracting track N with CodecID …' banner
    // and other informational status to stderr. Buffer it so the exit
    // handler can include it in an error message on non-zero exit
    // without treating every stderr line as fatal — that's what was
    // tearing down the SSE stream on PGS subtitle extracts.
    const stderrChunks: string[] = []

    childProcess
    .stdout
    .on(
      'data',
      (
        data
      ) => {
        if (
          data
          .toString()
          .startsWith(
            "Progress:"
          )
        ) {
          const percent = Number(
            data
            .toString()
            .replace(
              progressRegex,
              "$1",
            )
          )
          if (
            !hasStarted
          ) {
            hasStarted = true

            cliProgressBar
            .start(
              100,
              percent,
              {},
            )
          }
          else {
            cliProgressBar
            .update(
              percent
            )
          }
          if (tracker !== null) tracker.setRatio(percent / 100)
        }
        else {
          console
          .info(
            data
            .toString()
          )
        }
      },
    )

    childProcess
    .stderr
    .on(
      'data',
      (
        chunk,
      ) => {
        const text = chunk.toString()
        stderrChunks.push(text)
        // Surface stderr in the log stream so the user can see what
        // mkvextract is doing, but don't fail the observable on it —
        // mkvextract reports normal progress (e.g. 'Extracting track N
        // with the CodecID S_HDMV/PGS to the file …') on stderr.
        console.info(text)
      },
    )

    childProcess
    .on(
      'close',
      (
        code,
      ) => {
        if (code === null) {
          unlink(outputFilePath)
          .then(() => {
            logWarning("mkvextract", "Process canceled by user.")

            if (tty.useTtyAffordances) {
              setTimeout(() => {
                process.exit()
              }, 500)
            }
          })
        }
      },
    )

    childProcess
    .on(
      'exit',
      (
        code,
      ) => {
        tty.detach()
        if (tracker !== null) tracker.finish()

        if (code === 0) {
          observer.next(outputFilePath)
          observer.complete()
          return
        }
        // code === null is the user-cancel path handled in 'close';
        // any other non-zero exit is an actual failure and gets the
        // captured stderr attached so the SSE log shows what went wrong.
        if (code !== null) {
          observer.error(new Error(
            `mkvextract exited with code ${code}`
            + (stderrChunks.length ? `: ${stderrChunks.join('').trim()}` : '')
          ))
        }
      },
    )

    // Wrap the tree-kill teardown so an unsubscribe (e.g. cancelJob)
    // also drops this file from the emitter's active set. Idempotent
    // with the 'exit'-handler tracker.finish() above.
    const treeKillTeardown = treeKillOnUnsubscribe(childProcess)
    return () => {
      if (tracker !== null) tracker.finish()
      treeKillTeardown()
    }
  })
  .pipe(
    logAndSwallow(
      runMkvExtract
    ),
  )
)
