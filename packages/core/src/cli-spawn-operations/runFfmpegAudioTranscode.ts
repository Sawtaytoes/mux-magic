import { spawn } from "node:child_process"
import { createWriteStream } from "node:fs"
import { tmpdir } from "node:os"
import { logWarning } from "@mux-magic/tools"
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
//   * Output container is always fragmented MP4. Both Opus and AAC land
//     in fMP4 so H.264/H.265 video copy works — WebM only accepts VP8/
//     VP9/AV1 and rejects H.264 at the mux stage, killing the encode.
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

// TODO(GPU): add NVIDIA hardware-acceleration when available.
//   Detection: run `ffmpeg -hwaccels` at startup; if "cuda" is listed,
//   enable NVDEC for input-side decoding with:
//     ["-hwaccel", "cuda", "-hwaccel_output_format", "cuda"]
//   inserted before "-i", and switch `-c:v copy` to
//     ["-c:v", "h264_nvenc", "-preset", "p1"]
//   for re-encoding paths. Fall back to CPU-only args when no GPU is
//   detected so the server works on non-NVIDIA machines.
export const buildFfmpegArgs = (
  cacheKey: TranscodeCacheKey,
  startSeconds = 0,
): string[] => {
  const seekSection: string[] =
    startSeconds > 0 ? ["-ss", String(startSeconds)] : []
  const sharedHead = [
    "-hide_banner",
    "-loglevel",
    "warning",
    "-nostats",
    ...seekSection,
    "-i",
    cacheKey.absPath,
    "-map",
    "0:v:0",
    "-c:v",
    "copy",
    "-map",
    `0:a:${cacheKey.audioStream}`,
  ]
  const codecSection =
    cacheKey.codec === "opus"
      ? [
          "-ac",
          "2",
          "-c:a",
          "libopus",
          "-b:a",
          cacheKey.bitrate,
        ]
      : [
          "-ac",
          "2",
          "-c:a",
          "aac",
          "-b:a",
          cacheKey.bitrate,
        ]
  const containerSection = [
    "-movflags",
    "frag_keyframe+empty_moov+default_base_moof",
    "-f",
    "mp4",
    "pipe:1",
  ]
  return sharedHead.concat(codecSection, containerSection)
}

export const runFfmpegAudioTranscode = ({
  cacheKey,
  ffmpegPath = defaultFfmpegPath,
  tempPath,
}: RunFfmpegAudioTranscodeOptions): Observable<"ready"> =>
  new Observable<"ready">((observer) => {
    const commandArgs = buildFfmpegArgs(cacheKey)

    // Inherit process.env (matches the existing runFfmpeg.ts pattern)
    // so the OS can find ffmpeg via PATH — the W22b design doc's
    // "empty PATH" defence-in-depth was over-cautious and broke the
    // ffmpeg lookup itself in Docker (where ffmpeg lives at /usr/bin
    // and the bare "ffmpeg" command requires PATH to resolve). Input
    // is still passed positionally as an absolute, traversal-checked
    // path; output is pipe:1; cwd is os.tmpdir().
    const childProcess = spawn(ffmpegPath, commandArgs, {
      cwd: tmpdir(),
      env: process.env,
    })

    const writeStream = createWriteStream(tempPath)

    childProcess.stdout.pipe(writeStream)

    // ffmpeg writes encoder warnings to stderr; surface them in dev so a
    // misconfigured stream selector ("0:a:5" on a 2-track file) surfaces
    // immediately rather than silently producing an empty output.
    childProcess.stderr.on("data", (data) => {
      logWarning("FFMPEG TRANSCODE", data.toString())
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
          const message =
            markError instanceof Error
              ? markError.message
              : String(markError)
          observer.error(
            new Error(`markReady failed: ${message}`),
          )
        })
    }

    writeStream.on("error", (writeError) => {
      settleAsFailure(
        `Write stream failed: ${writeError.message}`,
      )
    })

    childProcess.on("error", (spawnError) => {
      settleAsFailure(
        `ffmpeg spawn failed: ${spawnError.message}`,
      )
    })

    childProcess.on("exit", (code, signal) => {
      // Wait for the WriteStream to drain before deciding success — the
      // stdout pipe may still have pending bytes in flight when the child
      // exits, and a premature markReady would record a short file size.
      writeStream.end(() => {
        if (signal !== null) {
          settleAsFailure(
            `ffmpeg killed by signal ${signal}`,
          )
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
