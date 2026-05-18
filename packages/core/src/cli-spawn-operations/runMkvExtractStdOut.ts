import { spawn } from "node:child_process"
import {
  logAndSwallowPipelineError,
  logInfo,
  logWarning,
} from "@mux-magic/tools"
import { Observable } from "rxjs"
import { mkvExtractPath } from "../tools/appPaths.js"
import { createTtyAffordances } from "../tools/createTtyAffordances.js"
import { treeKillOnUnsubscribe } from "./treeKillChild.js"

export const runMkvExtractStdOut = ({
  args,
}: {
  args: string[]
}): Observable<string> =>
  new Observable<string>((observer) => {
    const commandArgs = args

    logInfo(
      "MKVEXTRACT",
      [mkvExtractPath].concat(commandArgs).join(" "),
    )

    const childProcess = spawn(mkvExtractPath, commandArgs)

    const tty = createTtyAffordances(childProcess)

    // Same shape of bug we fixed in runMkvExtract / getMkvInfo: buffer
    // stderr (mkvextract's "Extracting track …" banners and benign
    // warnings land here) instead of erroring on the first byte;
    // surface only on a real non-zero exit.
    const stderrChunks: string[] = []

    childProcess.stdout.on("data", (data) => {
      observer.next(data.toString())
    })

    childProcess.stderr.on("data", (chunk) => {
      const text = chunk.toString()
      stderrChunks.push(text)
      logInfo("MKVEXTRACT", text)
    })

    childProcess.on("close", (code) => {
      if (code === null) {
        logWarning(
          "mkvextract",
          "Process canceled by user.",
        )

        if (tty.isUsingTtyAffordances) {
          setTimeout(() => {
            process.exit()
          }, 500)
        }
      }
    })

    childProcess.on("exit", (code) => {
      tty.detach()

      if (code === 0 || code === null) {
        // code === null is the user-cancel path the 'close' handler resolves;
        // we still want the observable to finish cleanly here.
        observer.complete()
        return
      }
      observer.error(
        new Error(
          `mkvextract exited with code ${code}` +
            (stderrChunks.length
              ? `: ${stderrChunks.join("").trim()}`
              : ""),
        ),
      )
    })

    return treeKillOnUnsubscribe(childProcess)
  }).pipe(logAndSwallowPipelineError(runMkvExtractStdOut))
