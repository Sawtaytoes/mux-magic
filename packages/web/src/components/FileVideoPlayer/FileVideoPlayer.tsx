import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { apiBase } from "../../apiBase"
import { useIsContainerized } from "../../hooks/useIsContainerized"
import { streamUrl } from "../../streamUrl"
import {
  isContainerBrowserSupported,
  isTranscodeNeeded,
  resolveTranscodeMimeType,
} from "./fileVideoPlayerRouting"

// Soft look-ahead limit. For high-bitrate NAS content the pump can fill
// the MSE quota (~150 MB) in under a second; pausing once the buffer is
// 30 s ahead of the playhead keeps the quota free with plenty of runway.
const MAX_AHEAD_SECONDS = 30

type FileVideoPlayerProps = {
  path: string | null
  onClose: () => void
}

// Sets up a MediaSource Extensions pipeline for the live transcode
// stream. Provides correct total duration (from MediaInfo via the HEAD
// X-Duration header), input-side ?start= seeking, and QuotaExceededError
// recovery. Falls back to a direct <video src> when MSE is unsupported or
// the video codec isn't in the browser's decodable set (no seeking, but
// still fast-starting playback). Returns a cleanup function.
//
// The seek-reset ordering inside `startStream` is LOAD-BEARING — it is
// the exact sequence v1's fix-chain converged on across four separate
// bugs. Do not reorder. See the decision doc for the failure each step
// guards against.
const setupMsePlayer = ({
  duration,
  hasAudio,
  player,
  transcodeUrl,
  videoCodecTag,
}: {
  duration: number
  hasAudio: boolean
  player: HTMLVideoElement
  transcodeUrl: string
  videoCodecTag: string | null
}): (() => void) => {
  const mimeType = resolveTranscodeMimeType(
    videoCodecTag,
    hasAudio,
  )

  if (
    !mimeType ||
    typeof MediaSource === "undefined" ||
    !MediaSource.isTypeSupported(mimeType)
  ) {
    // Codec unsupported in this browser — degrade to direct streaming
    // (no seeking, growing-duration display, but still fast start).
    player.src = transcodeUrl
    player.play().catch(() => {})
    return () => {
      player.pause()
      player.removeAttribute("src")
      player.load()
    }
  }

  let mediaSource = new MediaSource()
  let objectUrl = URL.createObjectURL(mediaSource)
  player.src = objectUrl

  let sourceBuffer: SourceBuffer | null = null
  let activeController: AbortController | null = null
  // Monotonic counter. Each startStream call claims a version; every
  // async step checks isStale() before touching the SourceBuffer so two
  // concurrent calls (from rapid seeks) can't interleave remove/append
  // operations and corrupt the buffer state.
  let activeVersion = 0

  const waitForUpdate = (buffer: SourceBuffer) =>
    new Promise<void>((resolve) =>
      buffer.addEventListener(
        "updateend",
        () => resolve(),
        { once: true },
      ),
    )

  const startStream = async (startSeconds: number) => {
    const myVersion = ++activeVersion
    const isStale = () => myVersion !== activeVersion

    activeController?.abort()
    const controller = new AbortController()
    activeController = controller

    const url =
      startSeconds > 0
        ? `${transcodeUrl}&start=${startSeconds.toFixed(3)}`
        : transcodeUrl

    let response: Response
    try {
      response = await fetch(url, {
        signal: controller.signal,
      })
    } catch {
      // AbortError (superseded by a newer seek) or a network failure —
      // either way this attempt is abandoned.
      return
    }
    if (!response.ok || !response.body || isStale()) {
      return
    }

    // For seeks we must clear buffered data so the new fMP4 init segment
    // (ftyp+moov) resets the codec decoders. A fresh moov from the new
    // ffmpeg stream is the cleanest reset: Chrome reinitializes both
    // decoders when the new init segment arrives. (changeType() silently
    // drops the video track; removeSourceBuffer+addSourceBuffer re-fires
    // 'seeking' into an abort loop — both rejected, see decision doc.)
    if (mediaSource.readyState !== "open") {
      // MediaSource ended (previous stream ran to completion and called
      // endOfStream()) or is closed. abort(), remove(), and setting
      // timestampOffset all require readyState='open', so rebuild.
      URL.revokeObjectURL(objectUrl)
      mediaSource = new MediaSource()
      objectUrl = URL.createObjectURL(mediaSource)
      player.src = objectUrl
      await new Promise<void>((resolve) =>
        mediaSource.addEventListener(
          "sourceopen",
          () => resolve(),
          { once: true },
        ),
      )
      if (isStale()) return
      if (Number.isFinite(duration) && duration > 0) {
        mediaSource.duration = duration
      }
      sourceBuffer = mediaSource.addSourceBuffer(mimeType)
      // Fresh SB: appendState is WAITING_FOR_SEGMENT, no abort() needed.
      sourceBuffer.timestampOffset = startSeconds
    } else {
      const buffer = sourceBuffer
      if (!buffer) return
      if (buffer.updating) {
        await waitForUpdate(buffer)
        if (isStale()) return
      }
      // abort() resets Chrome's appendState from PARSING_MEDIA_SEGMENT
      // back to WAITING_FOR_SEGMENT — the only MSE-spec way to do it.
      // Required before setting timestampOffset or calling remove().
      buffer.abort()
      // ffmpeg -ss resets output PTS to 0; timestampOffset shifts it back
      // to the seek position so Chrome resolves the seek against
      // player.currentTime. Must be set BEFORE remove() (PARSING error
      // otherwise).
      buffer.timestampOffset = startSeconds
      // Always clear the existing buffer so the new init segment resets
      // both decoders cleanly — skipping this on seeks-back-to-start left
      // stale codec state.
      if (buffer.buffered.length > 0) {
        buffer.remove(0, Infinity)
        await waitForUpdate(buffer)
        if (isStale()) return
      }
    }

    const buffer = sourceBuffer
    if (!buffer) return
    const reader = response.body.getReader()

    const pump = async () => {
      if (isStale() || controller.signal.aborted) return

      // Throttle: pause when the buffer is already far enough ahead.
      if (buffer.buffered.length > 0) {
        const ahead =
          buffer.buffered.end(buffer.buffered.length - 1) -
          player.currentTime
        if (ahead > MAX_AHEAD_SECONDS) {
          setTimeout(() => {
            if (!isStale()) void pump()
          }, 1000)
          return
        }
      }

      let chunk: ReadableStreamReadResult<Uint8Array>
      try {
        chunk = await reader.read()
      } catch {
        return
      }

      if (chunk.done) {
        if (!isStale()) {
          const finish = () => {
            try {
              mediaSource.endOfStream()
            } catch {
              // MediaSource already closed — nothing to finalize.
            }
          }
          if (buffer.updating) {
            buffer.addEventListener("updateend", finish, {
              once: true,
            })
          } else {
            finish()
          }
        }
        return
      }

      // Retry loop: hold the same chunk until it lands or the stream goes
      // stale. QuotaExceededError does NOT kill the pump — it evicts
      // played content (or waits for the playhead to advance) then
      // retries the same bytes.
      const data = chunk.value
      while (true) {
        if (isStale() || controller.signal.aborted) return
        if (buffer.updating) {
          await waitForUpdate(buffer)
          if (isStale()) return
        }
        try {
          // fetch-backed bytes are always a real ArrayBuffer view; the
          // cast bridges TS 5.7's Uint8Array<ArrayBufferLike> → BufferSource.
          buffer.appendBuffer(data as BufferSource)
          break
        } catch (error) {
          if (
            !(error instanceof DOMException) ||
            error.name !== "QuotaExceededError"
          ) {
            return
          }
          // Evict played content (keep the last 5 s for backward scrub).
          if (
            buffer.buffered.length > 0 &&
            buffer.buffered.start(0) <
              player.currentTime - 5
          ) {
            buffer.remove(
              buffer.buffered.start(0),
              player.currentTime - 5,
            )
            await waitForUpdate(buffer)
            if (isStale()) return
          } else {
            // Nothing to evict yet — wait up to 1 s for the playhead to
            // consume some buffer, then retry the same bytes.
            await Promise.race([
              new Promise<void>((resolve) =>
                player.addEventListener(
                  "timeupdate",
                  () => resolve(),
                  { once: true },
                ),
              ),
              new Promise<void>((resolve) =>
                setTimeout(resolve, 1000),
              ),
            ])
          }
        }
      }

      buffer.addEventListener(
        "updateend",
        () => void pump(),
        {
          once: true,
        },
      )
    }

    void pump()
  }

  const onSeeking = () => {
    const target = player.currentTime
    // Skip the re-fetch when the target already sits in a buffered range.
    const ranges = sourceBuffer?.buffered
    for (
      let index = 0;
      index < (ranges?.length ?? 0);
      index++
    ) {
      if (
        ranges &&
        target >= ranges.start(index) &&
        target <= ranges.end(index)
      ) {
        return
      }
    }
    void startStream(target)
  }

  void (async () => {
    await new Promise<void>((resolve) =>
      mediaSource.addEventListener(
        "sourceopen",
        () => resolve(),
        { once: true },
      ),
    )
    if (Number.isFinite(duration) && duration > 0) {
      mediaSource.duration = duration
    }
    sourceBuffer = mediaSource.addSourceBuffer(mimeType)
    void startStream(0)
    // Attach the seeking listener AFTER startStream(0) so any 'seeking'
    // event the browser fires during initial setup (currentTime=0)
    // doesn't abort the startup stream before its first fragment arrives.
    player.addEventListener("seeking", onSeeking)
    player.play().catch(() => {})
  })()

  return () => {
    player.removeEventListener("seeking", onSeeking)
    activeController?.abort()
    activeVersion++
    URL.revokeObjectURL(objectUrl)
  }
}

export const FileVideoPlayer = ({
  path,
  onClose,
}: FileVideoPlayerProps) => {
  const playerRef = useRef<HTMLVideoElement>(null)
  const mseCleanupRef = useRef<(() => void) | null>(null)
  const [isStatusVisible, setIsStatusVisible] =
    useState(false)
  // Shared via the useIsContainerized hook so PromptModal,
  // FileVideoPlayer, and any other consumer share a single per-store
  // /version probe instead of each firing their own on mount.
  const isContainerized = useIsContainerized()
  // null = features not loaded yet → playback effect waits before
  // deciding which URL to use. Defaulting unloaded → null avoids the
  // race where setupPlayback runs once with a stale `false`, points
  // <video>.src at /files/stream, then re-runs to the transcode URL —
  // a visible flicker / double-load on first open.
  const [
    isFfmpegTranscodeEnabled,
    setIsFfmpegTranscodeEnabled,
  ] = useState<boolean | null>(null)
  const [copyLabel, setCopyLabel] = useState("📋 Copy path")
  const [openLabel, setOpenLabel] = useState(
    "⬡ Open in player",
  )

  const clearMse = useCallback(() => {
    mseCleanupRef.current?.()
    mseCleanupRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      clearMse()
      const player = playerRef.current
      if (player) {
        player.pause()
        player.removeAttribute("src")
        player.load()
      }
    }
  }, [clearMse])

  useEffect(() => {
    // /version is now probed by useIsContainerized; this effect only
    // loads /features (the experimental-transcode flag).
    //
    // Mirror the server-side default (false) on /features fetch failure
    // so a flaky probe never accidentally turns the experimental
    // transcode path on for the user. The flag's docstring in
    // featuresRoutes.ts explicitly calls out the seek / InvalidStateError
    // bugs that gate it.
    fetch(`${apiBase}/features`, { cache: "no-store" })
      .then((resp) => resp.json())
      .then(
        (data: {
          isExperimentalFfmpegTranscodingEnabled?: boolean
        }) => {
          setIsFfmpegTranscodeEnabled(
            data.isExperimentalFfmpegTranscodingEnabled ===
              true,
          )
        },
      )
      .catch(() => setIsFfmpegTranscodeEnabled(false))
  }, [])

  useEffect(() => {
    if (!path || !playerRef.current) return
    // Wait for /features to land before deciding /files/stream vs
    // /transcode/audio. See the state declaration above for why null
    // matters here (avoids a first-render flicker).
    if (isFfmpegTranscodeEnabled === null) return
    const player = playerRef.current
    clearMse()
    player.pause()
    player.src = ""

    const setupPlayback = async () => {
      // Routing: transcode when the flag is on AND either the container
      // can't be demuxed natively (MKV/AVI/TS/…) OR the audio codec isn't
      // browser-decodable. The audio probe only runs when it can change
      // the answer — a native container still needs it; a non-native one
      // is already routed to transcode regardless.
      let isNeedingTranscode = false
      if (isFfmpegTranscodeEnabled) {
        // The audio-codec probe only runs when it can change the answer:
        // a non-native container already forces transcode, so probe only
        // for native containers to decide on audio. `isTranscodeNeeded`
        // re-derives the full decision (container OR audio) from the
        // probed format.
        let audioFormat: string | null = null
        if (isContainerBrowserSupported(path)) {
          try {
            const resp = await fetch(
              `${apiBase}/files/audio-codec?${new URLSearchParams({ path })}`,
              {
                cache: "no-store",
                signal: AbortSignal.timeout(30_000),
              },
            )
            if (resp.ok) {
              const data = (await resp.json()) as {
                audioFormat?: string
              }
              audioFormat = data.audioFormat ?? null
            }
          } catch {
            // Leave null — treated as browser-safe → direct stream.
          }
        }
        isNeedingTranscode = isTranscodeNeeded({
          audioFormat,
          path,
        })
      }

      // /files/stream is a seekable HTTP-Range route over the raw file
      // (see packages/api/src/api/routes/fileRoutes.ts:458-556); the
      // browser learns the real duration immediately and can scrub.
      // /transcode/audio is a live fMP4 mux from ffmpeg's stdout — only
      // seekable when the MSE client below is driving it.
      const transcodeUrl = `${apiBase}/transcode/audio?${new URLSearchParams(
        { codec: "opus", path },
      )}`

      setIsStatusVisible(isNeedingTranscode)
      player.addEventListener(
        "canplay",
        () => setIsStatusVisible(false),
        { once: true },
      )

      if (!isNeedingTranscode) {
        player.src = streamUrl(path)
        player.play().catch(() => {})
        return
      }

      // HEAD returns X-Duration (MediaInfo total seconds) and
      // X-Video-Codec (RFC 6381) so the MSE client can set the timeline
      // length and pick the SourceBuffer codec before any media arrives.
      let duration = Number.NaN
      let videoCodecTag: string | null = null
      // Default true so a HEAD failure keeps the legacy audio-expecting
      // behaviour; the server reports "false" only for video-only files.
      let hasAudio = true
      try {
        const headResp = await fetch(transcodeUrl, {
          method: "HEAD",
          signal: AbortSignal.timeout(30_000),
        })
        duration = parseFloat(
          headResp.headers.get("X-Duration") ?? "",
        )
        videoCodecTag =
          headResp.headers.get("X-Video-Codec")
        hasAudio =
          headResp.headers.get("X-Has-Audio") === "true"
      } catch {
        // HEAD failed — setupMsePlayer falls back to a direct src.
      }

      mseCleanupRef.current = setupMsePlayer({
        duration,
        hasAudio,
        player,
        transcodeUrl,
        videoCodecTag,
      })
    }

    void setupPlayback()
  }, [path, clearMse, isFfmpegTranscodeEnabled])

  const handleCopyPath = async () => {
    if (!path) return
    try {
      await navigator.clipboard.writeText(path)
      setCopyLabel("✓ Copied")
    } catch {
      window.prompt("Copy this path manually:", path)
      return
    }
    setTimeout(() => setCopyLabel("📋 Copy path"), 1200)
  }

  const handleOpenExternal = async () => {
    if (!path) return
    setOpenLabel("⏳ Launching…")
    try {
      const resp = await fetch(
        `${apiBase}/files/open-external`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        },
      )
      const data = (await resp.json()) as {
        isOk: boolean
        error?: string
      }
      setOpenLabel(data.isOk ? "✓ Launched" : "✗ Failed")
    } catch {
      setOpenLabel("✗ Failed")
    }
    setTimeout(() => setOpenLabel("⬡ Open in player"), 1500)
  }

  if (!path) return null

  return (
    <div
      role="none"
      id="video-modal"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/80"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose()
      }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700 shrink-0">
          <span
            id="video-modal-name"
            className="text-xs text-slate-400 font-mono flex-1 truncate"
            title={path}
          >
            {path}
          </span>
          {isStatusVisible && (
            <span
              id="video-modal-status"
              className="text-[10px] text-amber-300 bg-amber-900/40 border border-amber-700/50 px-1.5 py-0.5 rounded font-medium"
            >
              Transcoding…
            </span>
          )}
          <button
            type="button"
            id="video-modal-copy-path"
            onClick={() => void handleCopyPath()}
            className="text-xs text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded border border-slate-700 hover:border-slate-600"
          >
            {copyLabel}
          </button>
          {!isContainerized && (
            <button
              type="button"
              id="video-modal-open-external"
              onClick={() => void handleOpenExternal()}
              className="text-xs text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded border border-slate-700 hover:border-slate-600"
            >
              {openLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-base leading-none ml-1"
            title="Close"
          >
            ✕
          </button>
        </div>
        <video
          id="video-modal-player"
          ref={playerRef}
          controls
          autoPlay
          className="w-full bg-black max-h-[75dvh]"
        >
          <track
            kind="captions"
            srcLang="en"
            label="Captions"
          />
        </video>
      </div>
    </div>
  )
}
