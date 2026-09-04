import { spawn } from "node:child_process"

import {
  logAndSwallowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import { Observable } from "rxjs"

import {
  makeMkvConPath,
  makeMkvHomePath,
} from "../tools/appPaths.js"
import { buildKeyFailureError } from "../tools/makemkv/buildKeyFailureError.js"
import { getIsKeyFailureEvent } from "../tools/makemkv/makemkvEvents.js"
import { parseMakemkvLine } from "../tools/makemkv/parseLine.js"
import {
  buildTitleGraphFromEvents,
  type DiscTitleGraph,
} from "../tools/makemkv/parseTitleGraph.js"
import { treeKillOnUnsubscribe } from "./treeKillChild.js"

/**
 * Run `makemkvcon -r` and emit the parsed disc title graph.
 *
 * `--cache=1` keeps memory use trivial for an info-only pass, and
 * `--minlength=10` is deliberate. MakeMKV's own floor is far higher (a
 * 10-minute floor is the usual rip setting) and hides real extras, but
 * `--minlength=0` goes too far the other way: Desk Set reports 61 titles of
 * which 59 are sub-minute BDMV fragments, so the proposal list is noise.
 *
 * Ten seconds is the floor that drops the fragments without dropping
 * content. It takes Desk Set from 61 titles to 10, and it keeps three things
 * a 60-second floor threw away with nothing in the output to say they
 * existed: Soylent Green's 12-second image gallery, and the 0:58 featurette
 * and two 0:30 promos on the Haunting Hour DVD. Anything that survives the
 * floor is still *proposed*, never silently discarded.
 */
export const runMakeMkvCon = ({
  minimumTitleLengthSeconds = 10,
  sourcePath,
}: {
  minimumTitleLengthSeconds?: number
  sourcePath: string
}): Observable<DiscTitleGraph> =>
  new Observable<DiscTitleGraph>((observer) => {
    const commandArgs = [
      "-r",
      "--cache=1",
      `--minlength=${minimumTitleLengthSeconds}`,
      "info",
      `file:${sourcePath}`,
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

    const stdoutChunks: string[] = []
    const stderrChunks: string[] = []

    childProcess.stdout.on("data", (chunk) => {
      stdoutChunks.push(chunk.toString())
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
      const events = stdoutChunks
        .join("")
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map(parseMakemkvLine)

      const keyFailureMessages = events.filter(
        getIsKeyFailureEvent,
      )

      // Checked BEFORE the exit code, because makemkvcon exits 0 on a key
      // failure just as it does on success.
      if (keyFailureMessages.length > 0) {
        observer.error(
          buildKeyFailureError(keyFailureMessages),
        )
      } else if (code === 0) {
        observer.next(buildTitleGraphFromEvents(events))
        observer.complete()
      } else if (code !== null) {
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
      }
    })

    return treeKillOnUnsubscribe(childProcess)
  }).pipe(logAndSwallowPipelineError(runMakeMkvCon))
