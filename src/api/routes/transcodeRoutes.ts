import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { Readable } from "node:stream"

import { OpenAPIHono } from "@hono/zod-openapi"
import {
  defer,
  EMPTY,
  firstValueFrom,
  mergeMap,
  Observable,
  of,
  shareReplay,
  Subject,
} from "rxjs"

import { runFfmpegAudioTranscode } from "../../cli-spawn-operations/runFfmpegAudioTranscode.js"
import {
  PathSafetyError,
  validateReadablePath,
} from "../../tools/pathSafety.js"
import {
  mimeTypeForCodec,
  type TranscodeCacheKey,
  type TranscodeCodec,
  transcodeTempStore,
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
//   * Default codec Opus in WebM. AAC in fMP4 as fallback.
//   * No subtitle passthrough.
//   * Range strategy: encode-to-temp + serve completed file with Range.
//
// Concurrency gate: `MAX_TRANSCODE_CONCURRENCY` distinct encodes via an
// RxJS `mergeMap`. Same-key requests coalesce onto one in-flight encode
// via a per-key `shareReplay` observable.

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
}

type ValidationFailure = {
  message: string
  status: 400
}

type ValidationResult = (
  | { failure: ValidationFailure, params: null }
  | { failure: null, params: ValidatedParams }
)

const defaultBitrateForCodec = (codec: TranscodeCodec): string => (
  codec === "opus"
  ? "192k"
  : "256k"
)

const validateBitrate = (
  rawBitrate: string | undefined,
  codec: TranscodeCodec,
): { error: string | null, value: string } => {
  if (typeof rawBitrate !== "string" || rawBitrate.length === 0) {
    return { error: null, value: defaultBitrateForCodec(codec) }
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
): { error: string | null, value: number } => {
  if (typeof rawAudioStream !== "string" || rawAudioStream.length === 0) {
    return { error: null, value: 0 }
  }
  const parsed = Number(rawAudioStream)
  if (
    Number.isNaN(parsed)
    || !Number.isFinite(parsed)
    || parsed < 0
    || !Number.isInteger(parsed)
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
): { error: string | null, value: TranscodeCodec } => {
  if (typeof rawCodec !== "string" || rawCodec.length === 0) {
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

const validateAllParams = (
  rawPath: string | undefined,
  rawCodec: string | undefined,
  rawBitrate: string | undefined,
  rawAudioStream: string | undefined,
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
  const bitrateResult = validateBitrate(rawBitrate, codecResult.value)
  if (bitrateResult.error !== null) {
    return {
      failure: { message: bitrateResult.error, status: 400 },
      params: null,
    }
  }
  const audioStreamResult = validateAudioStream(rawAudioStream)
  if (audioStreamResult.error !== null) {
    return {
      failure: { message: audioStreamResult.error, status: 400 },
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
    },
  }
}

const messageFromError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

// Per-key in-flight encode tracker. Keyed on the same hashed string the
// store uses, so concurrent requests for the same encode share one
// observable. Removed when the encode settles (success or failure).
type InFlightEncode = Observable<"ready">

const buildHashKeyForLookup = (cacheKey: TranscodeCacheKey): string => (
  // Local mirror of the hashing scheme used inside transcodeTempStore;
  // re-hashing here avoids exporting the internal hash from the store
  // module (the store keeps it private to discourage stringly-typed
  // bookkeeping outside the module).
  [
    cacheKey.absPath,
    cacheKey.codec,
    cacheKey.bitrate,
    String(cacheKey.audioStream),
  ].join("|")
)

const inFlightEncodes = new Map<string, InFlightEncode>()
const transcodeQueue$ = new Subject<{
  cacheKey: TranscodeCacheKey
  resolver: (encode: InFlightEncode) => void
  tempPath: string
}>()

// Drains queued requests through the global concurrency gate. Each
// queued item resolves with a `shareReplay`-backed observable that
// represents the in-flight encode; downstream awaiters subscribe and
// see the same `"ready"` emission once the encoder finishes. The queue
// itself is a long-lived subscription so the route can resolve incoming
// requests synchronously without bootstrapping a new pipeline per call.
transcodeQueue$
.pipe(
  mergeMap(
    ({ cacheKey, resolver, tempPath }) => {
      const encode$ = (
        runFfmpegAudioTranscode({ cacheKey, tempPath })
        .pipe(
          shareReplay({ bufferSize: 1, refCount: false }),
        )
      )
      resolver(encode$)
      // Subscribe internally so the `shareReplay` cache is populated
      // even when the HTTP handler unsubscribes after consuming the
      // first emission. Without this, a fast unsubscribe would tear
      // down the encoder mid-flight via refCount: true semantics —
      // bufferSize: 1 + refCount: false keeps the cached `"ready"`
      // available for any late subscriber.
      return encode$
    },
    parseConcurrency(),
  ),
)
.subscribe({
  // Errors from individual encodes already settle their own observable
  // chain; swallow here to keep the queue alive across failures.
  error: () => {},
})

const acquireInFlightEncode = (
  cacheKey: TranscodeCacheKey,
  tempPath: string,
): Promise<InFlightEncode> => {
  const lookupKey = buildHashKeyForLookup(cacheKey)
  const existing = inFlightEncodes.get(lookupKey)
  if (existing !== undefined) {
    return Promise.resolve(existing)
  }
  return new Promise<InFlightEncode>((resolve) => {
    transcodeQueue$.next({
      cacheKey,
      resolver: (encode) => {
        const wrapped = (
          encode
          .pipe(
            mergeMap((emission) => {
              inFlightEncodes.delete(lookupKey)
              return of(emission)
            }),
          )
        )
        inFlightEncodes.set(lookupKey, wrapped)
        resolve(wrapped)
      },
      tempPath,
    })
  })
}

const buildHeadersForCodec = (codec: TranscodeCodec): Record<string, string> => ({
  "Cache-Control": "no-store",
  "Content-Disposition": "inline",
  "Content-Type": mimeTypeForCodec(codec),
  "X-Accel-Buffering": "no",
})

// Range-aware response builder. Mirrors the parsing logic from
// `fileRoutes.ts`'s /files/stream handler so a transcoded WebM/MP4
// behaves identically to a static file from the browser's perspective.
const respondWithRange = async ({
  codec,
  rangeHeader,
  tempPath,
}: {
  codec: TranscodeCodec
  rangeHeader: string | undefined
  tempPath: string
}): Promise<Response> => {
  const stats = await stat(tempPath)
  const totalSize = stats.size
  const baseHeaders = buildHeadersForCodec(codec)

  if (typeof rangeHeader !== "string" || rangeHeader.length === 0) {
    const stream = (
      Readable.toWeb(createReadStream(tempPath)) as ReadableStream
    )
    return new Response(stream, {
      headers: {
        ...baseHeaders,
        "Accept-Ranges": "bytes",
        "Content-Length": String(totalSize),
      },
      status: 200,
    })
  }

  const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/)
  if (!match) {
    return new Response(
      JSON.stringify({ error: `Unsupported Range header: ${rangeHeader}` }),
      {
        headers: { "Content-Type": "application/json" },
        status: 416,
      },
    )
  }
  const startByte = Number(match[1])
  const endByte = (
    match[2] === ""
    ? totalSize - 1
    : Number(match[2])
  )
  if (
    Number.isNaN(startByte)
    || Number.isNaN(endByte)
    || startByte > endByte
    || endByte >= totalSize
  ) {
    return new Response(null, {
      headers: { "Content-Range": `bytes */${totalSize}` },
      status: 416,
    })
  }
  const stream = (
    Readable.toWeb(
      createReadStream(tempPath, { end: endByte, start: startByte }),
    ) as ReadableStream
  )
  return new Response(stream, {
    headers: {
      ...baseHeaders,
      "Accept-Ranges": "bytes",
      "Content-Length": String(endByte - startByte + 1),
      "Content-Range": `bytes ${startByte}-${endByte}/${totalSize}`,
    },
    status: 206,
  })
}

// Small helper: subscribe to the encode observable and resolve when it
// emits `"ready"`. Wraps `firstValueFrom` so a thrown error becomes a
// rejected promise the route handler can catch and translate to 500.
const awaitEncodeReady = (encode$: InFlightEncode): Promise<void> => (
  firstValueFrom(
    encode$
    .pipe(
      mergeMap(() => EMPTY),
    ),
    { defaultValue: undefined as void },
  )
  .then(() => undefined)
)

const handleTranscodeRequest = async ({
  isHeadRequest,
  rangeHeader,
  rawAudioStream,
  rawBitrate,
  rawCodec,
  rawPath,
  requestSignal,
}: {
  isHeadRequest: boolean
  rangeHeader: string | undefined
  rawAudioStream: string | undefined
  rawBitrate: string | undefined
  rawCodec: string | undefined
  rawPath: string | undefined
  requestSignal: AbortSignal | undefined
}): Promise<Response> => {
  const validation = validateAllParams(
    rawPath,
    rawCodec,
    rawBitrate,
    rawAudioStream,
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
  }
  catch (error) {
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

  // HEAD short-circuits — no need to spin up the encoder, just answer
  // with the mime + cache headers so `<video preload="metadata">` can
  // confirm the URL is feasible without paying the encoder cost.
  if (isHeadRequest) {
    return new Response(null, {
      headers: buildHeadersForCodec(params.codec),
      status: 200,
    })
  }

  const cacheKey: TranscodeCacheKey = {
    absPath: validatedAbsPath,
    audioStream: params.audioStream,
    bitrate: params.bitrate,
    codec: params.codec,
  }

  const acquireResult = transcodeTempStore.acquire(cacheKey)

  // Hook request abort to release the refcount even when the client
  // disconnects mid-stream. Idempotent: release() on an already-evicted
  // entry is a no-op.
  if (requestSignal !== undefined) {
    requestSignal.addEventListener(
      "abort",
      () => {
        transcodeTempStore.release(cacheKey).catch(() => {})
      },
      { once: true },
    )
  }

  try {
    if (acquireResult.isFresh) {
      const encode$ = await acquireInFlightEncode(
        cacheKey,
        acquireResult.tempPath,
      )
      await awaitEncodeReady(encode$)
    }
    else {
      // A concurrent request started or already finished the encode.
      // Wait for the in-flight observable if one is still tracked;
      // otherwise the on-disk file is already complete.
      const lookupKey = buildHashKeyForLookup(cacheKey)
      const existing = inFlightEncodes.get(lookupKey)
      if (existing !== undefined) {
        await awaitEncodeReady(existing)
      }
    }

    const response = await respondWithRange({
      codec: params.codec,
      rangeHeader,
      tempPath: acquireResult.tempPath,
    })
    return response
  }
  catch (error) {
    transcodeTempStore.release(cacheKey).catch(() => {})
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
transcodeRoutes.on(["GET", "HEAD"], "/transcode/audio", async (context) => (
  handleTranscodeRequest({
    isHeadRequest: context.req.method === "HEAD",
    rangeHeader: context.req.header("range"),
    rawAudioStream: context.req.query("audioStream"),
    rawBitrate: context.req.query("bitrate"),
    rawCodec: context.req.query("codec"),
    rawPath: context.req.query("path"),
    requestSignal: (
      context.req.raw && "signal" in context.req.raw
      ? context.req.raw.signal
      : undefined
    ),
  })
))

// Best-effort cleanup of the on-disk cache when the server shuts down.
// Safe to call multiple times; the helper internally guards on directory
// existence. Wired here (not inside transcodeTempStore) so the store
// module stays decoupled from process-level event listeners.
process.on("exit", () => {
  transcodeTempStore.cleanupOnShutdown()
})
process.on("SIGINT", () => {
  transcodeTempStore.cleanupOnShutdown()
  process.exit(130)
})

// Test-only export: lets the integration tests reach into the in-flight
// map to assert coalescing behavior without exposing the implementation
// to runtime callers.
export const __inFlightEncodesForTests = inFlightEncodes

// Also exported for tests that want to drive a deterministic gate
// without waiting on the env-var-driven default.
export const __defaultsForTests = {
  bitrateCapKbps: BITRATE_CAP_KBPS,
  defaultConcurrency: MAX_TRANSCODE_CONCURRENCY_DEFAULT,
}

// Re-export helper for tests that want to exercise the default-bitrate
// path without round-tripping through a request.
export const __defaultBitrateForCodec = defaultBitrateForCodec

// Defer-wrapped re-export for tests that need to plug in a stub for the
// underlying ffmpeg spawn. Tests vi.mock the spawn module directly; this
// export gives them a stable touchpoint to verify the coalescing path.
export const __runFfmpegAudioTranscode$ = (
  options: Parameters<typeof runFfmpegAudioTranscode>[0],
): Observable<"ready"> => (
  defer(() => runFfmpegAudioTranscode(options))
)
