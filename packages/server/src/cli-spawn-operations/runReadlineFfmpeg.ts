import {
  spawn,
} from "node:child_process";
import readline from "node:readline"
import {
  fromEvent,
  Observable,
  Subject,
  takeUntil,
} from "rxjs"

import { ffmpegPath as defaultFfmpegPath } from "../tools/appPaths.js";
import { treeKillOnUnsubscribe } from "./treeKillChild.js"

export const runReadlineFfmpeg = ({
  args,
  envVars,
  ffmpegPath = defaultFfmpegPath,
}: {
  args: string[]
  envVars?: (
    Record<
      string,
      string
    >
  ),
  ffmpegPath?: string
}): (
  Observable<
    string
  >
) => (
  new Observable((
    observer,
  ) => {
    const killReadlineEventListenerSubject = new Subject()

    const commandArgs = (
      args
      .filter(
        Boolean
      )
    )

    const childProcess = (
      spawn(
        ffmpegPath,
        commandArgs,
        {
          env: {
            ...process.env,
            ...envVars,
          },
        },
      )
    )

    // This needs to be here, or it won't complete the child process.
    childProcess
    .stderr
    .on(
      "data",
      (data) => {
        // console.log(data.toString())
      }
    )

    const readlineInterface = (
      readline
      .createInterface({
        input: (
          childProcess
          .stdout
        ),
        terminal: false,
      })
    )

    ;(
      fromEvent(
        readlineInterface,
        "line",
      ) as (
        Observable<
          string
        >
      )
    )
    .pipe(
      takeUntil(
        fromEvent(
          childProcess,
          "close"
        )
      ),
    )
    .subscribe(
      observer
    )

    childProcess
    .on(
      "close",
      (
        code,
      ) => {
        if (code !== 0) {
          console
          .error(
            `Child process exited with code ${code}`
          )
        }

        killReadlineEventListenerSubject.next(null)
        killReadlineEventListenerSubject.complete()

        readlineInterface
        .close()
      }
    )

    return treeKillOnUnsubscribe(childProcess)
  })
)
