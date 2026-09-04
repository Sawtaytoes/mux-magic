import { spawn } from "node:child_process"
import readline from "node:readline"

import {
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import { Observable } from "rxjs"

import { getActiveJobId } from "../api/logCapture.js"
import {
  makeMkvConPath,
  makeMkvHomePath,
} from "../tools/appPaths.js"
import { buildKeyFailureError } from "../tools/makemkv/buildKeyFailureError.js"
import {
  getIsKeyFailureEvent,
  getSavedTitleCount,
  type MakemkvEvent,
} from "../tools/makemkv/makemkvEvents.js"
import { parseMakemkvLine } from "../tools/makemkv/parseLine.js"
import { createProgressEmitter } from "../tools/progressEmitter.js"
import { treeKillOnUnsubscribe } from "./treeKillChild.js"

/**
 * How much read cache makemkvcon gets, in MB.
 *
 * The info pass uses 1 because it reads no video at all. Extraction reads
 * the whole title, so it gets rip-deck's rip-sized cache.
 */
const extractionCacheMegabytes = 128

/**
 * Rip one title out of a `[BACKUP]` folder to an `.mkv`.
 *
 * `--minlength` is passed here as well as on the info pass, and the two
 * MUST match: makemkvcon assigns title indexes AFTER applying the filter,
 * so the same disc read at 0 and at 10 numbers its titles differently and
 * an index from the wrong pass rips the wrong title. Proof is in
 * `__fixtures__/desk-set-bluray-extract-title.robot.log`, where MSG:3307
 * reports `01395.m2ts was added as title #1` only because 59 shorter
 * titles were filtered out first.
 */
export const runMakeMkvConExtract = ({
  destinationPath,
  minimumTitleLengthSeconds,
  outputFilePath,
  sourcePath,
  titleIndex,
}: {
  destinationPath: string
  minimumTitleLengthSeconds: number
  outputFilePath: string
  sourcePath: string
  titleIndex: number
}): Observable<string> =>
  new Observable<string>((observer) => {
    const jobId = getActiveJobId()
    const emitter =
      jobId === undefined
        ? null
        : createProgressEmitter(jobId)
    const tracker =
      emitter === null
        ? null
        : emitter.startFile(outputFilePath)

    const commandArgs = [
      "-r",
      "--messages=-stdout",
      "--progress=-same",
      `--cache=${extractionCacheMegabytes}`,
      `--minlength=${minimumTitleLengthSeconds}`,
      "mkv",
      `file:${sourcePath}`,
      String(titleIndex),
      destinationPath,
    ]

    logInfo(
      "MAKEMKVCON",
      [makeMkvConPath].concat(commandArgs).join(" "),
    )

    const childProcess = spawn(
      makeMkvConPath,
      commandArgs,
      {
        env:
          makeMkvHomePath === null
            ? process.env
            : { ...process.env, HOME: makeMkvHomePath },
      },
    )

    const events: MakemkvEvent[] = []
    const stderrChunks: string[] = []

    const readlineInterface = readline.createInterface({
      input: childProcess.stdout,
      terminal: false,
    })

    readlineInterface.on("line", (line) => {
      const event = parseMakemkvLine(line)

      events.push(event)

      // PRGV's `total` tracks the PRGT operation — the whole save — and is
      // scaled against `max`, which is NOT always 65536 and is 0 before
      // the operation starts.
      if (event.type === "PRGV" && event.max > 0) {
        tracker?.setRatio(event.total / event.max)
      }

      if (event.type === "MSG") {
        logInfo("MAKEMKVCON", event.message)
      }
    })

    childProcess.stderr.on("data", (chunk) => {
      const text = chunk.toString()

      stderrChunks.push(text)
      logInfo("MAKEMKVCON", text)
    })

    childProcess.on("error", (error) => {
      observer.error(error)
    })

    childProcess.on("exit", (code) => {
      readlineInterface.close()
      tracker?.finish()

      const keyFailureMessages = events.filter(
        getIsKeyFailureEvent,
      )
      const savedTitleCount = getSavedTitleCount(events)

      // Checked BEFORE the exit code, because makemkvcon exits 0 on a key
      // failure just as it does on success.
      if (keyFailureMessages.length > 0) {
        observer.error(
          buildKeyFailureError(keyFailureMessages),
        )
      } else if (code !== 0 && code !== null) {
        // code === null is the unsubscribe/tree-kill path.
        observer.error(
          new Error(
            `makemkvcon exited with code ${code}`.concat(
              stderrChunks.length > 0
                ? `: ${stderrChunks.join("").trim()}`
                : "",
            ),
          ),
        )
      } else if (code === 0 && savedTitleCount === null) {
        observer.error(
          new Error(
            `makemkvcon exited 0 without reporting a saved-title count for title ${titleIndex} of ${sourcePath}. Treating that as a failure rather than trusting the exit code.`,
          ),
        )
      } else if (code === 0 && savedTitleCount === 0) {
        observer.error(
          new Error(
            `makemkvcon saved 0 titles for title ${titleIndex} of ${sourcePath} and still exited 0. Nothing was written.`,
          ),
        )
      } else if (code === 0) {
        observer.next(outputFilePath)
        observer.complete()
      }
    })

    const treeKillTeardown =
      treeKillOnUnsubscribe(childProcess)

    return () => {
      readlineInterface.close()
      tracker?.finish()
      treeKillTeardown()
    }
    // Rethrow, not swallow: a swallowed extraction failure would complete
    // the job with no file and nothing to distinguish it from a title the
    // caller chose not to rip.
  }).pipe(logAndRethrowPipelineError(runMakeMkvConExtract))
