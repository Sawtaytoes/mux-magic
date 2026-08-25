import { spawn } from "node:child_process"

import { logAndRethrowPipelineError } from "@mux-magic/tools"
import { Observable } from "rxjs"

import { fpcalcPath } from "../tools/appPaths.js"
import { treeKillOnUnsubscribe } from "./treeKillChild.js"

// Chromaprint's `fpcalc`, the fingerprinter AcoustID is built on. Picard
// spawns the same binary for the same reason: the fingerprint is computed
// from the DECODED audio, so it survives a re-encode, a re-tag and a
// rename. That is what makes it the only way to identify a file whose
// tags say nothing true.

export type FpcalcResult = {
  durationSeconds: number
  fingerprint: string
}

type FpcalcRawResult = {
  duration?: number
  fingerprint?: string
}

// `-json` is not the default and the plain-text output is a key=value
// format that needs its own parser. Asking for JSON costs nothing and the
// shape is exactly two fields.
export const FPCALC_JSON_FLAG = "-json"

// AcoustID compares fingerprints over a fixed window. Picard's default is
// 120 seconds and the AcoustID server ignores anything past it, so a
// longer scan is wasted decode time on a 74-minute live set.
export const FPCALC_LENGTH_SECONDS = 120

export const parseFpcalcOutput = ({
  filePath,
  stdout,
}: {
  filePath: string
  stdout: string
}): FpcalcResult =>
  ((raw: FpcalcRawResult) =>
    typeof raw.fingerprint === "string" &&
    raw.fingerprint.length > 0 &&
    typeof raw.duration === "number"
      ? {
          durationSeconds: raw.duration,
          fingerprint: raw.fingerprint,
        }
      : (() => {
          throw new Error(
            `fpcalc returned no fingerprint for "${filePath}".`,
          )
        })())(JSON.parse(stdout) as FpcalcRawResult)

export const runFpcalc = ({
  filePath,
  lengthSeconds = FPCALC_LENGTH_SECONDS,
}: {
  filePath: string
  lengthSeconds?: number
}): Observable<FpcalcResult> =>
  new Observable<FpcalcResult>((observer) => {
    const childProcess = spawn(fpcalcPath, [
      FPCALC_JSON_FLAG,
      "-length",
      String(lengthSeconds),
      filePath,
    ])

    // Without an 'error' listener a missing binary (ENOENT) reaches the
    // process-level uncaughtException handler, which exits the server and
    // leaves the job card stuck on "running" with no failure ever sent.
    childProcess.on("error", (error) => {
      observer.error(
        (error as NodeJS.ErrnoException).code === "ENOENT"
          ? new Error(
              `fpcalc is not installed or not on PATH (looked for "${fpcalcPath}"). It ships in the libchromaprint-tools package, which the runtime image installs.`,
            )
          : error,
      )
    })

    const stdoutChunks: string[] = []
    const stderrChunks: string[] = []

    childProcess.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk.toString())
    })

    // Buffered, not fatal on the first byte. fpcalc prints decoder
    // warnings to stderr on files it reads perfectly well.
    childProcess.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk.toString())
    })

    childProcess.on("exit", (code) => {
      if (code === 0) {
        try {
          observer.next(
            parseFpcalcOutput({
              filePath,
              stdout: stdoutChunks.join(""),
            }),
          )
          observer.complete()
        } catch (error: unknown) {
          observer.error(error)
        }
        return
      }

      // A null code is the unsubscribe path — the sequence was cancelled
      // and the tree-kill below sent the signal. Nothing failed.
      if (code !== null) {
        observer.error(
          new Error(
            `fpcalc exited with code ${code} for "${filePath}"` +
              (stderrChunks.length > 0
                ? `: ${stderrChunks.join("").trim()}`
                : ""),
          ),
        )
      }
    })

    return treeKillOnUnsubscribe(childProcess)
  }).pipe(logAndRethrowPipelineError(runFpcalc))
