import { spawn } from "node:child_process"
import { unlink } from "node:fs/promises"
import {
  logAndSwallowPipelineError,
  logWarning,
} from "@mux-magic/tools"
import { Observable } from "rxjs"
import { getActiveJobId } from "../api/logCapture.js"
import { mkvMergePath } from "../tools/appPaths.js"
import { createTtyAffordances } from "../tools/createTtyAffordances.js"
import { createProgressEmitter } from "../tools/progressEmitter.js"
import { treeKillOnUnsubscribe } from "./treeKillChild.js"

// Thin wrapper around `mkvmerge --chapters <xml> -o <output> <input>` —
// the chapter-XML round-trip path used by the renumberChapters command.
// Mirrors runMkvMerge's wiring (per-file progress tracker, TTY
// affordances, tree-kill teardown, buffered stderr surfaced only on
// non-zero exit) but pins the arg shape so the caller never has to
// reason about the --chapters flag ordering.
export const writeChaptersMkvMerge = ({
  chaptersXmlPath,
  inputFilePath,
  outputFilePath,
}: {
  chaptersXmlPath: string
  inputFilePath: string
  outputFilePath: string
}): Observable<string> =>
  new Observable<string>((observer) => {
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
      "--chapters",
      chaptersXmlPath,
      "-o",
      outputFilePath,
      inputFilePath,
    ]

    console.info([mkvMergePath].concat(commandArgs), "\n")

    const childProcess = spawn(mkvMergePath, commandArgs)

    const tty = createTtyAffordances(childProcess)

    // mkvmerge emits informational lines on stderr (codec advisories on
    // weird-but-valid containers, warnings); buffer here and surface only
    // on non-zero exit so a benign warning doesn't tear down the job.
    const stderrChunks: string[] = []

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

          if (tty.isUsingTtyAffordances) {
            setTimeout(() => {
              process.exit()
            }, 500)
          }
        })
      }
    })

    childProcess.on("exit", (code) => {
      tty.detach()
      if (tracker !== null) tracker.finish()

      if (code === 0) {
        observer.next(outputFilePath)
        observer.complete()
        return
      }
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

    const treeKillTeardown =
      treeKillOnUnsubscribe(childProcess)
    return () => {
      if (tracker !== null) tracker.finish()
      treeKillTeardown()
    }
  }).pipe(logAndSwallowPipelineError(writeChaptersMkvMerge))
