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

// Re-encode for the browser-playback path. Sibling to runFfmpeg.ts but
// focused on `<video>`-friendly output:
//
//   * Video: `-c:v copy` when the source is H.264/AVC (zero CPU cost
//     beyond muxing). VC-1/MPEG-2/HEVC/AV1/VP9 are re-encoded to H.264
//     (`plan.isVideoReencodeNeeded`) since browsers can't decode them.
//   * `-c:a libopus` (or `aac`) — re-encode the picked audio stream to
//     a browser-safe codec at a capped bitrate. Omitted entirely for
//     video-only sources (`plan.hasAudio === false`).
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

// Per-request transcode plan derived from the source's media tracks:
//   * hasAudio — whether the source has any audio track. A video-only
//     file (e.g. a logo bumper) has none; mapping `0:a:<n>` against it
//     makes ffmpeg exit immediately ("Stream map matches no streams"),
//     so the audio section is omitted entirely.
//   * isVideoReencodeNeeded — whether the source video codec is NOT
//     browser-decodable (VC-1, MPEG-2, HEVC, AV1, VP9). Those must be
//     re-encoded to H.264; H.264/AVC sources are copied.
//   * isNvencAvailable — whether this host has a usable NVIDIA NVENC
//     encoder (probed once at startup, see detectNvencSupport.ts). When
//     true AND a re-encode is needed, decode+encode run on the GPU
//     (vc1_cuvid/etc. via `-hwaccel cuda` → `h264_nvenc`); otherwise the
//     CPU libx264 path runs. Same H.264 High@L4.1 output either way.
export type TranscodePlan = {
  hasAudio: boolean
  isNvencAvailable: boolean
  isVideoReencodeNeeded: boolean
}

export const buildFfmpegArgs = (
  cacheKey: TranscodeCacheKey,
  startSeconds = 0,
  plan: TranscodePlan = {
    hasAudio: true,
    isNvencAvailable: false,
    isVideoReencodeNeeded: false,
  },
): string[] => {
  const seekSection: string[] =
    startSeconds > 0 ? ["-ss", String(startSeconds)] : []
  const isGpuReencode =
    plan.isVideoReencodeNeeded && plan.isNvencAvailable
  // GPU decode keeps frames in VRAM (`-hwaccel_output_format cuda`) so
  // h264_nvenc encodes them without a round-trip to system memory. Only
  // applied on the GPU re-encode path; copy and CPU paths take no hwaccel.
  const hwaccelSection = isGpuReencode
    ? ["-hwaccel", "cuda", "-hwaccel_output_format", "cuda"]
    : []
  // VC-1 (Blu-ray) and MPEG-2 (DVD), as well as HEVC/AV1/VP9, are not
  // browser-decodable, so re-encode to H.264 High@L4.1 (matches the
  // avc1.640029 codec tag the route advertises). H.264 sources copy.
  // h264_nvenc on the GPU, libx264 (ultrafast/zerolatency) on the CPU.
  const videoSection = !plan.isVideoReencodeNeeded
    ? ["-map", "0:v:0", "-c:v", "copy"]
    : isGpuReencode
      ? [
          "-map",
          "0:v:0",
          "-c:v",
          "h264_nvenc",
          "-preset",
          "p4",
          "-profile:v",
          "high",
          "-level",
          "4.1",
          "-g",
          "48",
        ]
      : [
          "-map",
          "0:v:0",
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-tune",
          "zerolatency",
          "-pix_fmt",
          "yuv420p",
          "-profile:v",
          "high",
          "-level",
          "4.1",
          "-g",
          "48",
        ]
  const sharedHead = [
    "-hide_banner",
    "-loglevel",
    "warning",
    "-nostats",
    ...hwaccelSection,
    ...seekSection,
    "-i",
    cacheKey.absPath,
    ...videoSection,
  ]
  // Omit audio entirely for video-only files — mapping a non-existent
  // audio stream makes ffmpeg exit before producing any output.
  const codecSection = !plan.hasAudio
    ? []
    : cacheKey.codec === "opus"
      ? [
          "-map",
          `0:a:${cacheKey.audioStream}`,
          "-ac",
          "2",
          "-c:a",
          "libopus",
          "-b:a",
          cacheKey.bitrate,
        ]
      : [
          "-map",
          `0:a:${cacheKey.audioStream}`,
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

    const settleAsFailure = (reason: string) => {
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

    const settleAsSuccess = () => {
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
