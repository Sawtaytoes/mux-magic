import { spawn } from "node:child_process"
import { EOL } from "node:os"
import {
  logAndSwallowPipelineError,
  logInfo,
  logWarning,
} from "@mux-magic/tools"
import { Observable } from "rxjs"
import { audioOffsetFinderPath } from "../tools/appPaths.js"
import { createTtyAffordances } from "../tools/createTtyAffordances.js"
import { treeKillOnUnsubscribe } from "./treeKillChild.js"

export const getOffsetFromAudioOffsetOutput = (
  audioOffsetOutputData: string,
) =>
  Math.floor(
    Number(
      audioOffsetOutputData
        .replace(/Offset: ([-\d.]+) \(seconds\)/, "$1")
        .split(EOL)
        .at(0)
        ?.trim(),
    ) * 1000,
  )

export const runAudioOffsetFinder = ({
  destinationFilePath,
  sourceFilePath,
}: {
  destinationFilePath: string
  sourceFilePath: string
}): Observable<number> =>
  new Observable<number>((observer) => {
    const commandArgs = [
      "--find-offset-of",
      sourceFilePath,
      "--within",
      destinationFilePath,
    ]

    logInfo(
      "AUDIO OFFSET FINDER",
      [audioOffsetFinderPath].concat(commandArgs).join(" "),
    )

    const childProcess = spawn(
      audioOffsetFinderPath,
      commandArgs,
    )

    const tty = createTtyAffordances(childProcess)

    let outputData: string = ""

    const appendOutputData = (moreOutputData: string) => {
      outputData = outputData.concat(moreOutputData)
    }

    // Same shape of bug we fixed in runMkvExtract / getMkvInfo: buffer
    // stderr instead of erroring on the first byte; surface only on a
    // real non-zero exit.
    const stderrChunks: string[] = []

    childProcess.stdout.on("data", (data) => {
      logInfo("AUDIO OFFSET FINDER", data.toString())

      appendOutputData(data.toString())
    })

    childProcess.stderr.on("data", (chunk) => {
      const text = chunk.toString()
      stderrChunks.push(text)
      logInfo("AUDIO OFFSET FINDER", text)
    })

    childProcess.on("close", (code) => {
      if (code === null) {
        logWarning(
          "audio-offset-finder",
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

      childProcess.stderr.unpipe()
      childProcess.stderr.destroy()
      childProcess.stdout.unpipe()
      childProcess.stdout.destroy()
      childProcess.stdin.end()
      childProcess.stdin.destroy()

      if (code === 0) {
        observer.next(
          getOffsetFromAudioOffsetOutput(outputData),
        )
        observer.complete()
        return
      }
      // code === null is the user-cancel path the 'close' handler resolves.
      // Any other non-zero exit is a real failure — attach the captured
      // stderr so consumers see what audio-offset-finder complained about.
      if (code !== null) {
        observer.error(
          new Error(
            `audio-offset-finder exited with code ${code}` +
              (stderrChunks.length
                ? `: ${stderrChunks.join("").trim()}`
                : ""),
          ),
        )
      }
    })

    return treeKillOnUnsubscribe(childProcess)
  }).pipe(logAndSwallowPipelineError(runAudioOffsetFinder))
