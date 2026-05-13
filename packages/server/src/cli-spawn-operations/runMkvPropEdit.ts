import { spawn } from "node:child_process"
import {
  logAndSwallowPipelineError,
  logWarning,
} from "@mux-magic/tools"
import { Observable } from "rxjs"
import { mkvPropEditPath } from "../tools/appPaths.js"
import { createTtyAffordances } from "../tools/createTtyAffordances.js"
import { treeKillOnUnsubscribe } from "./treeKillChild.js"

export const runMkvPropEdit = ({
  args,
  filePath,
}: {
  args: string[]
  filePath: string
}): Observable<string> =>
  new Observable<string>((observer) => {
    const commandArgs = [filePath, ...args]

    console.info(
      [mkvPropEditPath].concat(commandArgs),
      "\n",
    )

    const childProcess = spawn(mkvPropEditPath, commandArgs)

    const tty = createTtyAffordances(childProcess)

    // Same shape of bug we fixed in runMkvExtract / getMkvInfo: buffer
    // stderr instead of erroring on the first byte; surface only on a
    // real non-zero exit.
    const stderrChunks: string[] = []

    childProcess.stdout.on("data", (data) => {
      console.info(data.toString())
    })

    childProcess.stderr.on("data", (chunk) => {
      const text = chunk.toString()
      stderrChunks.push(text)
      console.info(text)
    })

    childProcess.on("close", (code) => {
      if (code === null) {
        logWarning(
          "mkvpropedit",
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

      if (code === 0) {
        observer.next(filePath)
        observer.complete()
        return
      }
      // code === null is the user-cancel path the 'close' handler resolves.
      // Any other non-zero exit is a real failure — attach the captured
      // stderr so consumers see what mkvpropedit complained about.
      if (code !== null) {
        observer.error(
          new Error(
            `mkvpropedit exited with code ${code}` +
              (stderrChunks.length
                ? `: ${stderrChunks.join("").trim()}`
                : ""),
          ),
        )
      }
    })

    return treeKillOnUnsubscribe(childProcess)
  }).pipe(logAndSwallowPipelineError(runMkvPropEdit))
