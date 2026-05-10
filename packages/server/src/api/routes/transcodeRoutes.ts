import { spawn } from "node:child_process"
import { tmpdir } from "node:os"
import { Readable } from "node:stream"

import { OpenAPIHono } from "@hono/zod-openapi"
import {
  firstValueFrom,
  mergeMap,
  Observable,
  Subject,
} from "rxjs"

import { buildFfmpegArgs } from "../../cli-spawn-operations/runFfmpegAudioTranscode.js"
import { ffmpegPath } from "../../tools/appPaths.js"
import { getMediaInfo } from "../../tools/getMediaInfo.js"
import {
  PathSafetyError,
  validateReadablePath,
} from "../../tools/pathSafety.js"
import {
  mimeTypeForCodec,
  type TranscodeCacheKey,
  type TranscodeCodec,
} from "../../tools/transcodeTempStore.js"

// Browser-safe audio playback endpoint. Pairs with the file-explorer
// modal's auto-swap (when the source's audio codec isn't decodable in
// the browser, the modal points <video>.src here instead of at
// /files/stream). Implementation follows the design doc decisions
// captured in `docs/options/ffmpeg-audio-reencode-endpoint.md` §12:
//
//   * Path safety via `validateReadablePath` (absolute + no traversal),
//     matching `/files/stream`. The hardcoded /media-only root from W22b
//     was dropped — it broke local-dev users on Windows (G:/Movies) and
//     wasn't earning enough security to justify the breakage.
//   * Default codec Opus in fMP4. AAC in fMP4 as fallback.
//   * No subtitle passthrough.
//   * Streaming strategy: ffmpeg stdout piped directly to the HTTP
//     response body via Readable.toWeb(). fMP4 with empty_moov means
//     the browser can start decoding from the first fragment — no
//     encode-to-temp wait.
//   * ?start=<seconds> seeks ffmpeg to that position (input-side fast
//     seek via -ss) for MSE-based client seeking.
//
// HEAD response includes X-Duration (float, seconds from MediaInfo) and
// X-Video-Codec (avc1/hvc1/av01) so the MSE client can configure its
// MediaSource without a separate round-trip.
//
// Concurrency gate: `MAX_TRANSCODE_CONCURRENCY` distinct encodes via an
// RxJS `mergeMap` on a Subject queue. New requests queue behind running
// ones until a slot opens.

export const transcodeRoutes = new OpenAPIHono()

const MAX_TRANSCODE_CONCURRENCY_DEFAULT = 4
const BITRATE_CAP_KBPS = 512
const BITRATE_REGEX = /^(\d+)k$/

const parseConcurrency = (): number => {
  const fromEnv = process.env.MAX_TRANSCODE_CONCURRENCY
  if (typeof fromEnv !== "string" || fromEnv.length === 0) {
    return MAX_TRANSCODE_CONCURRENCY_DEFAULT
  }
  const parsed = Number(fromEnv)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return MAX_TRANSCODE_CONCURRENCY_DEFAULT
  }
  return Math.floor(parsed)
}

// Coerced types for parsed query params; raw query strings get validated
// then narrowed to these shapes for the rest of the handler.
type ValidatedParams = {
  audioStream: number
  bitrate: string
  codec: TranscodeCodec
  path: string
  startSeconds: number
}

type ValidationFailure = {
  message: string
  status: 400
}

type ValidationResult =
  | { failure: ValidationFailure; params: null }
  | { failure: null; params: ValidatedParams }

const defaultBitrateForCodec = (
  codec: TranscodeCodec,
): string => (codec === "opus" ? "192k" : "256k")

const validateBitrate = (
  rawBitrate: string | undefined,
  codec: TranscodeCodec,
): { error: string | null; value: string } => {
  if (
    typeof rawBitrate !== "string" ||
    rawBitrate.length === 0
  ) {
    return {
      error: null,
      value: defaultBitrateForCodec(codec),
    }
  }
  const match = rawBitrate.match(BITRATE_REGEX)
  if (!match) {
    return {
      error: `bitrate must look like "<number>k" (e.g. "192k"); received: ${rawBitrate}`,
      value: rawBitrate,
    }
  }
  const numericKbps = Number(match[1])
  if (Number.isNaN(numericKbps) || numericKbps <= 0) {
    return {
      error: `bitrate must be a positive number of kbps; received: ${rawBitrate}`,
      value: rawBitrate,
    }
  }
  if (numericKbps > BITRATE_CAP_KBPS) {
    return {
      error: `bitrate exceeds the ${BITRATE_CAP_KBPS}k server cap; received: ${rawBitrate}`,
      value: rawBitrate,
    }
  }
  return { error: null, value: rawBitrate }
}

const validateAudioStream = (
  rawAudioStream: string | undefined,
): { error: string | null; value: number } => {
  if (
    typeof rawAudioStream !== "string" ||
    rawAudioStream.length === 0
  ) {
    return { error: null, value: 0 }
  }
  const parsed = Number(rawAudioStream)
  if (
    Number.isNaN(parsed) ||
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    !Number.isInteger(parsed)
  ) {
    return {
      error: `audioStream must be a non-negative integer; received: ${rawAudioStream}`,
      value: 0,
    }
  }
  return { error: null, value: parsed }
}

const validateCodec = (
  rawCodec: string | undefined,
): { error: string | null; value: TranscodeCodec } => {
  if (
    typeof rawCodec !== "string" ||
    rawCodec.length === 0
  ) {
    return { error: null, value: "opus" }
  }
  if (rawCodec === "opus") {
    return { error: null, value: "opus" }
  }
  if (rawCodec === "aac") {
    return { error: null, value: "aac" }
  }
  return {
    error: `codec must be "opus" or "aac"; received: ${rawCodec}`,
    value: "opus",
  }
}

const validateStart = (
  rawStart: string | undefined,
): { error: string | null; value: number } => {
  if (
    typeof rawStart !== "string" ||
    rawStart.length === 0
  ) {
    return { error: null, value: 0 }
  }
  const parsed = Number(rawStart)
  if (Number.isNaN(parsed) || parsed < 0) {
    return {
      error: `start must be a non-negative number (seconds); received: ${rawStart}`,
      value: 0,
    }
  }
  return { error: null, value: parsed }
}

const validateAllParams = (
  rawPath: string | undefined,
  rawCodec: string | undefined,
  rawBitrate: string | undefined,
  rawAudioStream: string | undefined,
  rawStart: string | undefined,
): ValidationResult => {
  if (typeof rawPath !== "string" || rawPath.length === 0) {
    return {
      failure: {
        message: "path query parameter is required",
        status: 400,
      },
      params: null,
    }
  }
  const codecResult = validateCodec(rawCodec)
  if (codecResult.error !== null) {
    return {
      failure: { message: codecResult.error, status: 400 },
      params: null,
    }
  }
  const bitrateResult = validateBitrate(
    rawBitrate,
    codecResult.value,
  )
  if (bitrateResult.error !== null) {
    return {
      failure: {
        message: bitrateResult.error,
        status: 400,
      },
      params: null,
    }
  }
  const audioStreamResult =
    validateAudioStream(rawAudioStream)
  if (audioStreamResult.error !== null) {
    return {
      failure: {
        message: audioStreamResult.error,
        status: 400,
      },
      params: null,
    }
  }
  const startResult = validateStart(rawStart)
  if (startResult.error !== null) {
    return {
      failure: { message: startResult.error, status: 400 },
      params: null,
    }
  }
  return {
    failure: null,
    params: {
      audioStream: audioStreamResult.value,
      bitrate: bitrateResult.value,
      codec: codecResult.value,
      path: rawPath,
      startSeconds: startResult.value,
    },
  }
}

const messageFromError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

type StreamResult = {
  kill: () => void
  stream: ReadableStream
}

type StreamRequest = {
  cacheKey: TranscodeCacheKey
  startSeconds: number
  resolver: (result: StreamResult) => void
}

const streamQueue$ = new Subject<StreamRequest>()

// Drains queued requests through the global concurrency gate. Each slot
// runs one ffmpeg process; its inner Observable stays active until the
// process exits, holding the slot. The stdout Readable is handed off
// to the HTTP handler immediately via resolver so bytes flow to the
// browser as soon as the first fMP4 fragment is muxed.
streamQueue$
  .pipe(
    mergeMap(
      ({ cacheKey, startSeconds, resolver }) =>
        new Observable<void>((observer) => {
          const childProcess = spawn(
            ffmpegPath,
            buildFfmpegArgs(cacheKey, startSeconds),
            { cwd: tmpdir(), env: process.env },
          )

          childProcess.stderr.on("data", (data) => {
            console.warn(
              "[transcode/audio] ffmpeg stderr:",
              data.toString(),
            )
          })

          const stream = Readable.toWeb(
            childProcess.stdout,
          ) as ReadableStream
          resolver({
            kill: () => {
              childProcess.kill()
            },
            stream,
          })

          childProcess.on("exit", () => {
            observer.complete()
          })
          childProcess.on("error", (error) => {
            observer.error(error)
          })

          return () => {
            childProcess.kill()
          }
        }),
      parseConcurrency(),
    ),
  )
  .subscribe({ error: () => {} })

const acquireTranscodeStream = (
  cacheKey: TranscodeCacheKey,
  startSeconds: number,
): Promise<StreamResult> =>
  new Promise((resolve) => {
    streamQueue$.next({
      cacheKey,
      resolver: resolve,
      startSeconds,
    })
  })

const buildHeadersForCodec = (
  codec: TranscodeCodec,
): Record<string, string> => ({
  "Cache-Control": "no-store",
  "Content-Disposition": "inline",
  "Content-Type": mimeTypeForCodec(codec),
  "X-Accel-Buffering": "no",
})

// Runs MediaInfo on the validated path and extracts the fields the MSE
// client needs: total duration in seconds and the video codec tag
// (avc1/hvc1/av01). Both are optional — a MediaInfo failure is
// non-fatal; the client falls back to direct <video src>.
const fetchStreamInfo = async (
  absPath: string,
): Promise<{
  durationSeconds: number | null
  videoCodecTag: string | null
}> => {
  const mediaInfo = await firstValueFrom(
    getMediaInfo(absPath),
  )
  const tracks = mediaInfo.media?.track ?? []
  const general = tracks.find(
    (track) => track["@type"] === "General",
  )
  const video = tracks.find(
    (track) => track["@type"] === "Video",
  )

  let durationSeconds: number | null = null
  if (
    general &&
    "Duration" in general &&
    typeof general.Duration === "string"
  ) {
    const secs = parseFloat(general.Duration)
    if (!Number.isNaN(secs) && secs > 0) {
      durationSeconds = secs
    }
  }

  let videoCodecTag: string | null = null
  if (
    video &&
    "Format" in video &&
    typeof video.Format === "string"
  ) {
    const fmt = video.Format.toUpperCase()
    const profile =
      "Format_Profile" in video &&
      typeof video.Format_Profile === "string"
        ? video.Format_Profile
        : ""
    // MediaInfo returns level and tier as separate fields from profile.
    const level =
      "Format_Level" in video &&
      typeof (video as Record<string, unknown>)
        .Format_Level === "string"
        ? ((video as Record<string, unknown>)
            .Format_Level as string)
        : ""
    const tier =
      "Format_Tier" in video &&
      typeof (video as Record<string, unknown>)
        .Format_Tier === "string"
        ? ((video as Record<string, unknown>)
            .Format_Tier as string)
        : ""
    if (fmt === "AVC") {
      videoCodecTag = buildAvcCodecString(profile, level)
    } else if (fmt === "HEVC") {
      videoCodecTag = buildHevcCodecString(
        profile,
        level,
        tier,
      )
    } else if (fmt === "AV1") {
      videoCodecTag = "av01.0.08M.08"
    }
  }

  return { durationSeconds, videoCodecTag }
}

// H.264 profile name → two-hex-digit profile_idc used in the codec string.
const AVC_PROFILE_HEX: Record<string, string> = {
  Baseline: "42",
  "Constrained Baseline": "42",
  Main: "4D",
  Extended: "58",
  High: "64",
  "High 10": "6E",
  "High 4:2:2": "7A",
  "High 4:4:4": "F4",
  "High 4:4:4 Predictive": "F4",
}

// Derives the RFC 6381 codec string for H.264, e.g. "avc1.640029" for
// High@L4.1. Falls back to High@L4.1 for any unparseable inputs.
// MediaInfo returns profile and level as separate fields (not "High@L4.1").
const buildAvcCodecString = (
  formatProfile: string,
  formatLevel: string,
): string => {
  const fallback = "avc1.640029" // High@L4.1 — covers most Blu-ray rips
  const profileHex =
    AVC_PROFILE_HEX[formatProfile.trim()] ?? "64"
  const levelFloat = parseFloat(formatLevel)
  if (Number.isNaN(levelFloat) || levelFloat <= 0) {
    return fallback
  }
  const levelHex = Math.round(levelFloat * 10)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase()
  return `avc1.${profileHex}00${levelHex}`
}

// Derives the RFC 6381 codec string for HEVC, e.g. "hvc1.2.4.H153.B0"
// for Main 10@L5.1@High. Falls back to Main@L5.0@High for any unparseable inputs.
// MediaInfo returns profile, level, and tier as separate fields.
const buildHevcCodecString = (
  formatProfile: string,
  formatLevel: string,
  formatTier: string,
): string => {
  const fallback = "hvc1.1.6.L150.B0" // Main@L5.0@High
  const lowerProfile = formatProfile.toLowerCase()
  // Profile IDC: Main=1, Main 10=2
  const profileIdc = lowerProfile.startsWith("main 10")
    ? 2
    : 1
  // Compatibility flags: 0x06 for Main (bits 1+2 set), 0x04 for Main 10 (bit 2 set)
  const compatFlags = profileIdc === 1 ? "6" : "4"
  const levelFloat = parseFloat(formatLevel)
  if (Number.isNaN(levelFloat) || levelFloat <= 0) {
    return fallback
  }
  // HEVC level indicator = level * 30 (e.g. 5.1 → 153)
  const levelIndicator = Math.round(levelFloat * 30)
  // MediaInfo Format_Tier is "High" or "Main" (absent → Main tier)
  const tierFlag =
    formatTier.toLowerCase() === "high" ? "H" : "L"
  return `hvc1.${profileIdc}.${compatFlags}.${tierFlag}${levelIndicator}.B0`
}

const handleTranscodeRequest = async ({
  isHeadRequest,
  rawAudioStream,
  rawBitrate,
  rawCodec,
  rawPath,
  rawStart,
  requestSignal,
}: {
  isHeadRequest: boolean
  rawAudioStream: string | undefined
  rawBitrate: string | undefined
  rawCodec: string | undefined
  rawPath: string | undefined
  rawStart: string | undefined
  requestSignal: AbortSignal | undefined
}): Promise<Response> => {
  const validation = validateAllParams(
    rawPath,
    rawCodec,
    rawBitrate,
    rawAudioStream,
    rawStart,
  )
  if (validation.failure !== null) {
    return new Response(
      JSON.stringify({ error: validation.failure.message }),
      {
        headers: { "Content-Type": "application/json" },
        status: validation.failure.status,
      },
    )
  }
  const params = validation.params
  let validatedAbsPath: string
  try {
    validatedAbsPath = validateReadablePath(params.path)
  } catch (error) {
    if (error instanceof PathSafetyError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          headers: { "Content-Type": "application/json" },
          status: 403,
        },
      )
    }
    return new Response(
      JSON.stringify({ error: messageFromError(error) }),
      {
        headers: { "Content-Type": "application/json" },
        status: 400,
      },
    )
  }

  // HEAD short-circuits — run MediaInfo to return duration and video
  // codec tag so the MSE client can configure its MediaSource before
  // starting the stream.
  if (isHeadRequest) {
    let durationSeconds: number | null = null
    let videoCodecTag: string | null = null
    try {
      ;({ durationSeconds, videoCodecTag } =
        await fetchStreamInfo(validatedAbsPath))
    } catch {
      // MediaInfo failure is non-fatal — client falls back to direct src
    }
    return new Response(null, {
      headers: {
        ...buildHeadersForCodec(params.codec),
        ...(durationSeconds !== null
          ? { "X-Duration": String(durationSeconds) }
          : {}),
        ...(videoCodecTag !== null
          ? { "X-Video-Codec": videoCodecTag }
          : {}),
      },
      status: 200,
    })
  }

  const cacheKey: TranscodeCacheKey = {
    absPath: validatedAbsPath,
    audioStream: params.audioStream,
    bitrate: params.bitrate,
    codec: params.codec,
  }

  try {
    const { kill, stream } = await acquireTranscodeStream(
      cacheKey,
      params.startSeconds,
    )
    if (requestSignal !== undefined) {
      requestSignal.addEventListener(
        "abort",
        () => {
          kill()
        },
        { once: true },
      )
    }
    return new Response(stream, {
      headers: buildHeadersForCodec(params.codec),
      status: 200,
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: messageFromError(error) }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    )
  }
}

// Plain `.get()` / `.on()` — these stream binary, so the OpenAPI doc
// generator would mis-describe them as JSON. Same approach taken by
// /files/stream in fileRoutes.ts.
// Single handler for GET + HEAD. Hono auto-routes HEAD through GET
// handlers (and a separately-registered `.on("HEAD", ...)` does NOT
// take precedence), so we detect HEAD via `context.req.method` and
// short-circuit inside handleTranscodeRequest before any encoding.
transcodeRoutes.on(
  ["GET", "HEAD"],
  "/transcode/audio",
  async (context) =>
    handleTranscodeRequest({
      isHeadRequest: context.req.method === "HEAD",
      rawAudioStream: context.req.query("audioStream"),
      rawBitrate: context.req.query("bitrate"),
      rawCodec: context.req.query("codec"),
      rawPath: context.req.query("path"),
      rawStart: context.req.query("start"),
      requestSignal:
        context.req.raw && "signal" in context.req.raw
          ? context.req.raw.signal
          : undefined,
    }),
)

// Also exported for tests that want to drive a deterministic gate
// without waiting on the env-var-driven default.
export const __defaultsForTests = {
  bitrateCapKbps: BITRATE_CAP_KBPS,
  defaultConcurrency: MAX_TRANSCODE_CONCURRENCY_DEFAULT,
}

// Re-export helper for tests that want to exercise the default-bitrate
// path without round-tripping through a request.
export const __defaultBitrateForCodec =
  defaultBitrateForCodec
