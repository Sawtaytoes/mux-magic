import { spawn } from "node:child_process"
import { createWriteStream } from "node:fs"
import { tmpdir } from "node:os"
import { Observable } from "rxjs"

import { ffmpegPath as defaultFfmpegPath } from "../tools/appPaths.js"
import {
  type TranscodeCacheKey,
  transcodeTempStore,
} from "../tools/transcodeTempStore.js"
import { treeKillOnUnsubscribe } from "./treeKillChild.js"

// Audio-only re-encode for the browser-playback path. Sibling to
// runFfmpeg.ts but focused on `<video>`-friendly output:
//
//   * `-c:v copy` — never decode/encode video (zero CPU cost beyond
//     muxing; design doc §3 + §4 explain why CUDA does not help here).
//   * `-c:a libopus` (or `aac`) — re-encode the picked audio stream to
//     a browser-safe codec at a capped bitrate.
//   * No subtitles (`-map 0:s?` is intentionally absent per design doc
//     §12 decision 3 — bitmap subs won't render in <video> and bloat
//     the file; text subs are a separate side-channel concern).
//   * Output container is fragmented MP4 for AAC, WebM for Opus. Both
//     are streamable + playable as soon as the first fragment lands.
//
// The encoder writes into a caller-supplied tempPath via stdout → fs
// WriteStream. Subscribers receive `"ready"` once the encoder exits
// cleanly and `markReady()` records the file size. Subscription
// teardown tree-kills the ffmpeg process so a disconnected client
// cannot leave a zombie encoder running.
//
// On encoder failure (non-zero exit code) the entry is invalidated so
// a retry won't serve a half-written file.

export type RunFfmpegAudioTranscodeOptions = {
  cacheKey: TranscodeCacheKey
  ffmpegPath?: string
  tempPath: string
}

const buildFfmpegArgs = (
  cacheKey: TranscodeCacheKey,
): string[] => {
  const sharedHead = [
    "-hide_banner",
    "-loglevel",
    "warning",
    "-nostats",
    "-i",
    cacheKey.absPath,
    "-map",
    "0:v:0",
    "-c:v",
    "copy",
    "-map",
    `0:a:${cacheKey.audioStream}`,
  ]
  const codecSection = (
    cacheKey.codec === "opus"
    ? [
      "-c:a",
      "libopus",
      "-b:a",
      cacheKey.bitrate,
    ]
    : [
      "-c:a",
      "aac",
      "-b:a",
      cacheKey.bitrate,
    ]
  )
  const containerSection = (
    cacheKey.codec === "opus"
    ? [
      "-f",
      "webm",
      "pipe:1",
    ]
    : [
      "-movflags",
      "frag_keyframe+empty_moov+default_base_moof",
      "-f",
      "mp4",
      "pipe:1",
    ]
  )
  return sharedHead.concat(codecSection, containerSection)
}

export const runFfmpegAudioTranscode = ({
  cacheKey,
  ffmpegPath = defaultFfmpegPath,
  tempPath,
}: RunFfmpegAudioTranscodeOptions): Observable<"ready"> => (
  new Observable<"ready">((observer) => {
    const commandArgs = buildFfmpegArgs(cacheKey)

    // Defence-in-depth (design doc §8): empty PATH and cwd in tmpdir so
    // the encoder cannot resolve any relative-path inputs even if the
    // caller's validation slipped. The input is passed positionally as
    // an absolute, traversal-checked path; output is pipe:1.
    //
    // Cast through `unknown` because the project augments NodeJS.ProcessEnv
    // (in `src/environment.d.ts`) to require TVDB_API_KEY — that token has
    // no business reaching the encoder, so we hand spawn() a deliberately
    // narrow env and silence the type-system's complaint here.
    const childProcess = spawn(
      ffmpegPath,
      commandArgs,
      {
        cwd: tmpdir(),
        env: { PATH: "" } as unknown as NodeJS.ProcessEnv,
      },
    )

    const writeStream = createWriteStream(tempPath)

    childProcess.stdout.pipe(writeStream)

    // ffmpeg writes encoder warnings to stderr; surface them in dev so a
    // misconfigured stream selector ("0:a:5" on a 2-track file) surfaces
    // immediately rather than silently producing an empty output.
    childProcess.stderr.on("data", (data) => {
      console.warn(
        "[runFfmpegAudioTranscode] ffmpeg stderr:",
        data.toString(),
      )
    })

    let hasSettled = false

    const settleAsFailure = (reason: string): void => {
      if (hasSettled) {
        return
      }
      hasSettled = true
      transcodeTempStore
      .invalidate(cacheKey)
      .finally(() => {
        observer.error(new Error(reason))
      })
    }

    const settleAsSuccess = (): void => {
      if (hasSettled) {
        return
      }
      hasSettled = true
      transcodeTempStore
      .markReady(cacheKey)
      .then(() => {
        observer.next("ready")
        observer.complete()
      })
      .catch((markError: unknown) => {
        const message = (
          markError instanceof Error
          ? markError.message
          : String(markError)
        )
        observer.error(new Error(`markReady failed: ${message}`))
      })
    }

    writeStream.on("error", (writeError) => {
      settleAsFailure(`Write stream failed: ${writeError.message}`)
    })

    childProcess.on("error", (spawnError) => {
      settleAsFailure(`ffmpeg spawn failed: ${spawnError.message}`)
    })

    childProcess.on("exit", (code, signal) => {
      // Wait for the WriteStream to drain before deciding success — the
      // stdout pipe may still have pending bytes in flight when the child
      // exits, and a premature markReady would record a short file size.
      writeStream.end(() => {
        if (signal !== null) {
          settleAsFailure(`ffmpeg killed by signal ${signal}`)
          return
        }
        if (code === 0) {
          settleAsSuccess()
          return
        }
        settleAsFailure(`ffmpeg exited with code ${code}`)
      })
    })

    return treeKillOnUnsubscribe(childProcess)
  })
)
